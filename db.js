import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool(config.db);

export async function testConnection() {
  try {
    console.log([DB] Menghubungkan user \\\ ke database \\\ (:)...);
    const connection = await pool.getConnection();
    console.log(`[✓] Berhasil terhubung ke database MySQL Laragon: '${config.db.database}'`);
    connection.release();
    return true;
  } catch (error) {
    console.error(`[X] Gagal terhubung ke database '${config.db.database}':`, error.message);
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
