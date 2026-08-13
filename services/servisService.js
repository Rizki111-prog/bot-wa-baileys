import { query } from '../db.js';

function formatRupiah(angka) {
  if (angka === null || angka === undefined || isNaN(angka) || Number(angka) === 0) return 'Rp 0';
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

function formatTanggal(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return String(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export async function checkStatusStrict(serviceId, customerName) {
  const cleanId = serviceId ? serviceId.trim() : '';
  const cleanName = customerName ? customerName.trim() : '';
  if (!cleanId && !cleanName) return [];

  const searchPattern = `%${cleanId}%`;
  const searchNamePattern = cleanName ? `%${cleanName}%` : '%';

  // 1. Query barang_masuk
  let masukRows = [];
  try {
    const [rows] = await query(`
      SELECT service_id, no_antrian, nama, no_hp, kategori_barang, nama_barang, kelengkapan, kerusakan, tanggal 
      FROM barang_masuk 
      WHERE (service_id = ? OR service_id LIKE ? OR id = ?) AND (LOWER(nama) LIKE LOWER(?) OR ? = '%')
      ORDER BY id DESC LIMIT 5
    `, [cleanId, searchPattern, cleanId, searchNamePattern, searchNamePattern]);
    masukRows = rows;
  } catch (e) {
    console.error('[DB ERROR] barang_masuk query failed:', e.message);
  }

  // 2. Query barang_selesai
  let selesaiRows = [];
  try {
    const [rows] = await query(`
      SELECT service_id, no_antrian, nama, no_hp, kategori_barang, nama_barang, kerusakan, catatan_perbaikan, biaya, status_perbaikan, nama_teknisi, tanggal_selesai 
      FROM barang_selesai 
      WHERE (service_id = ? OR service_id LIKE ? OR id = ?) AND (LOWER(nama) LIKE LOWER(?) OR ? = '%')
      ORDER BY id DESC LIMIT 5
    `, [cleanId, searchPattern, cleanId, searchNamePattern, searchNamePattern]);
    selesaiRows = rows;
  } catch (e) {
    console.error('[DB ERROR] barang_selesai query failed:', e.message);
  }

  // 3. Query barang_diambil
  let diambilRows = [];
  try {
    const [rows] = await query(`
      SELECT service_id, no_antrian, nama, no_hp, kategori_barang, nama_barang, kerusakan, catatan_perbaikan, biaya, status_perbaikan, nama_teknisi, tanggal_selesai, tanggal_diambil, masa_garansi 
      FROM barang_diambil 
      WHERE (service_id = ? OR service_id LIKE ? OR id = ?) AND (LOWER(nama) LIKE LOWER(?) OR ? = '%')
      ORDER BY id DESC LIMIT 5
    `, [cleanId, searchPattern, cleanId, searchNamePattern, searchNamePattern]);
    diambilRows = rows;
  } catch (e) {
    console.error('[DB ERROR] barang_diambil query failed:', e.message);
  }

  const results = [];

  masukRows.forEach(item => {
    results.push({
      type: 'masuk',
      statusLabel: '⏳ *DALAM PROSES SERVIS*',
      service_id: item.service_id,
      no_antrian: item.no_antrian || '-',
      nama: item.nama || '-',
      nama_barang: item.nama_barang || item.kategori_barang || 'Barang Servis',
      kategori: item.kategori_barang || '-',
      kelengkapan: item.kelengkapan || '-',
      kerusakan: item.kerusakan || '-',
      tanggal_masuk: formatTanggal(item.tanggal),
      biaya: '_Dalam Pengerjaan Teknisi_',
      catatan: 'Unit sedang ditangani oleh teknisi.'
    });
  });

  selesaiRows.forEach(item => {
    results.push({
      type: 'selesai',
      statusLabel: '✅ *SELESAI (SIAP DIAMBIL)*',
      service_id: item.service_id,
      no_antrian: item.no_antrian || '-',
      nama: item.nama || '-',
      nama_barang: item.nama_barang || item.kategori_barang || 'Barang Servis',
      kategori: item.kategori_barang || '-',
      kerusakan: item.kerusakan || '-',
      catatan: item.catatan_perbaikan || 'Servis telah selesai.',
      biaya: formatRupiah(item.biaya),
      teknisi: item.nama_teknisi || '-',
      tanggal_selesai: formatTanggal(item.tanggal_selesai)
    });
  });

  diambilRows.forEach(item => {
    results.push({
      type: 'diambil',
      statusLabel: '📦 *SUDAH DIAMBIL*',
      service_id: item.service_id,
      no_antrian: item.no_antrian || '-',
      nama: item.nama || '-',
      nama_barang: item.nama_barang || item.kategori_barang || 'Barang Servis',
      kategori: item.kategori_barang || '-',
      kerusakan: item.kerusakan || '-',
      catatan: item.catatan_perbaikan || '-',
      biaya: formatRupiah(item.biaya),
      teknisi: item.nama_teknisi || '-',
      tanggal_selesai: formatTanggal(item.tanggal_selesai),
      tanggal_diambil: formatTanggal(item.tanggal_diambil),
      garansi: item.masa_garansi ? `${item.masa_garansi} Hari` : 'Tanpa Garansi'
    });
  });

  return results;
}

export async function checkServicePrice(keyword) {
  const cleanKey = keyword ? keyword.trim() : '';
  if (!cleanKey) return [];
  const searchPattern = `%${cleanKey}%`;

  let selesaiPrices = [];
  try {
    const [rows] = await query(`
      SELECT service_id, nama_barang, kategori_barang, kerusakan, catatan_perbaikan, biaya 
      FROM barang_selesai 
      WHERE (nama_barang LIKE ? OR kategori_barang LIKE ? OR service_id = ?) AND biaya > 0
      ORDER BY id DESC LIMIT 3
    `, [searchPattern, searchPattern, cleanKey]);
    selesaiPrices = rows;
  } catch (e) {}

  let diambilPrices = [];
  try {
    const [rows] = await query(`
      SELECT service_id, nama_barang, kategori_barang, kerusakan, catatan_perbaikan, biaya 
      FROM barang_diambil 
      WHERE (nama_barang LIKE ? OR kategori_barang LIKE ? OR service_id = ?) AND biaya > 0
      ORDER BY id DESC LIMIT 3
    `, [searchPattern, searchPattern, cleanKey]);
    diambilPrices = rows;
  } catch (e) {}

  const combined = [...selesaiPrices, ...diambilPrices];

  return combined.map(item => ({
    service_id: item.service_id,
    nama_barang: item.nama_barang || item.kategori_barang || 'Unit Servis',
    kategori: item.kategori_barang || '-',
    kerusakan: item.kerusakan || '-',
    catatan: item.catatan_perbaikan || '-',
    biaya_formatted: formatRupiah(item.biaya)
  }));
}

export async function buildDbContext(userMessage) {
  const text = String(userMessage || '').trim();
  if (!text) return '';

  const dbContextLines = [];
  const matches = text.match(/(?:WE-?)?\d+/gi);

  if (matches) {
    for (const rawId of matches) {
      try {
        const statusData = await checkStatusStrict(rawId);
        if (statusData && statusData.length > 0) {
          statusData.forEach(item => {
            // Format ultra ringkas & hemat token (~30-40 token saja)
            dbContextLines.push(`[DB_STATUS: ID=${item.service_id} | Pelanggan=${item.nama} | Unit=${item.nama_barang} (${item.kategori}) | Kendala=${item.kerusakan} | Status=${item.statusLabel} | Biaya=${item.biaya}]`);
          });
        }
      } catch (e) {}
    }
  }

  const words = text.toLowerCase().split(/[^a-z0-9]+/i).filter(w => w.length > 2 && !['bisa', 'tolong', 'yang', 'untuk', 'dengan', 'saya', 'apa', 'ada', 'dari', 'bantu', 'cek', 'servis', 'barang', 'harga', 'biaya', 'halo', 'info', 'lokasi', 'toko'].includes(w));

  if (words.length > 0 && dbContextLines.length === 0) {
    for (const searchKey of words.slice(0, 1)) {
      try {
        const priceRows = await checkServicePrice(searchKey);
        if (priceRows && priceRows.length > 0) {
          let priceContext = `[DB_BIAYA: `;
          priceRows.slice(0, 2).forEach((p, idx) => {
            priceContext += `${idx + 1}. ${p.nama_barang}(${p.kategori})/${p.kerusakan}=${p.biaya_formatted} `;
          });
          dbContextLines.push((priceContext + ']').trim());
        }
      } catch (e) {}
    }
  }

  // JIKA TIDAK ADA DATA DB YANG COCOK, KEMBALIKAN KOSONG '' (0 TOKEN EXTRA!)
  if (dbContextLines.length === 0) {
    return '';
  }

  return dbContextLines.join('\n');
}

export default {
  checkStatusStrict,
  checkServicePrice,
  buildDbContext,
  formatRupiah,
  formatTanggal
};
