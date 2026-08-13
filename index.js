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
import { picoClawService } from './services/picoClawService.js';

let currentSock = null;

function formatAiReply(rawText) {
  let cleaned = String(rawText || '').trim();
  cleaned = cleaned
    .replace(/🦞/g, '')
    .replace(/🤖/g, '')
    .replace(/^(\*?\[?PicoClaw AI\]?\*?:?\s*)/gi, '')
    .replace(/^PicoClaw\s*:?\s*/gi, '')
    .trim();

  if (!cleaned) return '';
  if (cleaned.endsWith('-cs ai')) return cleaned;

  return cleaned.includes('\n') ? `${cleaned}\n\n-cs ai` : `${cleaned} -cs ai`;
}


async function startBot() {
  console.log(`[SYS] Initializing ${config.botName}...`);

  // Start PicoClaw WebSocket Server Bridge (Port 3001)
  picoClawService.connect();

  // Listen for incoming messages from PicoClaw and forward to WhatsApp
  picoClawService.on('message', async (data) => {
    console.log('[PicoClaw Bridge] 📩 Raw Data dari PicoClaw:', typeof data === 'object' ? JSON.stringify(data) : data);

    try {
      if (!currentSock) {
        console.warn('[PicoClaw Bridge] ⚠️ WhatsApp socket belum terhubung, menunda pengiriman.');
        return;
      }

      let text = '';
      let target = null;

      if (typeof data === 'object' && data !== null) {
        target = data.chatId || data.senderId || data.to || data.target || data.customerWid || data.user || data.recipient || data.from;
        text = data.content || data.text || data.body || data.message || data.reply || data.response || data.prompt || data.output;

        if (!text && data.result) {
          text = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
        }
      } else if (typeof data === 'string') {
        text = data.trim();
      }

      // Jika data dari PicoClaw tidak menentukan target spesifik, gunakan user WA terakhir
      if (!target) {
        target = picoClawService.getLastTarget();
      }

      if (target && text) {
        let formattedTarget = String(target).trim();
        if (!formattedTarget.includes('@s.whatsapp.net') && !formattedTarget.includes('@g.us') && !formattedTarget.includes('@lid') && !formattedTarget.includes('@c.us')) {
          formattedTarget = `${formattedTarget.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        }

        const replyText = formatAiReply(text);
        await currentSock.sendMessage(formattedTarget, { text: replyText });
        console.log(`[PicoClaw Bridge] ✅ Pesan dari PicoClaw berhasil dikirim ke WhatsApp (${formattedTarget})`);
      } else {
        console.warn('[PicoClaw Bridge] ⚠️ Frame diterima dari PicoClaw tetapi tidak ada teks atau target WhatsApp yang valid.');
      }
    } catch (err) {
      console.error('[PicoClaw Bridge] ❌ Gagal meneruskan pesan dari PicoClaw ke WhatsApp:', err.message);
    }
  });

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

  currentSock = sock;

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
