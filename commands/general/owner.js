import { config } from '../../config.js';

export const command = {
  name: 'owner',
  category: 'general',
  description: 'Menampilkan kontak pembuat bot',
  execute: async ({ sock, msg, reply }) => {
    const ownerNum = config.ownerNumber[0] || '6281234567890';
    const vcard = `BEGIN:VCARD\n`
      + `VERSION:3.0\n`
      + `N:;${config.ownerName};;;\n`
      + `FN:${config.ownerName}\n`
      + `TEL;type=CELL;type=VOICE;waid=${ownerNum}:+${ownerNum}\n`
      + `END:VCARD`;

    await sock.sendMessage(
      msg.key.remoteJid,
      {
        contacts: {
          displayName: config.ownerName,
          contacts: [{ vcard }]
        }
      },
      { quoted: msg }
    );
  }
};
