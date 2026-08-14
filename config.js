import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env file from project directory
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

// Project Configuration

export const config = {
  botName: 'Baileys Bot',
  ownerName: 'Rizki',
  ownerNumber: ['6281992750353', '265769036296420'], // Ganti dengan nomor WhatsApp pemilik (format internasional tanpa +) & LID jika ada

  // Daftar Admin / CS beserta nama masing-masing
  admins: [
    { number: '6281992750353', name: 'Rizki' },
    { number: '6287747543063', name: 'Abdul' },
    { number: '6285939411170', name: 'Kurniawan' },
    // { number: '6281234567890', name: 'Budi' }
  ],
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

  // Konfigurasi Database MySQL / MariaDB
  db: {
    host: (process.env.DB_HOST || 'localhost').split('#')[0].trim(),
    user: (process.env.DB_USER || 'root').split('#')[0].trim(),
    password: (process.env.DB_PASSWORD || '').split('#')[0].trim(),
    database: (process.env.DB_NAME || 'data-toko').split('#')[0].trim(),
    port: parseInt((process.env.DB_PORT || '3306').split('#')[0].trim(), 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }
};
