import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { Boom } from '@hapi/boom';
import { config } from './config.js';
import { loadCommands, handleMessage } from './handlers/messageHandler.js';

async function startBot() {
  console.log(`[SYS] Initializing ${config.botName}...`);

  // Load commands
  await loadCommands();

  // Auth State
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`[SYS] Using Baileys v${version.join('.')}`);

  const makeWASocketFunc = typeof makeWASocket === 'function' ? makeWASocket : makeWASocket.default;

  const sock = makeWASocketFunc({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    generateHighQualityLinkPreview: true,
  });

  // Save Credentials on update
  sock.ev.on('creds.update', saveCreds);

  // Connection Updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n====================================================');
      console.log('  SCAN QR CODE BELOW TO CONNECT BOT TO WHATSAPP');
      console.log('====================================================\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      console.log(`[CONN] Connection closed. Reason code: ${reason}`);

      if (reason === DisconnectReason.loggedOut) {
        console.log('[CONN] Device Logged Out, Please Delete Session Folder and Scan Again.');
      } else {
        console.log('[CONN] Reconnecting...');
        startBot();
      }
    } else if (connection === 'open') {
      console.log('\n====================================================');
      console.log(`🤖 ${config.botName} IS CONNECTED & READY!`);
      console.log(`👤 Owner: ${config.ownerName}`);
      console.log(`📌 Prefix: ${config.prefix}`);
      console.log('====================================================\n');
    }
  });

  // Incoming Messages
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe) {
          await handleMessage(sock, msg);
        }
      }
    }
  });
}

startBot().catch((err) => {
  console.error('[FATAL] Failed to start bot:', err);
});
