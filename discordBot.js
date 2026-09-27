const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
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

function getUser(userId, db) {
    if (!db[userId]) {
        db[userId] = { mcName: null, balance: 0, linkCode: null };
    }
    return db[userId];
}

// --- BOT INITIALIZATION ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your current casino balance'),
    
    new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Minecraft account')
        .addStringOption(opt => opt.setName('username').setDescription('Your DonutSMP Username').setRequired(true)),

    new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Bet on a 50/50 flip (47% House Advantage edge)')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true)),

    new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Spin the slot machine!')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true)),

    new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll a 6-sided die. Roll a 4, 5, or 6 to win!')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true)),

    new SlashCommandBuilder()
        .setName('jackpot')
        .setDescription('High risk multiplier. 10% chance to win 5x your bet!')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`[DISCORD] Casino online as \${client.user.tag}`);
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[DISCORD] Registered all 4 casino games.');
    } catch (err) {
        console.error(err);
    }
});

// --- COMMAND & GAME LOGIC ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const userId = interaction.user.id;
    const db = getDatabase();
    const user = getUser(userId, db);
    const cmd = interaction.commandName;

    // Utility 1: Balance
    if (cmd === 'balance') {
        const mcTag = user.mcName ? `(Linked to: \`${user.mcName}\`)` : '(Unlinked)';
        return interaction.reply(`💳 **Wallet Balance:** user.balance.toLocaleString() chips {mcTag}`);
    }

    // Utility 2: Link Identity Setup
    if (cmd === 'link') {
        const mcUsername = interaction.options.getString('username');
        user.mcName = mcUsername;
        
        // Generate a random code your mineflayer bot can check in-game if you choose to build verifications later
        user.linkCode = Math.floor(100000 + Math.random() * 900000).toString(); 
        saveDatabase(db);

        return interaction.reply(`🔗 Linked your Discord to Minecraft user **\${mcUsername}**!\nYour security check code is: \`${user.linkCode}\``);
    }

    // --- GRAB & VALIDATE WAGERS ---
    const amount = interaction.options.getInteger('amount');
    if (amount) {
        if (amount <= 0) return interaction.reply('❌ You must bet a positive number of chips!');
        if (user.balance < amount) {
            return interaction.reply(`❌ Insufficient funds! You need $${(amount - user.balance).toLocaleString()} more chips.`);
        }
    }

    // Game 1: Coinflip (47% win chance - standard casino edge)
    if (cmd === 'coinflip') {
        const win = Math.random() < 0.47;
        if (win) {
            user.balance += amount;
            interaction.reply(`🪙 **Heads!** You won **+$${amount.toLocaleString()}**! Wallet: $${user.balance.toLocaleString()}`);
        } else {
            user.balance -= amount;
            interaction.reply(`🪙 **Tails!** You lost **-$${amount.toLocaleString()}**. Wallet: $${user.balance.toLocaleString()}`);
        }
    }

    // Game 2: Slots (Three matching icons multiplier payouts)
    if (cmd === 'slots') {
        const icons = ['🍒', '🍋', '💎', '🔔', '🍀'];
        const r1 = icons[Math.floor(Math.random() * icons.length)];
        const r2 = icons[Math.floor(Math.random() * icons.length)];
        const r3 = icons[Math.floor(Math.random() * icons.length)];
        const grid = `[ ${r1} | ${r2} | ${r3} ]`;

        if (r1 === r2 && r2 === r3) { // 3 of a kind (Big win)
            const winnings = amount * 3;
            user.balance += winnings;
            interaction.reply(`🎰 ${grid}\n**JACKPOT!** Triple match! You won **+$${winnings.toLocaleString()}**!`);
        } else if (r1 === r2 || r2 === r3 || r1 === r3) { // 2 of a kind (Small win)
            const winnings = Math.floor(amount * 0.5);
            user.balance += winnings;
            interaction.reply(`🎰 ${grid}\n**Double!** You won **+$${winnings.toLocaleString()}**!`);
        } else { // No match
            user.balance -= amount;
            interaction.reply(`🎰 ${grid}\n**No match.** You lost **-$${amount.toLocaleString()}**.`);
        }
    }

    // Game 3: Dice Roll
    if (cmd === 'dice') {
        const roll = Math.floor(Math.random() * 6) + 1;
        if (roll >= 4) { // 4, 5, 6 wins (50% odds raw)
            user.balance += amount;
            interaction.reply(`🎲 You rolled a **${roll}**! You won **+$${amount.toLocaleString()}**!`);
        } else {
            user.balance -= amount;
            interaction.reply(`🎲 You rolled a **${roll}**! You lost **-$${amount.toLocaleString()}**.`);
        }
    }

    // Game 4: High Roller Jackpot (10% win rate, massive 5x payout)
    if (cmd === 'jackpot') {
        const win = Math.random() < 0.10; // 10% chance
        if (win) {
            const winnings = amount * 5;
            user.balance += winnings;
            interaction.reply(`🚀 **MEGA WIN!** You hit the 10% chance and won **+$${winnings.toLocaleString()}** (5x)!`);
        } else {
            user.balance -= amount;
            interaction.reply(`💥 **Boom.** The jackpot missed. You lost **-$${amount.toLocaleString()}**.`);
        }
    }

    saveDatabase(db);
});

client.login(process.env.DISCORD_TOKEN);
