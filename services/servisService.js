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

// Kamus lengkap sinonim kerusakan & istilah teknisi lokal
const DAMAGE_SYNONYMS = {
  lcd: ['lcd', 'layar', 'skrin', 'touchscreen', 'sentuh', 'pecah', 'retak', 'gambar', 'gelap', 'bergaris', 'lem lcd', 'lemlcd'],
  layar: ['lcd', 'layar', 'skrin', 'touchscreen', 'sentuh', 'pecah', 'retak'],
  tombol: ['tombol', 'on off', 'onoff', 'volume', 'fleksibel', 'saklar', 'swich', 'switch'],
  baterai: ['baterai', 'batrai', 'batre', 'battery', 'kembung', 'drop', 'awet'],
  batrai: ['baterai', 'batrai', 'batre', 'battery'],
  cas: ['cas', 'dcas', 'dicas', 'charge', 'charger', 'konektor', 'ngisek', 'bise cas', 'dicas'],
  dicas: ['cas', 'dcas', 'dicas', 'charge', 'charger', 'konektor', 'ngisek', 'bise cas'],
  charge: ['cas', 'dcas', 'dicas', 'charge', 'konektor'],
  backdoor: ['backdoor', 'becdor', 'casing', 'kesing', 'tutup', 'kaca belakang', 'bodi'],
  becdor: ['backdoor', 'becdor', 'casing', 'kesing', 'tutup'],
  speaker: ['speaker', 'spiker', 'suare', 'suara', 'bunyi', 'musik', 'buzzer', 'mic', 'mik', 'besuare'],
  spiker: ['speaker', 'spiker', 'suare', 'suara', 'bunyi', 'besuare'],
  suara: ['speaker', 'spiker', 'suare', 'suara', 'bunyi', 'besuare'],
  mati: ['mati', 'matot', 'mati total', 'konslet', 'short', 'idup', 'hidup', 'restar', 'restart'],
  matot: ['mati', 'matot', 'mati total', 'konslet', 'short'],
  lem: ['lem', 'rekatt', 'lemlcd', 'pasangkan'],
  sinyal: ['sinyal', 'signal', 'imei', 'riper imei', 'besinyal', 'daan besinyal', 'kartu']
};

function expandSearchKeywords(words) {
  const expanded = new Set(words);
  words.forEach(w => {
    const key = w.toLowerCase();
    if (DAMAGE_SYNONYMS[key]) {
      DAMAGE_SYNONYMS[key].forEach(syn => expanded.add(syn));
    }
  });
  return Array.from(expanded);
}

