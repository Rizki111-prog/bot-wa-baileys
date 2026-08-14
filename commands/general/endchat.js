import { endSession } from '../../services/adminQueueService.js';
import { userSessions } from '../../handlers/messageHandler.js';

export const command = {
  name: 'endchat',
  aliases: ['tutup', 'selesai', 'closechat'],
  category: 'general',
  description: 'Mengakhiri sesi chat CS / Admin yang sedang berlangsung',
  execute: async ({ sock, sender, reply }) => {
    const result = endSession(sender);

    if (!result.success) {
      return await reply('⚠️ Anda tidak sedang dalam sesi chat aktif atau antrian CS Admin.');
    }

    if (result.cancelledQueue) {
      delete userSessions[sender];
      return await reply('ℹ️ Permintaan antrian Chat Admin Anda telah berhasil dibatalkan.');
    }

    if (result.session) {
      const { userJid, adminJid, userName, adminName } = result.session;
      delete userSessions[userJid];
      const isSenderAdmin = sender === adminJid || sender.includes(adminJid.split('@')[0]);

      if (isSenderAdmin) {
        await reply(`ℹ️ Anda telah mengakhiri sesi chat dengan user *${userName}*.`);
        try {
          await sock.sendMessage(userJid, {
            text: `ℹ️ Sesi chat telah diakhiri oleh Admin (~${adminName}). Terima kasih telah menghubungi CS Wahyu Elektronik!\n\n💡 _Ketik *menu* untuk kembali ke menu utama._`
          });
        } catch (err) {
          console.error('[ENDCHAT ERR]', err.message);
        }
      } else {
        await reply(`ℹ️ Sesi chat dengan Admin (~${adminName}) telah diakhiri.\n\n💡 _Ketik *menu* untuk kembali ke menu utama._`);
        try {
          await sock.sendMessage(adminJid, {
            text: `ℹ️ Sesi chat dengan user *${userName}* telah diakhiri oleh pengguna.`
          });
        } catch (err) {
          console.error('[ENDCHAT ERR]', err.message);
        }
      }
    }
  }
};
