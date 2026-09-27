    // --- MASTER BEDROCK DEPOSIT PARSER: Intercept text packets ---
    client.on('text', (packet) => {
        let cleanChat = "";

        // 1. Check if the server sent the text via structured parameters (Most common for Bedrock economy)
        if (packet.parameters && packet.parameters.length > 0) {
            cleanChat = packet.parameters.join(' ');
        } 
        // 2. Fall back to standard flat text string parameters if parameters are empty
        else if (packet.message) {
            cleanChat = packet.message;
        }

        if (!cleanChat) return;

        // Strip hidden Minecraft color formatting codes (§a, §f, etc)
        cleanChat = cleanChat.replace(/§[0-9a-fk-or]/gi, '').trim();
        console.log(`[BEDROCK CHAT PACKET PARSED] ${cleanChat}`);

        // Precise DonutSMP format matcher: Looks for username + "paid you \$"
        const payRegex = /(\.?[a-zA-Z0-9_]{3,16})\s+paid\s+you\s+\$([0-9,.]+[kmbt]?)/i;
        const match = cleanChat.match(payRegex);

        if (match) {
            let mcUsername = match[1];
            let amountStr = match[2].toLowerCase().replace(/,/g, '');
            
            // Normalize Bedrock dot prefix (.Steve -> steve)
            if (mcUsername.startsWith('.')) {
                mcUsername = mcUsername.substring(1);
            }
            
            let multiplier = 1;
            if (amountStr.endsWith('k')) { multiplier = 1000; amountStr = amountStr.slice(0, -1); }
            else if (amountStr.endsWith('m')) { multiplier = 1000000; amountStr = amountStr.slice(0, -1); }
            else if (amountStr.endsWith('b')) { multiplier = 1000000000; amountStr = amountStr.slice(0, -1); }
            
            const depositAmount = Math.floor(parseFloat(amountStr) * multiplier);
            console.log(`[💰 DEPOSIT DETECTED] Account: ${mcUsername} | Chips Credited: $${depositAmount.toLocaleString()}`);

            const db = getDatabase();
            let foundDiscordUser = null;

            // Search the ledger for a matching Minecraft username link configuration
            for (const discordId in db) {
                if (db[discordId].mcName && db[discordId].mcName.toLowerCase() === mcUsername.toLowerCase()) {
                    foundDiscordUser = discordId;
                    break;
                }
            }

            if (foundDiscordUser) {
                db[foundDiscordUser].balance += depositAmount;
                saveDatabase(db);
                
                sendServerMessage(`/msg ${mcUsername} Deposit Success! +$${depositAmount.toLocaleString()} chips added to Discord.`);
                console.log(`[BRIDGE SUCCESS] Balance pushed to Discord wallet ID: ${foundDiscordUser}`);
            } else {
                sendServerMessage(`/msg ${mcUsername} Error: Type /link on our Discord server first!`);
                console.log(`[BRIDGE ERROR] ${mcUsername} deposited $${depositAmount} but holds no linked Discord identity layout.`);
            }
        }
    });