export async function checkServicePrice(userQuery) {
  const text = String(userQuery || '').trim();
  if (!text) return [];

  const stopWords = [
    'bisa', 'tolong', 'yang', 'untuk', 'dengan', 'saya', 'apa', 'ada', 
    'dari', 'bantu', 'cek', 'servis', 'service', 'barang', 'harga', 'biaya', 'halo', 
    'info', 'lokasi', 'toko', 'berapa', 'perbaiki', 'perbaikan', 'memperbaiki', 'benerin', 'ganti',
    'penggantian', 'penanganan', 'tanya', 'kak', 'min', 'gan', 'bro', 'sis', 'mas', 'mbak', 'dong', 'kah',
    'estimasi', 'kira', 'kisaran', 'mau', 'ingin', 'tahu', 'donk', 'hp', 'handphone', 'unit', 'rusak', 'kenapa'
  ];

  const rawWords = text.toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(w => w.length >= 2 && !stopWords.includes(w));

  if (rawWords.length === 0) return [];

  // Ekspansi kata kunci menggunakan Kamus Sinonim Kerusakan
  const expandedWords = expandSearchKeywords(rawWords);

  const scoreParts = [];
  const whereParts = [];
  const scoreParams = [];
  const whereParams = [];

  expandedWords.forEach(w => {
    let termPattern = `%${w}%`;
    const isModelNumber = /\d/.test(w);
    let weight = isModelNumber ? 6 : 2;

    // Normalisasi variasi ejaan brand populer (contoh: realme vs realmi di database)
    if (w === 'realme' || w === 'realmi') {
      termPattern = '%realm%';
      weight = 4;
    } else if (w === 'xiaomi' || w === 'siomi' || w === 'redmi') {
      termPattern = '%xi%';
      weight = 4;
    } else if (w === 'samsung' || w === 'samson') {
      termPattern = '%sams%';
      weight = 4;
    } else if (w === 'iphone' || w === 'ip') {
      termPattern = '%iph%';
      weight = 4;
    }

    scoreParts.push(`(CASE WHEN LOWER(nama_barang) LIKE ? OR LOWER(kategori_barang) LIKE ? OR LOWER(kerusakan) LIKE ? OR LOWER(catatan_perbaikan) LIKE ? THEN ${weight} ELSE 0 END)`);
    scoreParams.push(termPattern, termPattern, termPattern, termPattern);

    whereParts.push(`(LOWER(nama_barang) LIKE ? OR LOWER(kategori_barang) LIKE ? OR LOWER(kerusakan) LIKE ? OR LOWER(catatan_perbaikan) LIKE ?)`);
    whereParams.push(termPattern, termPattern, termPattern, termPattern);
  });

  const sqlScore = scoreParts.join(' + ');
  const sqlWhere = whereParts.join(' OR ');
  const queryParams = [...scoreParams, ...whereParams];

  let selesaiPrices = [];
  try {
    const [rows] = await query(`
      SELECT service_id, nama_barang, kategori_barang, kerusakan, catatan_perbaikan, biaya,
        (${sqlScore}) AS score
      FROM barang_selesai 
      WHERE biaya > 0 AND (${sqlWhere})
      ORDER BY score DESC, id DESC LIMIT 30
    `, queryParams);
    selesaiPrices = rows;
  } catch (e) {
    console.error('[DB ERROR] checkServicePrice (selesai):', e.message);
  }

  let diambilPrices = [];
  try {
    const [rows] = await query(`
      SELECT service_id, nama_barang, kategori_barang, kerusakan, catatan_perbaikan, biaya,
        (${sqlScore}) AS score
      FROM barang_diambil 
      WHERE biaya > 0 AND (${sqlWhere})
      ORDER BY score DESC, id DESC LIMIT 30
    `, queryParams);
    diambilPrices = rows;
  } catch (e) {
    console.error('[DB ERROR] checkServicePrice (diambil):', e.message);
  }

  const combined = [...selesaiPrices, ...diambilPrices].sort((a, b) => (b.score || 0) - (a.score || 0));

  const uniqueList = [];
  const seenKeys = new Set();

  for (const item of combined) {
    const key = `${item.nama_barang}-${item.kerusakan}-${item.biaya}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueList.push({
        service_id: item.service_id,
        nama_barang: item.nama_barang || item.kategori_barang || 'Unit Servis',
        kategori: item.kategori_barang || '-',
        kerusakan: item.kerusakan || '-',
        catatan: item.catatan_perbaikan || '-',
        biaya: Number(item.biaya),
        biaya_formatted: formatRupiah(item.biaya),
        score: item.score || 0
      });
    }
  }

  return uniqueList;
}

export async function buildDbContext(userMessage) {
  const text = String(userMessage || '').trim();
  if (!text) return '';

  const dbContextLines = [];

  // Pencocokan ID nota/service spesifik (misal: WE-76051859 atau 'nota 123', 'id 123')
  // Mencegah nomor tipe model HP (seperti '11' pada 'iphone 11' atau '8' pada 'realme 8') salah dianggap sebagai ID nota
  const notaMatches = text.match(/\bWE-?\d{3,8}\b/gi) || 
    text.match(/(?:nota|id|service|antrian|no\.?)\s*#?\s*([0-9]{1,8})\b/gi);

  if (notaMatches) {
    for (const rawId of notaMatches) {
      try {
        const cleanId = rawId.replace(/^(?:nota|id|service|antrian|no\.?)\s*#?\s*:?\s*/i, '');
        const statusData = await checkStatusStrict(cleanId);
        if (statusData && statusData.length > 0) {
          statusData.forEach(item => {
            // Format ultra ringkas & hemat token (~30-40 token saja)
            dbContextLines.push(`[DB_STATUS: ID=${item.service_id} | Pelanggan=${item.nama} | Unit=${item.nama_barang} (${item.kategori}) | Kendala=${item.kerusakan} | Status=${item.statusLabel} | Biaya=${item.biaya}]`);
          });
        }
      } catch (e) {}
    }
  }

  // Jika tidak ada ID nota spesifik yang dicocokkan, lakukan pencarian mendalam estimasi biaya berdasarkan pertanyaan user
  if (dbContextLines.length === 0) {
    try {
      const priceRows = await checkServicePrice(text);
      if (priceRows && priceRows.length > 0) {
        const costs = priceRows.map(r => r.biaya).filter(c => c > 0);
        const minCost = Math.min(...costs);
        const maxCost = Math.max(...costs);

        let priceContext = `[DB_BIAYA_STATISTIK: Total_Histori=${priceRows.length} | Rentang_Biaya=${formatRupiah(minCost)} - ${formatRupiah(maxCost)}]\n`;
        priceContext += `[DB_DETAIL_HISTORI:\n`;

        // Menyediakan hingga 10 data detail histori teratas untuk AI
        priceRows.slice(0, 10).forEach((p, idx) => {
          priceContext += `${idx + 1}. Unit: ${p.nama_barang} (${p.kategori}) | Kerusakan: ${p.kerusakan} | Perbaikan: ${p.catatan} = ${p.biaya_formatted}\n`;
        });
        priceContext += `]`;

        dbContextLines.push(priceContext);
      }
    } catch (e) {
      console.error('[DB CONTEXT BUILD ERR]', e.message);
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
