require('dotenv').config();

console.log("[SYSTEM] Starting Bedrock-to-Discord Casino Network...");

// Boot up the Bedrock client
require('./minecraftBot.js');

// Boot up the Discord engine
require('./discordBot.js');
