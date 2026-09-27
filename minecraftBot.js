    // --- PATCHED AUTOMATED DEPOSITS: Intercept text packets ---
    client.on('text', (packet) => {
        let cleanChat = packet.message;
        if (!cleanChat) return;

        // Strip hidden Minecraft color formatting codes (e.g., §a, §f) that throw off search math
        cleanChat = cleanChat.replace(/§[0-9a-fk-or]/gi, '').trim();
        console.log(`[BEDROCK CHAT RAW CLEANED] ${cleanChat}`);

        // Precise DonutSMP format matcher: Looks for optionally prefixed dot username + "paid you \$"
        const payRegex = /(\.?[a-zA-Z0-9_]{3,16})\s+paid\s+you\s+\$([0-9,.]+[kmbt]?)/i;
        const match = cleanChat.match(payRegex);

        if (match) {
            let mcUsername = match;
            let amountStr = match.toLowerCase().replace(/,/g, '');
            
            // Normalize username: Strip out the Bedrock server dot if present (.Notch -> notch)
            if (mcUsername.startsWith('.')) {
                mcUsername = mcUsername.substring(1);
            }
            
            let multiplier = 1;
            if (amountStr.endsWith('k')) { multiplier = 1000; amountStr = amountStr.slice(0, -1); }
            else if (amountStr.endsWith('m')) { multiplier = 1000000; amountStr = amountStr.slice(0, -1); }
            else if (amountStr.endsWith('b')) { multiplier = 1000000000; amountStr = amountStr.slice(0, -1); }
            
            const depositAmount = Math.floor(parseFloat(amountStr) * multiplier);
            console.log(`[DEPOSIT IDENTIFIED] Cleaned User: ${mcUsername} - Amount parsed: $${depositAmount.toLocaleString()}`);

            const db = getDatabase();
            let foundDiscordUser = null;

            // Find the Discord account linked to this Minecraft name
            for (const discordId in db) {
                if (db[discordId].mcName && db[discordId].mcName.toLowerCase() === mcUsername.toLowerCase()) {
                    foundDiscordUser = discordId;
                    break;
                }
            }

            if (foundDiscordUser) {
                db[foundDiscordUser].balance += depositAmount;
                saveDatabase(db);
                
                sendServerMessage(`/msg ${mcUsername} Deposit Success! Added to your Discord wallet.`);
                console.log(`[BRIDGE] Balance successfully credited to Discord User ID: ${foundDiscordUser}`);
            } else {
                // If they forgot to do /link
                sendServerMessage(`/msg ${mcUsername} Error: Run /link on our Discord server first!`);
                console.log(`[BRIDGE WARNING] ${mcUsername} paid bot but holds no linked Discord ID configuration.`);
            }
        }
    });
