// games.js
// This handles the math and logic engines for all 7 casino games

module.exports = {
    // 50/50 flip (48% win odds)
    playCoinflip: () => Math.random() < 0.48,

    // Roulette wheel mechanic
    playRoulette: (choice) => {
        const roll = Math.floor(Math.random() * 15);
        let landed = 'black';
        if (roll === 0) landed = 'green';
        else if (roll % 2 === 0) landed = 'red';
        return { landed, win: choice === landed };
    },

    // Chicken / Roast simulator
    playChicken: (bones) => {
        const safeChance = (25 - bones) / 25;
        return Math.random() < (safeChance - 0.03);
    },

    // Instant Crash multiplier logic
    playCrash: () => {
        const crash = Math.random() < 0.08 ? 1.0 : parseFloat((Math.pow(Math.random(), -0.95)).toFixed(2));
        const cashout = parseFloat((1.1 + Math.random() * 2.5).toFixed(2));
        return { crash, cashout, win: cashout < crash };
    },

    // Setup function for Mines board
    generateMinesBoard: (bombs) => {
        const board = Array(25).fill('💎');
        let placed = 0;
        while (placed < bombs) {
            const idx = Math.floor(Math.random() * 25);
            if (board[idx] !== '💣') { board[idx] = '💣'; placed++; }
        }
        return board;
    },

    // Draw single card (1-10) for Blackjack
    drawCard: () => Math.floor(Math.random() * 10) + 1
};
