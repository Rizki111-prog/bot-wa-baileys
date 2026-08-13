// Project Configuration

export const config = {
  botName: 'Baileys Bot',
  ownerName: 'Owner',
  ownerNumber: ['6281234567890'], // Ganti dengan nomor WhatsApp pemilik (format internasional tanpa +)
  prefix: '.',                    // Prefix perintah (contoh: .menu, .ping)
  sessionName: 'session',         // Nama folder penyimpanan sesi login
  isPublic: true,                 // true: siapapun bisa pakai bot, false: hanya owner

  // Konfigurasi WebSocket Bridge PicoClaw
  picoClaw: {
    enabled: true,
    mode: 'server',              // Server mode di Laptop (PicoClaw terhubung ke ws://localhost:3001)
    port: 3001,
    serverPort: 3001,
    url: 'ws://localhost:3001',
    payloadFormat: 'json',       // Format payload: 'json', 'simple', atau 'raw'
    autoChat: true,              // true: chat biasa tanpa prefix otomatis dijawab AI PicoClaw
    groupAutoChat: true          // true: aktifkan auto-chat di grup juga
  },

  // Konfigurasi Database MySQL (Laragon)
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'data-toko',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }
};
