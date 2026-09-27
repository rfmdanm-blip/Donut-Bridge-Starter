# DonutSMP Mineflayer Starter

This is a starter project for running a Mineflayer chat client on Railway. It connects using Microsoft authentication and logs Minecraft chat messages.

## Included
- `minecraftBot.js` — connects, logs chat, reports errors, and reconnects after disconnects.
- `package.json` — Node.js project and start command.
- `.env.example` — environment-variable template.
- `.gitignore` — excludes local secrets and dependencies.

## Run locally
1. Install Node.js 20 or newer.
2. In this folder, run `npm install`.
3. Set `MC_HOST`, `MC_PORT`, and `MC_USERNAME` in your shell or a local `.env` file (if using `.env`, install `dotenv` and load it; this starter intentionally does not).
4. Run `npm start`.
5. Complete any Microsoft device-code authentication flow shown in the terminal.

## Deploy on Railway
1. Upload/push this folder to a private GitHub repository.
2. In Railway, create a project and deploy from that repository.
3. In the service's Variables panel, add:
   - `MC_HOST` — server address, without `https://`
   - `MC_PORT` — server port (often `25565`, but use the server's actual port)
   - `MC_USERNAME` — Microsoft account email
   - optionally `MC_VERSION` and `RECONNECT_DELAY_MS`
4. Railway detects `package.json` and runs `npm start`. If needed, set the start command to `npm start`.
5. Check Deploy Logs for connection/authentication messages.

## Important
- A Microsoft account may require an interactive device-code sign-in. Railway is headless, so complete authentication only through the supported flow shown by Mineflayer and confirm that the provider's authentication method works in your hosting environment.
- Never paste passwords, access tokens, or session files into chat, GitHub, or public logs.
- Server rules may restrict automated accounts or bots. Check the server's rules before connecting.
- This starter only reads/logs chat. Chat text is not reliable proof of a payment by itself. Before building deposits or withdrawals, verify the server's permitted automation method and payment confirmation mechanism.
- No Discord bot, database, gambling, or payment automation is included yet.
