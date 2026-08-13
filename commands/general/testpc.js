import { config } from '../../config.js';
import { sendToPicoClaw, isPicoClawConnected } from '../../services/picoClaw.js';

export const command = {
  name: 'testpc',
  aliases: ['tespc', 'cekpc'],
  category: 'general',
  description: 'Debug: Uji kirim pesan ke PicoClaw dan cek statusnya',
  execute: async ({ reply, args }) => {
    const testMsg = args.join(' ') || 'Tes koneksi PicoClaw. Tolong balas pesan ini!';
    const isConnected = isPicoClawConnected();

    if (!isConnected) {
      return await reply(
        `❌ *PicoClaw TIDAK terhubung!*\n\n` +
        `Pastikan PicoClaw di Armbian sudah berjalan dan mengkoneksi ke:\n` +
        `ws://<ip-laptop>:${config.picoClaw?.serverPort || 3001}`
      );
    }

    await reply(`🔄 *PicoClaw TERHUBUNG* ✅\nMengirim pesan uji...\n\n_Pesan: "${testMsg}"_\n\nTunggu 5-30 detik untuk respon AI PicoClaw...`);

    try {
      await sendToPicoClaw(testMsg, {
        sender: 'testpc-command',
        chatId: null // will use lastActiveJid
      });
    } catch (err) {
      await reply(`❌ Gagal kirim ke PicoClaw: ${err.message}`);
    }
  }
};
