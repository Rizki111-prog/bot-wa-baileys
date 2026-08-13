import { picoClawService } from '../../services/picoClawService.js';

export const command = {
  name: 'pico',
  aliases: ['picoclaw', 'ai'],
  category: 'general',
  description: 'Kirim pesan / prompt ke AI PicoClaw via WebSocket Bridge',
  execute: async ({ sock, msg, args, sender, reply }) => {
    const text = args.join(' ').trim();
    if (!text) {
      return await reply('🤖 *PICOCLAW AI BRIDGE*\n\nSilakan ketik *.pico <pesan Anda>*\n📌 Contoh: `.pico Halo AI PicoClaw, bisa bantu periksa data?`');
    }

    const targetJid = msg.key.remoteJid;
    picoClawService.setLastTarget(targetJid);

    const sent = picoClawService.send({
      chatId: targetJid,
      senderId: sender || targetJid,
      content: text,
      text: text,
      body: text,
      message: text,
      prompt: text,
      channel: 'whatsapp',
      type: 'message',
      from: targetJid,
      user: targetJid,
      target: targetJid,
      senderName: msg.pushName || 'Pengguna WA'
    });

    if (sent) {
      await reply('🚀 Pesan berhasil dikirim ke PicoClaw via WebSocket Bridge!\n⏳ _Menunggu tanggapan dari AI PicoClaw..._');
    } else {
      await reply('⚠️ Gagal mengirim: PicoClaw belum terhubung ke WebSocket Server Bridge (port 3001).');
    }
  }
};
