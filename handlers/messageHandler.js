import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { config } from '../config.js';
import { picoClawService } from '../services/picoClawService.js';
import { isPicoClawConnected } from '../services/picoClaw.js';
import { checkStatusStrict, buildDbContext } from '../services/servisService.js';
import {
  createQueue,
  getWaitingQueues,
  getUserQueue,
  getUserActiveSession,
  getAdminActiveSession,
  endSession
} from '../services/adminQueueService.js';

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

2️⃣  *Hubungi Admin / CS*
└ Dapatkan nomor antrian & konsultasi langsung dengan Admin

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

    const cleanSender = (sender || '').replace(/[^0-9]/g, '');
    const cleanRemoteJid = (remoteJid || '').replace(/[^0-9]/g, '');

    const isOwner = Boolean(
      msg.key.fromMe ||
      (Array.isArray(config.ownerNumber) && config.ownerNumber.some(num => {
        const rawNum = String(num || '').trim().toLowerCase();
        if (!rawNum) return false;

        const rawSender = (sender || '').toLowerCase();
        const rawRemote = (remoteJid || '').toLowerCase();
        const rawParticipant = (msg.key.participant || '').toLowerCase();

        // 1. Match direct LID or JID string (e.g. '265769036296420')
        if (rawSender.includes(rawNum) || rawRemote.includes(rawNum) || rawParticipant.includes(rawNum)) {
          return true;
        }

        // 2. Match cleaned numeric phone number (e.g. '6281992750353')
        const cleanNum = rawNum.replace(/[^0-9]/g, '');
        if (cleanNum) {
          let formattedNum = cleanNum;
          if (formattedNum.startsWith('0')) {
            formattedNum = '62' + formattedNum.slice(1);
          }
          if (cleanSender.includes(formattedNum) || cleanRemoteJid.includes(formattedNum)) {
            return true;
          }
        }

        return false;
      }))
    );

    const prefix = config.prefix || '.';
    const lowerBody = body.trim().toLowerCase();
    const isCommand = body.startsWith(prefix);

    // Helper reply function
    const reply = async (text) => {
      return await sock.sendMessage(remoteJid, { text }, { quoted: msg });
    };

    // -------------------------------------------------------------
    // A. APABILA SEDANG DALAM SESI PERANTARA / RELAY CHAT (ADMIN <-> USER)
    // -------------------------------------------------------------
    const activeUserSession = getUserActiveSession(remoteJid);
    const activeAdminSession = getAdminActiveSession(sender, [remoteJid, msg.key.participant]);

    // 1. PESAN DARI USER YANG TERHUBUNG DENGAN ADMIN
    if (activeUserSession) {
      if (lowerBody === 'batal' || lowerBody === 'menu' || lowerBody === '.endchat' || lowerBody === '.tutup' || lowerBody === '.selesai') {
        const res = endSession(remoteJid);
        delete userSessions[remoteJid];
        await reply(`ℹ️ Sesi chat dengan Admin (~${activeUserSession.adminName}) telah diakhiri.\n\n💡 Ketik *menu* untuk kembali ke menu utama.`);
        try {
          await sock.sendMessage(activeUserSession.adminJid, {
            text: `ℹ️ Sesi chat dengan user *${activeUserSession.userName}* telah diakhiri oleh pengguna.`
          });
        } catch (e) {
          console.error('[RELAY END ERR]', e.message);
        }
        return;
      }

      // Teruskan pesan user ke Admin (Bot sebagai perantara)
      try {
        await sock.sendMessage(activeUserSession.adminJid, {
          text: `💬 *[Pesan dari ${activeUserSession.userName}]*: ${body}`
        });
      } catch (e) {
        console.error('[RELAY USER->ADMIN ERR]', e.message);
        await reply('⚠️ Gagal meneruskan pesan ke Admin.');
      }
      return; // BEBAS DARI PICOCLAW AI
    }

    // 2. PESAN DARI ADMIN YANG TERHUBUNG DENGAN USER
    if (activeAdminSession) {
      // Jika admin mengetik perintah mengakhiri chat
      if (lowerBody === '.endchat' || lowerBody === '.tutup' || lowerBody === '.selesai' || lowerBody === 'batal') {
        const res = endSession(sender);
        await reply(`ℹ️ Anda telah mengakhiri sesi chat dengan user *${activeAdminSession.userName}*.`);
        try {
          await sock.sendMessage(activeAdminSession.userJid, {
            text: `ℹ️ Sesi chat telah diakhiri oleh Admin (~${activeAdminSession.adminName}). Terima kasih telah menghubungi CS Wahyu Elektronik!\n\n💡 Ketik *menu* untuk kembali ke menu utama.`
          });
          delete userSessions[activeAdminSession.userJid];
        } catch (e) {
          console.error('[RELAY END ERR]', e.message);
        }
        return;
      }

      // Jika admin mengetik perintah bot lain (contoh: .antrian, .terima, .ping), biarkan diproses oleh command handler
      if (!isCommand) {
        // Teruskan pesan admin ke User (Bot sebagai perantara)
        try {
          await sock.sendMessage(activeAdminSession.userJid, {
            text: `💬 *[Admin ~${activeAdminSession.adminName}]*: ${body}`
          });
        } catch (e) {
          console.error('[RELAY ADMIN->USER ERR]', e.message);
          await reply('⚠️ Gagal meneruskan pesan ke User.');
        }
        return; // BEBAS DARI PICOCLAW AI
      }
    }

    // -------------------------------------------------------------
    // B. APABILA USER SEDANG DALAM ANTRIAN (MENUNGGU ADMIN TERIMA)
    // -------------------------------------------------------------
    const userQueue = getUserQueue(remoteJid);
    if (userQueue) {
      if (lowerBody === 'batal' || lowerBody === 'menu' || lowerBody === '.endchat' || lowerBody === '.tutup') {
        endSession(remoteJid);
        delete userSessions[remoteJid];
        await reply(`ℹ️ Permintaan antrian Chat Admin Anda (#${userQueue.queueId}) telah dibatalkan.\n\n` + getWelcomeMenuText());
        return;
      } else {
        await reply(
          `⏳ Anda saat ini dalam antrian *#${userQueue.queueId}*.\n` +
          `📝 *Pesan Anda:* "${userQueue.messageText}"\n\n` +
          `Mohon tunggu Admin mengonfirmasi antrian Anda.\n` +
          `💡 _Ketik *batal* jika ingin membatalkan antrian._`
        );
        return; // BEBAS DARI PICOCLAW AI
      }
    }

    // -------------------------------------------------------------
    // C. WELCOMING & NAVIGASI MENU UTAMA
    // -------------------------------------------------------------

    // 1. CEK PENGGUNA PERTAMA KALI (WELCOMING MENU) - SKIP UNTUK COMMAND / OWNER
    if (!seenUsers.has(remoteJid) && !isGroup && !isCommand && !isOwner) {
      seenUsers.add(remoteJid);
      userSessions[remoteJid] = { step: 'AWAITING_MENU_CHOICE' };
      return await reply(getWelcomeMenuText());
    }

    // 2. NAVIGASI KEMBALI KE MENU UTAMA
    if (lowerBody === 'menu' || lowerBody === 'help' || lowerBody === '0' || lowerBody === 'batal' || lowerBody === `${config.prefix}menu` || lowerBody === `${config.prefix}help`) {
      seenUsers.add(remoteJid);
      userSessions[remoteJid] = { step: 'AWAITING_MENU_CHOICE' };
      return await reply(getWelcomeMenuText());
    }

    // 3. PILIHAN MENU 1: CEK STATUS SERVIS
    if (lowerBody === '1' || lowerBody === 'cek status' || lowerBody === 'status' || lowerBody === `${config.prefix}status`) {
      userSessions[remoteJid] = { step: 'AWAITING_SERVICE_ID' };
      return await reply(
        `🔎 *CEK STATUS SERVIS*\n\n` +
        `Silakan masukkan *ID Servis* Anda.\n` +
        `📌 *Contoh:* \`WE-11183650\`\n\n` +
        `💡 _Ketik *menu* untuk kembali._`
      );
    }

    // 4. ALUR BOT UNTUK MENU 1 (INPUT SERVICE ID)
    const currentSession = userSessions[remoteJid];
    if (currentSession && currentSession.step === 'AWAITING_SERVICE_ID') {
      const inputId = body.trim();
      delete userSessions[remoteJid]; // Selesai alur cek status

      try {
        const results = await checkStatusStrict(inputId);

        if (!results || results.length === 0) {
          const notFoundText = `⚠️ *Data status servis tidak ditemukan.*\n\nID Servis \`${inputId}\` tidak ditemukan pada data barang masuk, selesai, maupun diambil.\n\n💡 _Ketik *1* untuk coba lagi, ketik *2* untuk hubungi CS/Admin, atau ketik *menu* untuk kembali._`;
          return await reply(notFoundText);
        }

        let text = `📋 *INFORMASI STATUS SERVIS*\n\n`;
        results.forEach((item, idx) => {
          text += `🆔 *ID Servis*  : \`${item.service_id}\`\n`;
          text += `👤 *Pelanggan*  : ${item.nama}\n`;
          text += `📱 *Unit Barang*: ${item.nama_barang} (${item.kategori})\n`;
          text += `🔧 *Kendala*    : ${item.kerusakan}\n`;
          text += `📌 *Status*     : ${item.statusLabel}\n`;

          if (item.type === 'masuk') {
            text += `📅 *Tgl Masuk*  : ${item.tanggal_masuk}\n`;
            text += `💰 *Biaya*      : ${item.biaya}\n`;
          } else if (item.type === 'selesai') {
            text += `📝 *Perbaikan*  : ${item.catatan}\n`;
            text += `📅 *Tgl Selesai*: ${item.tanggal_selesai}\n`;
            text += `💰 *Total Biaya*: *${item.biaya}*\n`;
            if (item.teknisi !== '-') text += `👨‍🔧 *Teknisi*   : ${item.teknisi}\n`;
          } else if (item.type === 'diambil') {
            text += `📅 *Tgl Diambil*: ${item.tanggal_diambil}\n`;
            text += `💰 *Total Biaya*: *${item.biaya}*\n`;
            text += `🛡️ *Garansi*    : ${item.garansi}\n`;
          }

          if (idx < results.length - 1) text += `\n───────────────────\n\n`;
        });

        text += `\n💡 _Ketik *2* untuk konsultasi CS/Admin, atau ketik *menu* untuk kembali._`;
        return await reply(text.trim());

      } catch (err) {
        console.error('[DB STATUS ERROR]', err.message);
        return await reply(`⚠️ Terjadi kesalahan saat membaca data dari database Laragon.`);
      }
    }

    // 5. PILIHAN MENU 2: CHAT ADMIN (USER DIMINTA MASUKKAN ISI PESAN DAHULU)
    if (lowerBody === '2' || lowerBody === 'admin' || lowerBody === 'chat admin' || lowerBody === `${config.prefix}admin`) {
      userSessions[remoteJid] = { step: 'AWAITING_ADMIN_QUEUE_MSG' };
      return await reply(
        `💬 *HUBUNGI ADMIN / CS*\n\n` +
        `Silakan ketik / masukkan *isi pesan* atau kendala yang ingin Anda sampaikan kepada Admin:\n\n` +
        `💡 _Ketik *batal* untuk kembali ke menu utama._`
      );
    }

    // 6. ALUR BOT UNTUK MENU 2 (USER MENGIRIM ISI PESAN -> DAPAT NO ANTRIAN)
    if (currentSession && currentSession.step === 'AWAITING_ADMIN_QUEUE_MSG') {
      const messageText = body.trim();
      const userName = msg.pushName || 'Pengguna WA';

      // Buat antrian baru
      const { queue } = createQueue(remoteJid, userName, messageText);
      userSessions[remoteJid] = { step: 'WAITING_FOR_ADMIN', queueId: queue.queueId };

      // 1. Pesan Konfirmasi ke User
      await reply(
        `📋 *KONFIRMASI ANTRIAN CHAT ADMIN*\n\n` +
        `📌 *Nomor Antrian:* #${queue.queueId}\n` +
        `📝 *Isi Pesan:* "${queue.messageText}"\n` +
        `⏳ *Status:* Menunggu konfirmasi Admin...\n\n` +
        `Mohon tunggu sebentar, Admin akan segera menerima antrian Anda.\n` +
        `💡 _Ketik *batal* untuk membatalkan antrian._`
      );

      // 2. Kirim Notifikasi ke Semua Nomor Admin / Owner
      const adminTargets = [];
      if (Array.isArray(config.admins)) {
        config.admins.forEach(a => { if (a && a.number) adminTargets.push(a.number); });
      }
      if (Array.isArray(config.ownerNumber)) {
        config.ownerNumber.forEach(n => { if (n) adminTargets.push(n); });
      }
      const uniqueAdminTargets = [...new Set(adminTargets)];

      for (const num of uniqueAdminTargets) {
        const ownerJid = num.includes('@') ? num : `${num.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        try {
          await sock.sendMessage(ownerJid, {
            text: `🔔 *PERMINTAAN CHAT ADMIN BARU!*\n\n` +
                  `📌 *Nomor Antrian:* #${queue.queueId}\n` +
                  `👤 *Pelanggan:* ${queue.userName} (${remoteJid.split('@')[0]})\n` +
                  `📝 *Isi Pesan:* "${queue.messageText}"\n\n` +
                  `👉 _Ketik \`.terima ${queue.queueId}\` / \`.acc ${queue.queueId}\` untuk menerima, atau \`.tolak ${queue.queueId} <alasan>\` untuk menolak._`
          });
        } catch (err) {
          console.error(`[QUEUE NOTIFY ERR] Gagal mengirim notifikasi ke admin ${ownerJid}:`, err.message);
        }
      }

      return; // BEBAS DARI PICOCLAW AI
    }

    // -------------------------------------------------------------
    // D. COMMAND HANDLER (.ping, .terima, .antrian, .endchat, dll)
    // -------------------------------------------------------------
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

    // -------------------------------------------------------------
    // E. APABILA BUKAN MENU 2 / ANTRIAN / SESI CS -> TERUSKAN KE PICOCLAW AI
    // -------------------------------------------------------------
    if (config.picoClaw?.enabled && (config.picoClaw.autoChat !== false)) {
      if (isGroup && config.picoClaw.groupAutoChat === false) return;

      if (isPicoClawConnected()) {
        picoClawService.setLastTarget(remoteJid);

        // Ambil konteks database resmi dari Laragon (status servis & estimasi biaya)
        const dbContext = await buildDbContext(body);
        const systemInstruction = `[PERAN & BATASAN CS AI WAHYU ELEKTRONIK]:
1. Anda adalah CS AI resmi Service Center Wahyu Elektronik yang ramah, sopan, to the point, dan membantu.
2. Tugas Anda melayani chat/obrolan pelanggan di luar pilihan menu otomatis (lokasi toko, jam buka, prosedur servis, estimasi biaya, garansi, kendala teknis elektronik).
3. PANDUAN NAVIGASI MENU BOT:
   - Apabila pelanggan menanyakan cara melihat menu, meminta pilihan layanan, atau ingin menggunakan fitur otomatis bot, beri petunjuk berikut:
     • Ketik "menu" atau "0" untuk kembali ke Menu Utama.
     • Ketik "1" untuk Cek Status Servis (masukkan ID Servis).
     • Ketik "2" atau "admin" untuk Hubungi Admin / CS Manusia.
4. ESTIMASI KEBUTUHAN BANTUAN ADMIN:
   - Analisis apakah pesan/kendala pelanggan memerlukan penanganan langsung dari Admin manusia (seperti: komplain, negosiasi harga khusus, konsultasi kerusakan rumit, garansi khusus, atau jika pelanggan secara eksplisit ingin berbicara dengan Admin/Manusia).
   - Jika Anda memperkirakan pelanggan PERLU bantuan Admin, berikan jawaban awal yang membantu DAN akhiri dengan saran berikut:
     "💡 _Jika Anda membutuhkan bantuan/konsultasi langsung dari Admin kami, silakan ketik *2* atau *admin* untuk masuk ke antrian Chat Admin._"
5. BATASAN TOPIK:
   - DILARANG MENJAWAB pertanyaan di luar seputar toko (seperti cuaca, berita, politik, resep, dll). Tolak dengan ramah dan tawarkan bantuan seputar Wahyu Elektronik.
6. Jawablah secara SINGKAT, SIMPEL, RAMAH, dan RAPI.`;

        const promptWithContext = dbContext 
          ? `${systemInstruction}\n${dbContext}\n\n[PERTANYAAN PELANGGAN]: "${body}"` 
          : `${systemInstruction}\n\n[PERTANYAAN PELANGGAN]: "${body}"`;

        const sent = picoClawService.send({
          chatId: remoteJid,
          senderId: sender,
          content: promptWithContext,
          text: promptWithContext,
          body: promptWithContext,
          message: promptWithContext,
          prompt: promptWithContext,
          channel: 'whatsapp',
          type: 'message',
          from: remoteJid,
          user: remoteJid,
          target: remoteJid,
          senderName: msg.pushName || 'Pengguna WA'
        });

        if (sent) {
          console.log(`[PicoClaw AutoChat + DB Context] 🚀 Pesan dari ${sender} ("${body}") & Konteks Database Laragon diteruskan ke PicoClaw`);
        }
      }
    }

  } catch (err) {
    console.error(`[ERROR] Message handler error:`, err);
  }
}
