import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { config } from '../config.js';
import { picoClawService } from '../services/picoClawService.js';
import { isPicoClawConnected } from '../services/picoClaw.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const commands = new Map();
export const seenUsers = new Set();
export const userSessions = {};

export function getWelcomeMenuText() {
  return `⚡ *SERVICE CENTER WAHYU ELEKTRONIK* ⚡

Silakan ketik *angka pilihan* di bawah ini:

1️⃣  *Cek Status Servis*
└ Cek pengerjaan & status unit Anda

2️⃣  *Hubungi Admin / Teknisi*
└ Konsultasi langsung dengan CS / AI

📍 _Jl. Toko Servis Laragon_
⏰ _Senin - Sabtu (08.00 - 17.00 WIB)_

💡 _Ketik angka *1* atau *2* untuk memilih._`;
}

// Dynamic Command Loader
export async function loadCommands() {
  commands.clear();
  const commandsPath = path.join(__dirname, '../commands');

  if (!fs.existsSync(commandsPath)) return;

  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const fileUrl = pathToFileURL(filePath).href;
      
      try {
        const module = await import(fileUrl);
        if (module.command && module.command.name) {
          const cmd = module.command;
          commands.set(cmd.name.toLowerCase(), cmd);
          if (Array.isArray(cmd.aliases)) {
            for (const alias of cmd.aliases) {
              commands.set(alias.toLowerCase(), cmd);
            }
          }
        }
      } catch (err) {
        console.error(`[HANDLER] Failed to load command ${file}:`, err);
      }
    }
  }

  console.log(`[HANDLER] Loaded ${commands.size} commands successfully.`);
}

