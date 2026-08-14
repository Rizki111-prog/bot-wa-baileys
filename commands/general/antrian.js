import { config } from '../../config.js';
import { getWaitingQueues } from '../../services/adminQueueService.js';

export const command = {
  name: 'antrian',
  aliases: ['listantrian', 'queue'],
  category: 'general',
  description: 'Melihat daftar antrian chat CS/Admin yang sedang menunggu',
  execute: async ({ isOwner, reply }) => {
    if (!isOwner) {
      return await reply('⚠️ Perintah ini hanya dapat dijalankan oleh Admin / Owner.');
    }

    const queues = getWaitingQueues();

    if (!queues || queues.length === 0) {
      return await reply(`📋 *DAFTAR ANTRIAN CHAT ADMIN*\n\nSaat ini tidak ada antrian pelanggan yang sedang menunggu.`);
    }

    let text = `📋 *DAFTAR ANTRIAN CHAT ADMIN*\n\n`;
    text += `Terdapat *${queues.length}* antrian yang belum dikonfirmasi:\n\n`;

    queues.forEach((q, idx) => {
      const timeStr = q.createdAt ? new Date(q.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
      text += `*${idx + 1}. Nomor Antrian:* #${q.queueId}\n`;
      text += `   👤 *Pelanggan:* ${q.userName}\n`;
      text += `   📝 *Pesan:* "${q.messageText}"\n`;
      text += `   ⏰ *Waktu:* ${timeStr} WIB\n`;
      text += `   👉 _Ketik \`.terima ${q.queueId}\` atau \`.acc ${q.queueId}\` untuk mengonfirmasi_\n`;
      if (idx < queues.length - 1) text += `\n───────────────────\n\n`;
    });

    return await reply(text.trim());
  }
};
