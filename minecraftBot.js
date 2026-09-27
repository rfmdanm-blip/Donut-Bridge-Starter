const bedrock = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

function getDatabase() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

console.log('DonutSMP Bedrock bot is starting...');

const client = bedrock.createClient({
    host: process.env.SERVER_IP || 'play.donutsmp.net', 
    port: parseInt(process.env.SERVER_PORT || '19132', 10),
    username: process.env.MC_USERNAME || 'CasinoBot',
    offline: false // Set to false so it uses standard Xbox Live authentication tokens
});

client.on('join', () => {
    console.log('[BEDROCK] Client successfully connected to the server network.');
});

// BEDROCK PACKET LISTENER
client.on('text', (packet) => {
    // Bedrock text packets contain several parameters. We want the raw message string.
    const cleanChat = packet.message;
    if (!cleanChat) return;

    console.log(`[BEDROCK CHAT] ${cleanChat}`);

    // Matches standard payment lines: "Username paid you \$50,000"
    const payRegex = /([a-zA-Z0-9_]{3,16})\s+paid\s+you\s+\$([0-9,.]+[kmbt]?)/i;
    const match = cleanChat.match(payRegex);

    if (match) {
        const mcUsername = match[1];
        let amountStr = match[2].toLowerCase().replace(/,/g, '');
        
        let multiplier = 1;
        if (amountStr.endsWith('k')) { multiplier = 1000; amountStr = amountStr.slice(0, -1); }
        else if (amountStr.endsWith('m')) { multiplier = 1000000; amountStr = amountStr.slice(0, -1); }
        else if (amountStr.endsWith('b')) { multiplier = 1000000000; amountStr = amountStr.slice(0, -1); }
        
        const depositAmount = Math.floor(parseFloat(amountStr) * multiplier);

        console.log(`[DEPOSIT] Bedrock user ${mcUsername} sent $${depositAmount.toLocaleString()}`);

        const db = getDatabase();
        let foundDiscordUser = null;

        for (const discordId in db) {
            if (db[discordId].mcName && db[discordId].mcName.toLowerCase() === mcUsername.toLowerCase()) {
                foundDiscordUser = discordId;
                break;
            }
        }

        if (foundDiscordUser) {
            db[foundDiscordUser].balance += depositAmount;
            saveDatabase(db);
            
            // Execute automated Bedrock chat whisper response back
            client.queue('text', {
                type: 'chat',
                needs_translation: false,
                source_name: '',
                message: `/msg ${mcUsername} Deposit Success! Added to your Discord wallet.`,
                xuid: '',
                platform_chat_id: ''
            });
            console.log(`[BRIDGE] Credited balance to Discord User ID: ${foundDiscordUser}`);
        } else {
            client.queue('text', {
                type: 'chat',
                needs_translation: false,
                source_name: '',
                message: `/msg ${mcUsername} Error: Run /link on our Discord server first!`,
                xuid: '',
                platform_chat_id: ''
            });
        }
    }
});

client.on('error', (err) => console.error('[BEDROCK ERROR]', err));
