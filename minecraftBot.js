// Mineflayer starter. Configure the environment variables in Railway.
// Do not put account passwords, tokens, or session files in source control.

const mineflayer = require('mineflayer');

const host = process.env.MC_HOST;
const port = Number(process.env.MC_PORT || 25565);
const username = process.env.MC_USERNAME;
const version = process.env.MC_VERSION || false;

if (!host || !username) {
  console.error('Missing required environment variables: MC_HOST and MC_USERNAME.');
  process.exit(1);
}

let bot;
let reconnectTimer;
let stopping = false;

function connect() {
  console.log(`Connecting to ${host}:${port} as ${username}...`);

  bot = mineflayer.createBot({
    host,
    port,
    username,
    auth: 'microsoft',
    version
  });

  bot.once('spawn', () => {
    console.log('Minecraft bot connected successfully.');
  });

  bot.on('message', (message) => {
    // Logs chat for setup/testing. Do not treat chat text alone as proof of payment.
    console.log('[Minecraft chat]', message.toString());
  });

  bot.on('kicked', (reason) => {
    console.error('[Minecraft kicked]', reason);
  });

  bot.on('error', (err) => {
    console.error('[Minecraft error]', err.message);
  });

  bot.once('end', () => {
    console.warn('Minecraft connection ended.');
    if (!stopping) {
      const delay = Number(process.env.RECONNECT_DELAY_MS || 15000);
      console.log(`Reconnecting in ${delay}ms...`);
      reconnectTimer = setTimeout(connect, delay);
    }
  });
}

function stop() {
  stopping = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (bot) bot.quit('Service shutting down');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

connect();
