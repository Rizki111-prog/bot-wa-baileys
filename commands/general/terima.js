import { config } from '../../config.js';
import { acceptQueue } from '../../services/adminQueueService.js';
import { userSessions } from '../../handlers/messageHandler.js';

export function getAdminName(sender, fallbackPushName) {
  if (Array.isArray(config.admins) && config.admins.length > 0) {
    const rawSender = (sender || '').toLowerCase();
    const cleanSender = rawSender.replace(/[^0-9]/g, '');

    for (const admin of config.admins) {
      if (!admin || !admin.number) continue;
      const rawNum = String(admin.number).trim().toLowerCase();
      const cleanNum = rawNum.replace(/[^0-9]/g, '');

      if (rawSender.includes(rawNum)) {
        return admin.name || fallbackPushName || 'Admin';
      }

      if (cleanNum) {
        let formattedNum = cleanNum.startsWith('0') ? '62' + cleanNum.slice(1) : cleanNum;
        if (cleanSender.includes(formattedNum)) {
          return admin.name || fallbackPushName || 'Admin';
        }
      }
    }
  }

  return fallbackPushName || config.ownerName || 'Admin';
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
