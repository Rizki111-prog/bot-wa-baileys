import { config } from '../../config.js';

export const command = {
  name: 'button',
  aliases: ['btn', 'tombol'],
  category: 'general',
  description: 'Contoh menu dan tombol interaktif WhatsApp',
  execute: async ({ sock, msg, reply }) => {
    const text = `🔘 *DEMO TOMBOL INTERAKTIF*\n\nBerikut adalah contoh penggunaan tombol (button) pada WhatsApp Bot.\nAnda dapat mengklik salah satu tombol di bawah untuk menjalankan perintah!`;

    const buttons = [
      { buttonId: `${config.prefix}menu`, buttonText: { displayText: '📋 Kembali ke Menu' }, type: 1 },
      { buttonId: `${config.prefix}ping`, buttonText: { displayText: '⚡ Cek Ping' }, type: 1 },
      { buttonId: `${config.prefix}owner`, buttonText: { displayText: '👤 Info Owner' }, type: 1 }
    ];

    try {
      await sock.sendMessage(msg.key.remoteJid, {
        text: text,
        footer: `🤖 ${config.botName}`,
        buttons: buttons,
        headerType: 1
      }, { quoted: msg });
    } catch (err) {
      // Fallback text if buttons are blocked by WhatsApp server on current session
      let fallbackText = `${text}\n\n`;
      fallbackText += `*Pilihan Menu Quick Action:*\n`;
      fallbackText += `1. *${config.prefix}menu* - Kembali ke Menu\n`;
      fallbackText += `2. *${config.prefix}ping* - Cek Ping\n`;
      fallbackText += `3. *${config.prefix}owner* - Info Owner\n`;
      await reply(fallbackText);
    }
  }
};
