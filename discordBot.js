const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const games = require('./games'); // Import our games helper module

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
    if (!db[userId]) db[userId] = { mcName: null, balance: 0 };
    return db[userId];
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- REGISTER SLASH COMMANDS ---
const commands = [
    new SlashCommandBuilder().setName('balance').setDescription('Check your casino balance'),
    new SlashCommandBuilder().setName('link').setDescription('Link your Minecraft account')
        .addStringOption(opt => opt.setName('username').setDescription('Your Username').setRequired(true)),
    new SlashCommandBuilder().setName('withdraw').setDescription('Withdraw chips')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true)),
    new SlashCommandBuilder().setName('coinflip').setDescription('50/50 flip')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Bet').setRequired(true)),
    new SlashCommandBuilder().setName('roulette').setDescription('Color wheel')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Bet').setRequired(true))
        .addStringOption(opt => opt.setName('color').setDescription('Red, Black, Green').setRequired(true)
            .addChoices({name:'Red', value:'red'}, {name:'Black', value:'black'}, {name:'Green', value:'green'})),
    new SlashCommandBuilder().setName('chicken').setDescription('Chicken Fryer')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Bet').setRequired(true))
        .addIntegerOption(opt => opt.setName('bones').setDescription('Bones (1-24)').setRequired(true)),
    new SlashCommandBuilder().setName('crash').setDescription('Rocket Crash')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Bet').setRequired(true)),
    new SlashCommandBuilder().setName('mines').setDescription('Button Mines')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Bet').setRequired(true))
        .addIntegerOption(opt => opt.setName('bombs').setDescription('Bombs (1-24)').setRequired(true)),
    new SlashCommandBuilder().setName('tower').setDescription('Climb Tower')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Bet').setRequired(true)),
    new SlashCommandBuilder().setName('blackjack').setDescription('Play Blackjack')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Bet').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[DISCORD] Casino online with 7 modular games.');
    } catch (err) { console.error(err); }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const userId = interaction.user.id;
    const db = getDatabase();
    const user = getUser(userId, db);
    const cmd = interaction.commandName;

    const baseEmbed = () => new EmbedBuilder().setTimestamp().setFooter({ text: 'DonutSMP Casino Framework' });
    const errorEmbed = (txt) => baseEmbed().setTitle('❌ Error').setColor(0xe74c3c).setDescription(txt);
    const successEmbed = (title, txt) => baseEmbed().setTitle(title).setColor(0x2ecc71).setDescription(txt);

    // --- UTILITIES ---
    if (cmd === 'balance') {
        const mcTag = user.mcName ? `\`${user.mcName}\`` : '*Not Linked*';
        const embed = baseEmbed().setTitle('💳 Account Balance').setColor(0x3498db)
            .addFields({ name: 'Chips', value: `$${user.balance.toLocaleString()}`, inline: true }, { name: 'Minecraft', value: mcTag, inline: true });
        return interaction.reply({ embeds: [embed] });
    }
    if (cmd === 'link') {
        user.mcName = interaction.options.getString('username');
        saveDatabase(db);
        return interaction.reply({ embeds: [successEmbed('🔗 Account Linked', `Paired Discord profile to Minecraft identity: **${user.mcName}**.`)] });
    }

    const amount = interaction.options.getInteger('amount');
    if (amount <= 0) return interaction.reply({ embeds: [errorEmbed('Bet amount must be positive!')] });
    if (user.balance < amount) return interaction.reply({ embeds: [errorEmbed(`Insufficient funds! You need $${(amount - user.balance).toLocaleString()} more.`)] });

    if (cmd === 'withdraw') {
        if (!user.mcName) return interaction.reply({ embeds: [errorEmbed('Use `/link` first!')] });
        user.balance -= amount;
        saveDatabase(db);
        process.emit('bedrockWithdraw', { mcName: user.mcName, amount: amount });
        return interaction.reply({ embeds: [successEmbed('💸 Payout Processed', `Sending **$${amount.toLocaleString()}** to \`${user.mcName}\` in-game now.`)] });
    }

    // --- MODULAR CASINO INTERACTIVE RUNTIME ---
    const embed = baseEmbed();

    if (cmd === 'coinflip') {
        const win = games.playCoinflip();
        if (win) {
            user.balance += amount;
            embed.setTitle('🪙 Coinflip: WIN!').setColor(0x2ecc71).setDescription(`**Heads!** You won **+$${amount.toLocaleString()}**!\nWallet: $${user.balance.toLocaleString()}`);
        } else {
            user.balance -= amount;
            embed.setTitle('🪙 Coinflip: LOSS').setColor(0xe74c3c).setDescription(`**Tails!** You lost **-$${amount.toLocaleString()}**.\nWallet: $${user.balance.toLocaleString()}`);
        }
    }

    if (cmd === 'roulette') {
        const choice = interaction.options.getString('color');
        const res = games.playRoulette(choice);
        if (res.win) {
            const mult = res.landed === 'green' ? 14 : 2;
            const profit = amount * (mult - 1);
            user.balance += profit;
            embed.setTitle('🎡 Roulette: WIN!').setColor(0x2ecc71).setDescription(`Landed on **${res.landed.toUpperCase()}**!\nProfit: **+$${profit.toLocaleString()}**\nWallet: $${user.balance.toLocaleString()}`);
        } else {
            user.balance -= amount;
            embed.setTitle('🎡 Roulette: LOSS').setColor(0xe74c3c).setDescription(`Landed on **${res.landed.toUpperCase()}**.\nLoss: **-$${amount.toLocaleString()}**\nWallet: $${user.balance.toLocaleString()}`);
        }
    }

    if (cmd === 'chicken') {
        const bones = interaction.options.getInteger('bones');
        if (bones < 1 || bones > 24) return interaction.reply({ embeds: [errorEmbed('Bones must be 1-24.')] });
        const win = games.playChicken(bones);
        if (win) {
            const profit = Math.floor(amount * (bones * 0.15));
            user.balance += profit;
            embed.setTitle('🍗 Chicken: SUCCESS!').setColor(0x2ecc71).setDescription(`Fried clean!\nProfit: **+$${profit.toLocaleString()}**\nWallet: $${user.balance.toLocaleString()}`);
        } else {
            user.balance -= amount;
            embed.setTitle('🍗 Chicken: BURNT').setColor(0xe74c3c).setDescription(`Hit a bad bone!\nLoss: **-$${amount.toLocaleString()}**\nWallet: $${user.balance.toLocaleString()}`);
        }
    }

    if (cmd === 'crash') {
        const res = games.playCrash();
        if (res.win) {
            const profit = Math.floor(amount * (res.cashout - 1));
            user.balance += profit;
            embed.setTitle('🚀 Crash: SAFE!').setColor(0x2ecc71).setDescription(`Rocket hit **${res.crash}x**. Cashed out at **${res.cashout}x**.\nProfit: **+$${profit.toLocaleString()}**\nWallet: $${user.balance.toLocaleString()}`);
        } else {
            user.balance -= amount;
            embed.setTitle('🚀 Crash: BOOM!').setColor(0xe74c3c).setDescription(`Rocket **CRASHED** at **${res.crash}x** before target.\nLoss: **-$${amount.toLocaleString()}**\nWallet: $${user.balance.toLocaleString()}`);
        }
    }

    if (cmd === 'mines') {
        const bombs = interaction.options.getInteger('bombs');
        if (bombs < 1 || bombs > 24) return interaction.reply({ embeds: [errorEmbed('Choose 1-24 bombs.')] });
        user.balance -= amount; saveDatabase(db);
        const board = games.generateMinesBoard(bombs);
        let dynamicProfit = 0, diamondCount = 0, flipped = [];

        const buildRows = (done = false) => {
            const rows = [];
            for (let r = 0; r < 5; r++) {
                const row = new ActionRowBuilder();
                for (let c = 0; c < 5; c++) {
                    const idx = r * 5 + c;
                    const btn = new ButtonBuilder().setCustomId(`mine_${idx}`).setLabel('❓').setStyle(ButtonStyle.Secondary);
                    if (flipped.includes(idx) || done) {
                        btn.setLabel(board[idx]).setDisabled(true);
                        btn.setStyle(board[idx] === '💣' ? ButtonStyle.Danger : ButtonStyle.Success);
                    }
                    row.addComponents(btn);
                }
                rows.push(row);
            }
            rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('mine_cash').setLabel(`Cash Out (+$${dynamicProfit.toLocaleString()})`).setStyle(ButtonStyle.Primary).setDisabled(done)));
            return rows;
        };
        const msg = await interaction.reply({ 
            embeds: [embed.setTitle('⛏️ Mines Active').setColor(0x3498db).setDescription(`Avoid the **${bombs}** hidden bombs.`)], 
            components: buildRows(), 
            fetchReply: true 
        });
        
        const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
        
        col.on('collect', async b => {
            if (b.user.id !== userId) return b.reply({ content: 'Not your game!', ephemeral: true });
            
            if (b.customId === 'mine_cash') {
                const fDB = getDatabase(); 
                fDB[userId].balance += (amount + dynamicProfit); 
                saveDatabase(fDB); 
                col.stop();
                return b.update({ 
                    embeds: [successEmbed('⛏️ Mines: Clean Clear', `Profit: **+$${dynamicProfit.toLocaleString()}**\nWallet: $${fDB[userId].balance.toLocaleString()}`)], 
                    components: [] 
                });
            }
            
            const idx = parseInt(b.customId.split('_')[1]); 
            flipped.push(idx);
            
            if (board[idx] === '💣') {
                col.stop(); 
                return b.update({ 
                    embeds: [errorEmbed(`Struck a bomb at grid #${idx}!\nLoss: -$${amount.toLocaleString()}`)], 
                    components: buildRows(true) 
                });
            } else {
                diamondCount++; 
                dynamicProfit = Math.floor(amount * (diamondCount * (bombs * 0.12)));
                await b.update({ 
                    embeds: [embed.setDescription(`Uncovered: ${diamondCount} 💎\nPending Cashout Value: $${dynamicProfit.toLocaleString()}`)], 
                    components: buildRows() 
                });
            }
        });
        return;
    }

    if (cmd === 'tower') {
        user.balance -= amount; 
        saveDatabase(db);
        let currentFloor = 0, currentWinnings = amount;
        
        const buildTower = (done = false) => {
            const rows = [];
            for (let f = 3; f >= 0; f--) {
                const row = new ActionRowBuilder();
                for (let t = 0; t < 3; t++) {
                    const btn = new ButtonBuilder().setCustomId(`tower_${f}_${t}`).setLabel('⬜').setStyle(ButtonStyle.Secondary);
                    if (f !== currentFloor || done) btn.setDisabled(true);
                    row.addComponents(btn);
                }
                rows.push(row);
            }
            rows.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('tower_cash').setLabel(`Cash Out ($${currentWinnings.toLocaleString()})`).setStyle(ButtonStyle.Primary).setDisabled(currentFloor === 0 || done)
            ));
            return rows;
        };

        const msg = await interaction.reply({ 
            embeds: [embed.setTitle('🏰 The Tower').setColor(0x9b59b6).setDescription(`Climb levels. Next value: $${Math.floor(currentWinnings * 1.45).toLocaleString()}`)], 
            components: buildTower(), 
            fetchReply: true 
        });
        
        const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
        
        col.on('collect', async b => {
            if (b.user.id !== userId) return b.reply({ content: 'Not yours!', ephemeral: true });
            
            if (b.customId === 'tower_cash') {
                const fDB = getDatabase(); 
                fDB[userId].balance += currentWinnings; 
                saveDatabase(fDB); 
                col.stop();
                return b.update({ 
                    embeds: [successEmbed('🏰 Tower: Cashed', `Returned: **+$${currentWinnings.toLocaleString()}**\nWallet: $${fDB[userId].balance.toLocaleString()}`)], 
                    components: [] 
                });
            }
            
            const [,, fStr, tStr] = b.customId.split('_');
            if (parseInt(fStr) !== currentFloor) return b.reply({ content: 'Active row only!', ephemeral: true });
            
            if (Math.floor(Math.random() * 3) === parseInt(tStr)) {
                col.stop(); 
                return b.update({ 
                    embeds: [errorEmbed(`Fell on Floor ${currentFloor + 1}!\nLoss: -$${amount.toLocaleString()}`)], 
                    components: buildTower(true) 
                });
            } else {
                currentFloor++; 
                currentWinnings = Math.floor(currentWinnings * 1.45);
                if (currentFloor === 4) {
                    const fDB = getDatabase(); 
                    fDB[userId].balance += currentWinnings; 
                    saveDatabase(fDB); 
                    col.stop();
                    return b.update({ 
                        embeds: [successEmbed('👑 Tower Conquered!', `Jackpot Summit Cleared!\nPayout: **+$${currentWinnings.toLocaleString()}**`)], 
                        components: [] 
                    });
                }
                await b.update({ 
                    embeds: [embed.setDescription(`Floor ${currentFloor} clear!\nPending Value: $${currentWinnings.toLocaleString()}`)], 
                    components: buildTower() 
                });
            }
        });
        return;
    }

    if (cmd === 'blackjack') {
        user.balance -= amount; 
        saveDatabase(db);
        let player = [games.drawCard(), games.drawCard()], dealer = [games.drawCard(), games.drawCard()];
        const getSum = (h) => h.reduce((a, b) => a + b, 0);
        
        const render = (hide = true) => embed.setTitle('🃏 Blackjack').setColor(0x34495e).setFields(
            { name: `Your Hand (${getSum(player)})`, value: player.join(', '), inline: true }, 
            { name: `Dealer (${hide ? '?' : getSum(dealer)})`, value: hide ? `${dealer[0]}, ❓` : dealer.join(', '), inline: true }
        );
        
        const btns = () => [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bj_h').setLabel('Hit').setStyle(ButtonStyle.Success), 
            new ButtonBuilder().setCustomId('bj_s').setLabel('Stand').setStyle(ButtonStyle.Danger)
        )];

        const msg = await interaction.reply({ embeds: [render(true)], components: btns(), fetchReply: true });
        const col = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
        
        col.on('collect', async b => {
            if (b.user.id !== userId) return b.reply({ content: 'Not yours!', ephemeral: true });
            
            if (b.customId === 'bj_h') {
                player.push(games.drawCard());
                if (getSum(player) > 21) { 
                    col.stop(); 
                    return b.update({ 
                        embeds: [render(false).setColor(0xe74c3c).setDescription(`Bust over 21!\nLoss: -$${amount.toLocaleString()}`)], 
                        components: [] 
                    }); 
                }
                return b.update({ embeds: [render(true)] });
            }
            
            if (b.customId === 'bj_s') {
                col.stop(); 
                while (getSum(dealer) < 17) dealer.push(games.drawCard());
                const p = getSum(player), d = getSum(dealer), fDB = getDatabase();
                const out = render(false);
                
                if (d > 21 || p > d) { 
                    fDB[userId].balance += amount * 2; 
                    out.setColor(0x2ecc71).setDescription(`**You Win!** Winnings: +$${amount.toLocaleString()}`); 
                } else if (d > p) { 
                    out.setColor(0xe74c3c).setDescription(`**House Wins.** Loss: -$${amount.toLocaleString()}`); 
                } else { 
                    fDB[userId].balance += amount; 
                    out.setColor(0xf1c40f).setDescription('Push. Tie round.'); 
                }
                saveDatabase(fDB); 
                return b.update({ embeds: [out], components: [] });
            }
        });
        return;
    }

    saveDatabase(db);
    return interaction.reply({ embeds: [embed] });
});

client.login(process.env.DISCORD_TOKEN);
