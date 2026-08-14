import { config } from '../../config.js';
import { acceptQueue } from '../../services/adminQueueService.js';
import { userSessions } from '../../handlers/messageHandler.js';

export function getAdminName(sender, fallbackPushName) {
  const rawSender = (sender || '').toLowerCase();
  const cleanSender = rawSender.replace(/[^0-9]/g, '');

  // 1. Cek pencocokan langsung di config.admins (berdasarkan nomor HP, LID, atau string JID)
  if (Array.isArray(config.admins) && config.admins.length > 0) {
    for (const admin of config.admins) {
      if (!admin) continue;
      const adminNum = String(admin.number || '').trim().toLowerCase();
      const adminLid = String(admin.lid || '').trim().toLowerCase();
      const cleanNum = adminNum.replace(/[^0-9]/g, '');
      const cleanLid = adminLid.replace(/[^0-9]/g, '');

      if (
        (adminNum && rawSender.includes(adminNum)) ||
        (adminLid && rawSender.includes(adminLid)) ||
        (cleanNum && cleanNum.length >= 5 && cleanSender.includes(cleanNum.startsWith('0') ? '62' + cleanNum.slice(1) : cleanNum)) ||
        (cleanLid && cleanLid.length >= 5 && cleanSender.includes(cleanLid))
      ) {
        if (admin.name) return admin.name;
      }
    }
  }

  // 2. Jika pengirim cocok dengan config.ownerNumber (misal pengirim menggunakan LID WhatsApp)
  if (Array.isArray(config.ownerNumber) && config.ownerNumber.length > 0) {
    const isOwnerSender = config.ownerNumber.some(num => {
      const rawNum = String(num || '').trim().toLowerCase();
      if (!rawNum) return false;
      if (rawSender.includes(rawNum)) return true;
      const cleanNum = rawNum.replace(/[^0-9]/g, '');
      if (cleanNum && cleanSender.includes(cleanNum.startsWith('0') ? '62' + cleanNum.slice(1) : cleanNum)) {
        return true;
      }
      return false;
    });

    if (isOwnerSender) {
      // Cek apakah ada nomor HP owner yang cocok dengan nama di config.admins
      if (Array.isArray(config.admins)) {
        for (const ownerNum of config.ownerNumber) {
          const cleanOwnerNum = String(ownerNum).replace(/[^0-9]/g, '');
          for (const admin of config.admins) {
            const cleanAdminNum = String(admin.number || '').replace(/[^0-9]/g, '');
            if (cleanOwnerNum && cleanAdminNum && (cleanOwnerNum.includes(cleanAdminNum) || cleanAdminNum.includes(cleanOwnerNum))) {
              if (admin.name) return admin.name;
            }
          }
        }
      }
      // Jika tidak ada di config.admins, kembalikan config.ownerName
      if (config.ownerName) return config.ownerName;
    }
  }

  // 3. Fallback: utamakan config.ownerName daripada WhatsApp pushName profil ponsel
  return config.ownerName || fallbackPushName || 'Admin';
}

export const command = {
  name: 'terima',
  aliases: ['acc', 'accept', 'konfirmasi'],
  category: 'general',
  description: 'Admin menerima/mengonfirmasi nomor antrian chat pelanggan',
  execute: async ({ sock, msg, args, sender, isOwner, reply }) => {
    if (!isOwner) {
      console.warn(`[TERIMA DENIED] Sender (${sender}) is not recognized as owner/admin.`);
      return await reply(
        `⚠️ *Perintah ini hanya dapat dijalankan oleh Admin / Owner.*\n\n` +
        `📌 *ID Sender Anda:* \`${sender}\`\n` +
        `💡 _Pastikan ID / nomor di atas telah terdaftar di \`config.admins\` atau \`config.ownerNumber\` dalam file config.js._`
      );
    }

    if (!args[0]) {
      return await reply(
        `⚠️ *Harap masukkan nomor antrian yang ingin diterima.*\n\n` +
        `📌 *Contoh:* \`.terima 1\` atau \`.acc 1\`\n` +
        `💡 Ketik \`.antrian\` untuk melihat daftar antrian aktif.`
      );
    }

    const queueId = args[0].replace(/[^0-9]/g, '');
    if (!queueId) {
      return await reply('⚠️ Nomor antrian harus berupa angka (misal: `.terima 1`).');
    }

    const adminName = getAdminName(sender, msg.pushName);
    const additionalJids = [sender, msg.key.remoteJid, msg.key.participant].filter(Boolean);
    const result = acceptQueue(queueId, sender, adminName, additionalJids);

    if (!result.success) {
      if (result.reason === 'NOT_FOUND') {
        return await reply(`⚠️ Nomor antrian *#${queueId}* tidak ditemukan dalam daftar antrian.`);
      }
      if (result.reason === 'ALREADY_TAKEN') {
        return await reply(`⚠️ Nomor antrian *#${queueId}* sudah diambil oleh (~${result.takenByAdminName || 'Admin Lain'}).`);
      }
      if (result.reason === 'ADMIN_BUSY') {
        return await reply(
          `⚠️ Anda masih dalam sesi chat aktif dengan user *${result.activeSession.userName}*.\n` +
          `Ketik \`.endchat\` terlebih dahulu untuk mengakhiri sesi saat ini.`
        );
      }
      if (result.reason === 'USER_BUSY') {
        return await reply(`⚠️ Pengguna antrian *#${queueId}* sudah terhubung dengan admin lain.`);
      }
      return await reply('⚠️ Gagal menerima antrian.');
    }

    userSessions[result.userJid] = { step: 'CONNECTED_TO_ADMIN', adminJid: sender, adminName };

    // 1. Konfirmasi ke Admin yang menerima
    await reply(
      `✅ *BERHASIL TERHUBUNG DENGAN PELANGGAN*\n\n` +
      `📌 *Nomor Antrian:* #${result.session.queueId}\n` +
      `👤 *User:* ${result.userName}\n` +
      `📝 *Pesan User:* "${result.messageText}"\n\n` +
      `💬 Semua pesan yang Anda kirim sekarang akan langsung diteruskan ke user.\n` +
      `💡 _Ketik *.endchat* atau *.tutup* untuk mengakhiri sesi chat._`
    );

    // 2. Beritahu User bahwa sudah terhubung dengan Admin (~adminName)
    try {
      await sock.sendMessage(result.userJid, {
        text: `🎉 *ANDA SUDAH TERHUBUNG KE ADMIN (~${adminName})*\n\n` +
              `📌 *Nomor Antrian:* #${result.session.queueId}\n` +
              `💬 Silakan sampaikan pertanyaan atau kendala Anda di sini.\n` +
              `Bot akan bertindak sebagai perantara langsung ke Admin.\n\n` +
              `💡 _Ketik *batal* atau *.endchat* untuk mengakhiri sesi chat._`
      });
    } catch (err) {
      console.error(`[TERIMA CMD ERROR] Gagal mengirim pesan ke user (${result.userJid}):`, err.message);
    }
  }
};
