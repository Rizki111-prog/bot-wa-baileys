import { config } from '../../config.js';

export const command = {
  name: 'menu',
  aliases: ['help', 'm'],
  category: 'general',
  description: 'Menampilkan daftar perintah bot',
  execute: async ({ reply, commands, sender }) => {
    const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    const date = new Date().toLocaleDateString('id-ID', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    let text = `🤖 *${config.botName.toUpperCase()}*\n`;
    text += `─────────────\n`;
    text += `📅 *Tanggal*: ${date}\n`;
    text += `⏰ *Waktu*: ${time} WIB\n`;
    text += `👤 *Owner*: ${config.ownerName}\n`;
    text += `🔑 *Prefix*: [ ${config.prefix} ]\n`;
    text += `─────────────\n\n`;

    // Filter unique commands to avoid duplicates from aliases
    const uniqueCommands = new Map();
    for (const [key, cmd] of commands) {
      if (key === cmd.name.toLowerCase()) {
        uniqueCommands.set(cmd.name, cmd);
      }
    }

    text += `📋 *DAFTAR COMMAND*\n\n`;

    for (const [name, cmd] of uniqueCommands) {
      const aliasText = cmd.aliases ? ` (${cmd.aliases.map(a => config.prefix + a).join(', ')})` : '';
      text += ` • *${config.prefix}${name}*${aliasText}\n   _${cmd.description || '-' }_\n\n`;
    }

    text += `─────────────\n`;
    text += `💡 _Ketik *${config.prefix}<command>* untuk menggunakan bot._`;

    await reply(text);
  }
};
