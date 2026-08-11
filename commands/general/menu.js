import { config } from '../../config.js';

export const command = {
  name: 'menu',
  aliases: ['help', 'm', 'start'],
  category: 'general',
  description: 'Menampilkan daftar perintah bot & tombol menu',
  execute: async ({ sock, msg, reply, commands }) => {
    const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    const date = new Date().toLocaleDateString('id-ID', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    // Group commands by category
    const categories = new Map();
    const uniqueCommands = new Map();

    for (const [key, cmd] of commands) {
      if (key === cmd.name.toLowerCase()) {
        uniqueCommands.set(cmd.name, cmd);
        const cat = cmd.category || 'general';
        if (!categories.has(cat)) {
          categories.set(cat, []);
        }
        categories.get(cat).push(cmd);
      }
    }

    let menuText = `✨ *${config.botName.toUpperCase()}* ✨\n`;
    menuText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    menuText += `📅 *Tanggal*: ${date}\n`;
    menuText += `⏰ *Waktu*: ${time} WIB\n`;
    menuText += `👤 *Owner*: ${config.ownerName}\n`;
    menuText += `🔑 *Prefix*: [ ${config.prefix} ]\n`;
    menuText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const [catName, cmdList] of categories) {
      menuText += `📂 *MENU ${catName.toUpperCase()}*\n`;
      for (const cmd of cmdList) {
        const aliasText = cmd.aliases && cmd.aliases.length > 0 
          ? ` (${cmd.aliases.map(a => config.prefix + a).join(', ')})` 
          : '';
        menuText += ` ├ 📌 *${config.prefix}${cmd.name}*${aliasText}\n`;
        menuText += ` └ ℹ️ _${cmd.description || 'Tidak ada deskripsi' }_\n`;
      }
      menuText += `\n`;
    }

    menuText += `━━━━━━━━━━━━━━━━━━━━━\n`;
    menuText += `💡 _Ketik nama command atau klik tombol di bawah untuk memilih menu._`;

    // Try sending message with buttons first
    try {
      await sock.sendMessage(msg.key.remoteJid, {
        text: menuText,
        footer: `© ${config.botName} • 2026`,
        buttons: [
          { buttonId: `${config.prefix}ping`, buttonText: { displayText: '⚡ Ping Bot' }, type: 1 },
          { buttonId: `${config.prefix}owner`, buttonText: { displayText: '👤 Owner Bot' }, type: 1 },
          { buttonId: `${config.prefix}button`, buttonText: { displayText: '🔘 Demo Button' }, type: 1 }
        ],
        headerType: 1
      }, { quoted: msg });
    } catch (err) {
      // Fallback to text message if buttons format is not supported on target protocol
      await reply(menuText);
    }
  }
};
