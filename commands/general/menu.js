import { config } from '../../config.js';
import { getWelcomeMenuText } from '../../handlers/messageHandler.js';

export const command = {
  name: 'menu',
  aliases: ['help', 'm', 'start'],
  category: 'general',
  description: 'Menampilkan menu utama CS Wahyu Elektronik',
  execute: async ({ reply }) => {
    await reply(getWelcomeMenuText());
  }
};
