    const bedrock = require('bedrock-protocol');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

// --- DATABASE HANDLERS ---
function getDatabase() {
    if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

console.log('DonutSMP Bedrock bot initialization engine loaded.');

// 1. CHOOSE A PLACEHOLDER FOR THE CLIENT TARGET FIRST
let client;
let isReconnecting = false;

// 2. DEFINE THE ACTIVE SETUP ROUTINE
function startBot() {
    isReconnecting = false;
    console.log('[BEDROCK] Attempting connection to the Minecraft server network...');

    // CREATE THE BOT CLIENT INSIDE THE VARIABLE PLACEHOLDER
    client = bedrock.createClient({
        host: process.env.SERVER_IP || 'play.donutsmp.net', 
        port: parseInt(process.env.SERVER_PORT || '19132', 10),
        username: process.env.MC_USERNAME,
        offline: false 
    });

    client.on('join', () => {
        console.log('[BEDROCK] Client successfully connected to the server network.');
    });

    // --- AUTOMATED DEPOSITS: Intercept text packets ---
    client.on('text', (packet) => {
        let cleanChat = packet.message;
        if (!cleanChat) return;

        // Strip hidden Minecraft color formatting codes
        cleanChat = cleanChat.replace(/§[0-9a-fk-or]/gi, '').trim();
        console.log(`[BEDROCK CHAT RAW CLEANED] ${cleanChat}`);

        // Precise DonutSMP format matcher
        const payRegex = /(\.?[a-zA-Z0-9_]{3,16})\s+paid\s+you\s+\$([0-9,.]+[kmbt]?)/i;
        const match = cleanChat.match(payRegex);

        if (match) {
            let mcUsername = match[1];
            let amountStr = match[2].toLowerCase().replace(/,/g, '');
            
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
                sendServerMessage(`/msg ${mcUsername} Error: Run /link on our Discord server first!`);
                console.log(`[BRIDGE WARNING] ${mcUsername} paid bot but holds no linked Discord ID configuration.`);
            }
        }
    });

    // --- FAILURE & DISCONNECTION RECOVERY SAFETY CHECKS ---
    client.on('error', (err) => {
        console.error('[BEDROCK ERROR]', err.message);
        triggerReconnect();
    });

    client.on('close', () => {
        console.log('[BEDROCK] Connection to the server closed.');
        triggerReconnect();
    });
}

function triggerReconnect() {
    if (isReconnecting) return;
    isReconnecting = true;
    console.log('[RECONNECT LOOP] Scheduling server reconnect retry in 15 seconds...');
    
    if (client) {
        try {
            client.disconnect(); 
        } catch(e) {
            console.log('[RECONNECT] Client was already closed.');
        }
    }
    
    setTimeout(() => {
        startBot();
    }, 15000);
}

// Helper utility to drop outgoing chat commands securely
function sendServerMessage(msgText) {
    if (!client || isReconnecting) return;
    try {
        client.queue('text', {
            type: 'chat',
            needs_translation: false,
            source_name: '',
            xuid: '',
            platform_chat_id: '',
            filtered_message: '',
            message: msgText
        });
    } catch (e) {
        console.error('[PACKET OUTBOUND ERROR] Failed to deliver command packet:', e.message);
    }
}

// --- AUTOMATED PAYOUTS: Listen for the Discord withdrawal trigger event ---
process.on('bedrockWithdraw', (data) => {
    const { mcName, amount } = data;
    console.log(`[WITHDRAW EVENT] Discord request triggered payout execution for ${mcName} - Amount: $${amount}`);

    setTimeout(() => {
        sendServerMessage(`/pay ${mcName} ${amount}`);
        console.log(`[BEDROCK COMMAND EXECUTION] Sent command to server stream: /pay ${mcName} ${amount}`);
    }, 1500); 
});

// 3. LAUNCH THE BOT ENGINE
startBot();
