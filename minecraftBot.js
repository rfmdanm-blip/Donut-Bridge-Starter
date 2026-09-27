const mineflayer = require('mineflayer');
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

console.log('DonutSMP Java Mineflayer engine initializing...');

let bot;
let isReconnecting = false;

// --- INITIALIZE JAVA CLIENT WITH RECONNECT LOOP ---
function startBot() {
    isReconnecting = false;
    console.log('[MINECRAFT] Connecting natively to Java network endpoint...');

    bot = mineflayer.createBot({
        host: process.env.SERVER_IP || 'play.donutsmp.net',
        port: 25565, // Standard Java Port
        username: process.env.MC_USERNAME,
        auth: 'microsoft', // Change to 'offline' if testing on local/cracked setups
        version: '1.20.4' // Forces a stable protocol standard matching the network core
    });

    bot.on('login', () => {
        console.log('[MINECRAFT] Bot successfully spawned inside the live world context.');
    });

    // --- AUTOMATED DEPOSITS: Intercept Chat Events ---
    bot.on('message', (jsonMsg) => {
        let cleanChat = jsonMsg.toString().trim();
        if (!cleanChat) return;

        console.log(`[MINECRAFT CHAT LOG] ${cleanChat}`);

        // Precise DonutSMP Java format matcher: Looks for username + "paid you \$"
        const payRegex = /([a-zA-Z0-9_]{3,16})\s+paid\s+you\s+\$([0-9,.]+[kmbt]?)/i;
        const match = cleanChat.match(payRegex);

        if (match) {
            const mcUsername = match[1];
            let amountStr = match[2].toLowerCase().replace(/,/g, '');
            
            // Handle number multipliers
            let multiplier = 1;
            if (amountStr.endsWith('k')) { multiplier = 1000; amountStr = amountStr.slice(0, -1); }
            else if (amountStr.endsWith('m')) { multiplier = 1000000; amountStr = amountStr.slice(0, -1); }
            else if (amountStr.endsWith('b')) { multiplier = 1000000000; amountStr = amountStr.slice(0, -1); }
            
            const depositAmount = Math.floor(parseFloat(amountStr) * multiplier);

            // Security check: Make sure it isn't reading its own confirmation printout
            if (mcUsername.toLowerCase() === bot.username.toLowerCase()) return;

            console.log(`[💰 DEPOSIT DETECTED] Account: ${mcUsername} | Chips Credited: $${depositAmount.toLocaleString()}`);

            const db = getDatabase();
            let foundDiscordUser = null;

            // Search the ledger map
            for (const discordId in db) {
                if (db[discordId].mcName && db[discordId].mcName.toLowerCase() === mcUsername.toLowerCase()) {
                    foundDiscordUser = discordId;
                    break;
                }
            }

            if (foundDiscordUser) {
                db[foundDiscordUser].balance += depositAmount;
                saveDatabase(db);
                
                bot.chat(`/msg ${mcUsername} Deposit Success! +$${depositAmount.toLocaleString()} chips added to Discord.`);
                console.log(`[BRIDGE SUCCESS] Balance pushed to Discord wallet ID: ${foundDiscordUser}`);
            } else {
                bot.chat(`/msg ${mcUsername} Error: Type /link on our Discord server first!`);
                console.log(`[BRIDGE ERROR] ${mcUsername} deposited $${depositAmount} but holds no linked Discord ID.`);
            }
        }
    });

    // --- DISCONNECTION SAFETY NETS ---
    bot.on('error', (err) => {
        console.error('[MINECRAFT ERROR]', err.message);
    });

    bot.on('end', () => {
        console.log('[MINECRAFT] Disconnected from server host stream.');
        triggerReconnect();
    });
}

function triggerReconnect() {
    if (isReconnecting) return;
    isReconnecting = true;
    console.log('[RECONNECT] Scheduling a clean retry sequence in 15 seconds...');
    
    setTimeout(() => {
        startBot();
    }, 15000);
}

// --- AUTOMATED PAYOUTS: Listen for the Discord withdrawal trigger event ---
process.on('bedrockWithdraw', (data) => {
    const { mcName, amount } = data;
    if (!bot || isReconnecting) return;
    
    console.log(`[WITHDRAW EVENT] Discord request triggered payout execution for ${mcName} - Amount: $${amount}`);

    // Buffer pipeline to safely bypass anti-spam chat caps
    setTimeout(() => {
        bot.chat(`/pay ${mcName} ${amount}`);
        console.log(`[COMMAND EXECUTION] Dispatched: /pay ${mcName} ${amount}`);
    }, 1500); 
});

// Boot the Java runtime loop
startBot();
