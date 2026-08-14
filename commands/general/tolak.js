import { config } from '../../config.js';
import { rejectQueue } from '../../services/adminQueueService.js';
import { userSessions, getWelcomeMenuText } from '../../handlers/messageHandler.js';
import { getAdminName } from './terima.js';

export const command = {
  name: 'tolak',
  aliases: ['reject', 'denied', 'abaikan'],
  category: 'general',
  description: 'Admin menolak nomor antrian chat pelanggan dengan alasan opsional',
  execute: async ({ sock, msg, args, sender, isOwner, reply }) => {
    if (!isOwner) {
      console.warn(`[TOLAK DENIED] Sender (${sender}) is not recognized as owner/admin.`);
      return await reply(
        `⚠️ *Perintah ini hanya dapat dijalankan oleh Admin / Owner.*\n\n` +
        `📌 *ID Sender Anda:* \`${sender}\`\n` +
        `💡 _Pastikan ID / nomor di atas telah terdaftar di \`config.admins\` atau \`config.ownerNumber\` dalam file config.js._`
      );
    }

    if (!args[0]) {
      return await reply(
        `⚠️ *Harap masukkan nomor antrian yang ingin ditolak.*\n\n` +
        `📌 *Contoh:* \`.tolak 1\` atau \`.tolak 1 Maaf toko sedang tutup\`\n` +
        `💡 Ketik \`.antrian\` untuk melihat daftar antrian aktif.`
      );
    }

    const queueId = args[0].replace(/[^0-9]/g, '');
    if (!queueId) {
      return await reply('⚠️ Nomor antrian harus berupa angka (misal: `.tolak 1`).');
    }

    const reason = args.slice(1).join(' ');
    const adminName = getAdminName(sender, msg.pushName);
    const result = rejectQueue(queueId, sender, adminName, reason);

    if (!result.success) {
      if (result.reason === 'NOT_FOUND') {
        return await reply(`⚠️ Nomor antrian *#${queueId}* tidak ditemukan dalam daftar antrian.`);
      }
      if (result.reason === 'ALREADY_REJECTED') {
        return await reply(`⚠️ Nomor antrian *#${queueId}* sudah ditolak sebelumnya oleh (~${result.rejectedByAdminName || 'Admin'}).`);
      }
      if (result.reason === 'ALREADY_CONNECTED') {
        return await reply(`⚠️ Nomor antrian *#${queueId}* sudah diterima/dihubungkan oleh (~${result.acceptedByAdminName || 'Admin'}).`);
      }
      return await reply('⚠️ Gagal menolak antrian.');
    }

    // Reset status sesi user
    delete userSessions[result.userJid];

    // 1. Kirim Konfirmasi ke Admin
    await reply(
      `❌ *BERHASIL MENOLAK ANTRIAN*\n\n` +
      `📌 *Nomor Antrian:* #${result.queueItem.queueId}\n` +
      `👤 *User:* ${result.userName}\n` +
      `📝 *Pesan User:* "${result.messageText}"\n` +
      `💬 *Alasan Penolakan:* "${result.reason}"`
    );

    // 2. Kirim Notifikasi Penolakan ke User
    try {
      await sock.sendMessage(result.userJid, {
        text: `❌ *PERMINTAAN CHAT DITOLAK ADMIN*\n\n` +
              `📌 *Nomor Antrian:* #${result.queueItem.queueId}\n` +
              `💬 *Pesan/Alasan Admin (~${adminName}):*\n` +
              `"${result.reason}"\n\n` +
              `💡 _Ketik *menu* untuk kembali ke menu utama._`
      });
    } catch (err) {
      console.error(`[TOLAK CMD ERROR] Gagal mengirim pesan penolakan ke user (${result.userJid}):`, err.message);
    }
  }
};
