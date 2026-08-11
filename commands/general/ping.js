export const command = {
  name: 'ping',
  category: 'general',
  description: 'Mengecek kecepatan respon bot',
  execute: async ({ sock, msg, reply }) => {
    const start = Date.now();
    await reply('Pong! 🏓');
    const end = Date.now();
    await reply(`Respon speed: *${end - start}ms*`);
  }
};
