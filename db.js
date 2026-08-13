import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool(config.db);

export async function testConnection() {
  try {
    console.log(`[DB] Menghubungkan user '${config.db.user}' ke database '${config.db.database}' (${config.db.host}:${config.db.port})...`);
    const connection = await pool.getConnection();
    console.log(`[✓] Berhasil terhubung ke database MariaDB/MySQL: '${config.db.database}'`);
    connection.release();
    return true;
  } catch (error) {
    console.error(`[X] Gagal terhubung ke database '${config.db.database}' (User: '${config.db.user}'):`, error.message);
    return false;
  }
}

export function query(sql, params) {
  return pool.execute(sql, params);
}

export default {
  pool,
  testConnection,
  query
};
