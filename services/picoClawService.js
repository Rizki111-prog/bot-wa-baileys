import { WebSocket, WebSocketServer } from 'ws';
import EventEmitter from 'events';
import { config } from '../config.js';

class PicoClawService extends EventEmitter {
  constructor() {
    super();
    this.wss = null;
    this.wsClient = null;
    this.clients = new Set();
    this.isConnected = false;
    this.reconnectTimer = null;
    this.isExplicitClosed = false;
    this.options = config.picoClaw || {};
    this.lastTargetJid = null;
  }

  setLastTarget(jid) {
    if (jid) {
      this.lastTargetJid = jid;
    }
  }

  getLastTarget() {
    return this.lastTargetJid;
  }

  connect() {
    if (!this.options.enabled) {
      console.log('[PicoClaw] Layanan WebSocket dinonaktifkan di konfigurasi.');
      return;
    }

    const mode = this.options.mode || 'server';
    if (mode === 'server') {
      this.startServer();
    } else {
      this.startClient();
    }
  }

  startServer() {
    if (this.wss) {
      console.log('[PicoClaw] ℹ️ WebSocket Server Bridge sudah berjalan.');
      return;
    }
    const port = Number(this.options.port || this.options.serverPort || 3001);
    console.log(`[PicoClaw] 🚀 Menjalankan WebSocket Server Bridge di port ${port}...`);

    try {
      this.wss = new WebSocketServer({ port, host: '0.0.0.0' });

      this.wss.on('listening', () => {
        console.log(`[PicoClaw] ✅ WebSocket Server Bridge SIAP mendengarkan koneksi dari PicoClaw di ws://localhost:${port}`);
      });

      this.wss.on('connection', (ws, req) => {
        const clientIp = req.socket.remoteAddress || 'Unknown';
        console.log(`[PicoClaw] 🔗 Client terhubung dari IP: ${clientIp}`);
        this.clients.add(ws);
        this.isConnected = true;
        this.emit('connected', ws);

        ws.on('message', (data, isBinary) => {
          const rawStr = data.toString();
          console.log(`[PicoClaw] 📩 Frame diterima dari PicoClaw (${clientIp}):`, rawStr);
          let parsed = rawStr;
          try {
            parsed = JSON.parse(rawStr);
          } catch (e) {
            // Tetap string jika bukan JSON
          }
          this.emit('message', parsed, ws);
        });

        ws.on('ping', () => {
          console.log(`[PicoClaw] 🏓 Ping diterima dari PicoClaw (${clientIp})`);
        });

        ws.on('close', (code, reason) => {
          console.log(`[PicoClaw] ⚠️ Client PicoClaw terputus (${clientIp}, Code: ${code})`);
          this.clients.delete(ws);
          if (this.clients.size === 0) {
            this.isConnected = false;
          }
          this.emit('disconnected', ws);
        });

        ws.on('error', (err) => {
          console.error(`[PicoClaw] ❌ Socket Client Error (${clientIp}):`, err.message);
        });
      });

      this.wss.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[PicoClaw] ❌ Port ${port} sudah digunakan oleh aplikasi lain!`);
        } else {
          console.error('[PicoClaw] ❌ WebSocket Server Error:', err.message);
        }
      });
    } catch (err) {
      console.error('[PicoClaw] Error inisialisasi WebSocket Server:', err.message);
    }
  }

  startClient() {
    if (this.wsClient && (this.wsClient.readyState === WebSocket.CONNECTING || this.wsClient.readyState === WebSocket.OPEN)) {
      console.log('[PicoClaw] ℹ️ WebSocket Client sudah terhubung.');
      return;
    }
    const url = this.options.url || 'ws://localhost:3001';
    this.isExplicitClosed = false;
    console.log(`[PicoClaw] Menghubungkan ke WebSocket PicoClaw di ${url}...`);

    try {
      this.wsClient = new WebSocket(url);

      this.wsClient.on('open', () => {
        this.isConnected = true;
        console.log(`[PicoClaw] ✅ Terhubung ke PicoClaw WebSocket (${url})`);
        this.emit('connected');
      });

      this.wsClient.on('message', (data) => {
        let parsed = data.toString();
        try { parsed = JSON.parse(parsed); } catch (e) {}
        console.log('[PicoClaw] 📩 Pesan diterima dari PicoClaw:', parsed);
        this.emit('message', parsed);
      });

      this.wsClient.on('close', (code, reason) => {
        this.isConnected = false;
        console.log(`[PicoClaw] ⚠️ Koneksi terputus (Code: ${code}).`);
        this.emit('disconnected', { code, reason: reason ? reason.toString() : '' });
        this._scheduleReconnect();
      });

      this.wsClient.on('error', (error) => {
        console.error(`[PicoClaw] ❌ Gagal terhubung ke ${url}:`, error.message);
      });
    } catch (err) {
      console.error('[PicoClaw] Error inisialisasi WebSocket Client:', err.message);
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.isExplicitClosed || !this.options.enabled || this.options.mode === 'server') return;
    if (!this.reconnectTimer) {
      const delay = this.options.reconnectInterval || 5000;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.startClient();
      }, delay);
    }
  }

  send(payload, overrideFormat) {
    const format = overrideFormat || this.options.payloadFormat || 'json';
    let dataToSend;

    if (typeof payload === 'object' && payload !== null) {
      if (format === 'raw') {
        dataToSend = payload.content || payload.text || payload.body || payload.message || payload.prompt || String(payload);
      } else if (format === 'simple') {
        dataToSend = JSON.stringify({
          prompt: payload.content || payload.text || payload.body || payload.message || payload.prompt,
          from: payload.chatId || payload.senderId || payload.from || payload.user || payload.target
        });
      } else {
        dataToSend = JSON.stringify(payload);
      }
    } else {
      dataToSend = String(payload);
    }

    if (this.options.mode === 'server') {
      if (this.clients.size === 0) {
        console.warn('[PicoClaw] ⚠️ Gagal mengirim: Belum ada client PicoClaw yang terhubung ke Server Laptop.');
        return false;
      }
      let count = 0;
      for (const client of this.clients) {
        if (client.readyState === 1) {
          client.send(dataToSend);
          count++;
        }
      }
      console.log(`[PicoClaw] 📤 Pesan terkirim ke ${count} client PicoClaw (Format: ${format}):`, dataToSend);
      return true;
    } else {
      if (!this.isConnected || !this.wsClient) {
        console.warn('[PicoClaw] ⚠️ Gagal mengirim: WebSocket Client belum terhubung ke PicoClaw.');
        return false;
      }
      this.wsClient.send(dataToSend);
      console.log(`[PicoClaw] 📤 Pesan terkirim ke PicoClaw (Format: ${format}):`, dataToSend);
      return true;
    }
  }

  disconnect() {
    this.isExplicitClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    this.clients.clear();
    this.isConnected = false;
    console.log('[PicoClaw] Layanan WebSocket ditutup.');
  }
}

export const picoClawService = new PicoClawService();