export async function handleMessage(sock, msg) {
  try {
    if (!msg.message) return;

    // Extract message body across standard and button/interactive message types
    const messageType = Object.keys(msg.message)[0];
    let body = '';

    if (messageType === 'conversation') {
      body = msg.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
      body = msg.message.extendedTextMessage.text;
    } else if (messageType === 'imageMessage') {
      body = msg.message.imageMessage.caption;
    } else if (messageType === 'videoMessage') {
      body = msg.message.videoMessage.caption;
    } else if (messageType === 'buttonsResponseMessage') {
      body = msg.message.buttonsResponseMessage.selectedButtonId || msg.message.buttonsResponseMessage.selectedDisplayText;
    } else if (messageType === 'templateButtonReplyMessage') {
      body = msg.message.templateButtonReplyMessage.selectedId || msg.message.templateButtonReplyMessage.selectedDisplayText;
    } else if (messageType === 'listResponseMessage') {
      body = msg.message.listResponseMessage.singleSelectReply?.selectedRowId || msg.message.listResponseMessage.title;
    } else if (messageType === 'interactiveResponseMessage') {
      try {
        const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson || '{}');
        body = params.id || params.text || '';
      } catch {
        body = '';
      }
    }

    if (!body) return;

    const remoteJid = msg.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const sender = msg.key.participant || remoteJid;
    const isOwner = config.ownerNumber.some(num => sender.includes(num));
    const lowerBody = body.trim().toLowerCase();

    // Helper reply function
    const reply = async (text) => {
      return await sock.sendMessage(remoteJid, { text }, { quoted: msg });
    };

    // 1. CEK PENGGUNA PERTAMA KALI (WELCOMING MENU - BOT TANPA AI)
    if (!seenUsers.has(remoteJid) && !isGroup) {
      seenUsers.add(remoteJid);
      userSessions[remoteJid] = { step: 'AWAITING_MENU_CHOICE' };
      return await reply(getWelcomeMenuText());
    }

    // 2. NAVIGASI KEMBALI KE MENU UTAMA (BOT TANPA AI)
    if (lowerBody === 'menu' || lowerBody === 'help' || lowerBody === '0' || lowerBody === 'batal' || lowerBody === `${config.prefix}menu` || lowerBody === `${config.prefix}help`) {
      seenUsers.add(remoteJid);
      userSessions[remoteJid] = { step: 'AWAITING_MENU_CHOICE' };
      return await reply(getWelcomeMenuText());
    }

    // 3. PILIHAN MENU 1: CEK STATUS SERVIS (DIJALANKAN BOT DENGAN RESPON FORMAL, TANPA CAMPUR TANGAN AI)
    if (lowerBody === '1' || lowerBody === 'cek status' || lowerBody === 'status' || lowerBody === `${config.prefix}status`) {
      userSessions[remoteJid] = { step: 'AWAITING_SERVICE_ID' };
      return await reply(
        `🔎 *CEK STATUS SERVIS*\n\n` +
        `Silakan masukkan *ID Servis* Anda.\n` +
        `📌 *Contoh:* \`WE-11183650\`\n\n` +
        `💡 _Ketik *menu* untuk kembali._`
      );
    }

    // 4. ALUR BOT UNTUK MENU 1 (SAAT PENGGUNA MEMASUKKAN ID SERVIS) -> BOT DIJALANKAN TANPA AI PICOCLAW
    const currentSession = userSessions[remoteJid];
    if (currentSession && currentSession.step === 'AWAITING_SERVICE_ID') {
      const inputId = body.trim();
      delete userSessions[remoteJid]; // Selesai alur cek status

      let statusResponse = `📋 *INFORMASI STATUS SERVIS*\n\n`;
      statusResponse += `🆔 *ID Servis*  : \`${inputId}\`\n`;
      statusResponse += `👤 *Pelanggan*  : ${msg.pushName || 'Pelanggan'}\n`;
      statusResponse += `📱 *Unit Barang*: Unit Elektronik\n`;
      statusResponse += `📌 *Status*     : 🔧 *DALAM PROSES SERVIS*\n`;
      statusResponse += `📅 *Tgl Cek*    : ${new Date().toLocaleDateString('id-ID')}\n\n`;
      statusResponse += `💡 _Pengerjaan unit sedang dalam penanganan teknisi. Ketik *2* untuk hubungi CS/AI, atau ketik *menu* untuk kembali._`;

      console.log(`[BOT STATUS] User ${sender} memeriksa ID Servis: ${inputId} (Bot langsung tanpa AI)`);
      return await reply(statusResponse);
    }

    // 5. PILIHAN MENU 2: CHAT ADMIN / CS AI -> PENGGUNA TERHUBUNG DENGAN PICOCLAW AI
    if (lowerBody === '2' || lowerBody === 'admin' || lowerBody === 'chat admin' || lowerBody === `${config.prefix}admin`) {
      userSessions[remoteJid] = { step: 'CONNECTED_TO_AI' };
      return await reply(
        `💬 *CHAT ADMIN / CS AI*\n\n` +
        `Anda sekarang terhubung dengan Tim Support CS AI Wahyu Elektronik.\n` +
        `Silakan ketik pertanyaan atau kendala Anda di sini!\n\n` +
        `💡 _Ketik *menu* untuk kembali ke menu utama._`
      );
    }

    // 6. PENANGANAN EKSEKUSI COMMAND BERPREFIX (.ping, .owner, dll)
    const prefix = config.prefix;
    const isCommand = body.startsWith(prefix);

    if (isCommand) {
      const args = body.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      if (!config.isPublic && !isOwner) return;

      const command = commands.get(commandName);
      if (command) {
        console.log(`[EXECUTE] Command: ${commandName} | Sender: ${sender} | Group: ${isGroup}`);
        return await command.execute({
          sock,
          msg,
          args,
          prefix,
          commandName,
          body,
          sender,
          isGroup,
          isOwner,
          reply,
          commands
        });
      }
    }

    // 7. APABILA PENGGUNA DALAM SESI CHAT AI / PESAN BIASA -> TERUSKAN KE PICOCLAW AI
    if (config.picoClaw?.enabled && (config.picoClaw.autoChat !== false)) {
      if (isGroup && config.picoClaw.groupAutoChat === false) return;

      if (isPicoClawConnected()) {
        picoClawService.setLastTarget(remoteJid);
        const sent = picoClawService.send({
          chatId: remoteJid,
          senderId: sender,
          content: body,
          text: body,
          body: body,
          message: body,
          prompt: body,
          channel: 'whatsapp',
          type: 'message',
          from: remoteJid,
          user: remoteJid,
          target: remoteJid,
          senderName: msg.pushName || 'Pengguna WA'
        });

        if (sent) {
          console.log(`[PicoClaw AutoChat] 🚀 Pesan dari ${sender} ("${body}") diteruskan ke PicoClaw`);
        }
      }
    }

  } catch (err) {
    console.error(`[ERROR] Message handler error:`, err);
  }
}
