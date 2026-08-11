# WhatsApp Bot Baileys

WhatsApp Bot modern dan ringan dibangun menggunakan [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys).

## 🚀 Fitur

- ⚡ **Ringan & Cepat** dengan ES Modules (`"type": "module"`).
- 🔐 **Autentikasi Multi-Device** otomatis tersimpan di folder `session/`.
- 📁 **Struktur Perintah Modular**: Tambahkan perintah baru dengan mudah di folder `commands/`.
- 🛡️ **Aman untuk Git**: `session/` dan `node_modules/` sudah dikonfigurasi di `.gitignore`.

---

## 🛠️ Cara Instalasi & Menjalankan

1. **Clone repository ini (atau buka di folder ini)**
   ```bash
   git clone <URL_REPOSITORY_ANDA>
   cd "bot-wa baileys"
   ```

2. **Install Dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Bot (`config.js`)**
   Buka file `config.js` dan sesuaikan nomor WhatsApp owner serta nama bot Anda:
   ```javascript
   export const config = {
     botName: 'Baileys Bot',
     ownerName: 'Nama Anda',
     ownerNumber: ['6281234567890'], // Format internasional tanpa tanda '+'
     prefix: '.',
   };
   ```

4. **Jalankan Bot**
   ```bash
   npm start
   ```
   Scan QR Code yang muncul di terminal menggunakan aplikasi WhatsApp di HP Anda (**Perangkat Tertaut / Linked Devices**).

---

## 📁 Struktur Folder Project

```
├── commands/
│   └── general/
│       ├── menu.js       # Perintah .menu
│       ├── owner.js      # Perintah .owner
│       └── ping.js       # Perintah .ping
├── handlers/
│   └── messageHandler.js # Router & pemproses pesan masuk
├── config.js             # File konfigurasi bot
├── index.js              # Entry point utama bot & koneksi Baileys
├── package.json          # File konfigurasi NPM
└── .gitignore            # Daftar file/folder yang diabaikan Git
```

---

## ➕ Cara Menambah Perintah (Command) Baru

Cukup buat file `.js` baru di dalam folder `commands/<kategori>/`, contoh `commands/general/halo.js`:

```javascript
export const command = {
  name: 'halo',
  category: 'general',
  description: 'Menyapa pengguna',
  execute: async ({ reply, sender }) => {
    await reply(`Halo! 👋 Selamat datang.`);
  }
};
```

---

## 📤 Upload ke GitHub Anda

1. **Inisialisasi Git & Commit Pertama**
   ```bash
   git add .
   git commit -m "feat: initial whatsapp bot setup with baileys"
   ```

2. **Hubungkan ke Repository GitHub milik Anda**
   ```bash
   git remote add origin https://github.com/USERNAME_ANDA/NAMA_REPO_ANDA.git
   git branch -M main
   git push -u origin main
   ```

> ⚠️ **PENTING**: Sesi login tersimpan di folder `session/` dan sudah dimasukkan ke `.gitignore`. **Jangan pernah meng-upload folder `session/` ke repository publik GitHub!**

---

## 📄 Lisensi

[ISC License](LICENSE)
