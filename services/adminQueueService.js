// Service untuk mengelola Antrian CS / Chat Admin & Sesi Relay

const waitingQueues = new Map();       // queueId (number) -> { queueId, userJid, userName, messageText, status, createdAt }
const userWaitingQueue = new Map();    // userJid -> queueId
const activeSessionsByUser = new Map(); // userJid -> { queueId, userJid, userName, adminJid, adminName, connectedAt }
const activeSessionsByAdmin = new Map();// adminJid -> { queueId, userJid, userName, adminJid, adminName, connectedAt }

let queueCounter = 1;

/**
 * Membuat antrian baru untuk user yang meminta chat admin
 */
export function createQueue(userJid, userName, messageText) {
  // Jika user sudah memiliki antrian aktif yang belum diterima
  if (userWaitingQueue.has(userJid)) {
    const existingQueueId = userWaitingQueue.get(userJid);
    const existingQueue = waitingQueues.get(existingQueueId);
    if (existingQueue) {
      existingQueue.messageText = messageText;
      existingQueue.updatedAt = new Date();
      return { queue: existingQueue, isUpdate: true };
    }
  }

  const queueId = queueCounter++;
  const queueItem = {
    queueId,
    userJid,
    userName: userName || 'Pengguna WA',
    messageText,
    status: 'WAITING',
    createdAt: new Date()
  };

  waitingQueues.set(queueId, queueItem);
  userWaitingQueue.set(userJid, queueId);

  return { queue: queueItem, isUpdate: false };
}

/**
 * Mengambil daftar semua antrian yang dalam status WAITING
 */
export function getWaitingQueues() {
  return Array.from(waitingQueues.values()).filter(q => q.status === 'WAITING');
}

/**
 * Mengambil detail antrian berdasarkan ID
 */
export function getQueueById(queueId) {
  const numericId = parseInt(queueId, 10);
  return waitingQueues.get(numericId) || null;
}

/**
 * Admin menerima/mengonfirmasi nomor antrian
 */
export function acceptQueue(queueId, adminJid, adminName, additionalJids = []) {
  const numericId = parseInt(queueId, 10);
  const queueItem = waitingQueues.get(numericId);

  if (!queueItem) {
    return { success: false, reason: 'NOT_FOUND' };
  }

  if (queueItem.status !== 'WAITING') {
    return {
      success: false,
      reason: 'ALREADY_TAKEN',
      takenByAdminName: queueItem.acceptedByAdminName || 'Admin Lain'
    };
  }

  // Cek jika admin ini sedang terhubung dalam sesi lain
  const existingAdminSession = getAdminActiveSession(adminJid, additionalJids);
  if (existingAdminSession) {
    return { success: false, reason: 'ADMIN_BUSY', activeSession: existingAdminSession };
  }

  // Cek jika user ini ternyata sudah punya sesi aktif lain
  if (activeSessionsByUser.has(queueItem.userJid)) {
    return { success: false, reason: 'USER_BUSY' };
  }

  // Update status antrian
  queueItem.status = 'CONNECTED';
  queueItem.acceptedByAdminJid = adminJid;
  queueItem.acceptedByAdminName = adminName || 'Admin';
  userWaitingQueue.delete(queueItem.userJid);

  const session = {
    queueId: numericId,
    userJid: queueItem.userJid,
    userName: queueItem.userName,
    adminJid,
    adminName: adminName || 'Admin',
    connectedAt: new Date()
  };

  activeSessionsByUser.set(queueItem.userJid, session);
  activeSessionsByAdmin.set(adminJid, session);
  if (Array.isArray(additionalJids)) {
    for (const jid of additionalJids) {
      if (jid) activeSessionsByAdmin.set(jid, session);
    }
  }

  return {
    success: true,
    session,
    userJid: queueItem.userJid,
    userName: queueItem.userName,
    messageText: queueItem.messageText
  };
}

/**
 * Mengakhiri sesi chat aktif (dapat dipicu oleh User atau Admin) atau membatalkan antrian
 */
export function endSession(jid) {
  if (!jid) return { success: false, reason: 'NO_ACTIVE_SESSION' };

  // Cek apakah JID adalah User dalam sesi aktif
  if (activeSessionsByUser.has(jid)) {
    const session = activeSessionsByUser.get(jid);
    activeSessionsByUser.delete(session.userJid);
    for (const [k, v] of activeSessionsByAdmin.entries()) {
      if (v === session) activeSessionsByAdmin.delete(k);
    }
    return { success: true, session, endedBy: 'USER' };
  }

  // Cek apakah JID adalah Admin dalam sesi aktif
  if (activeSessionsByAdmin.has(jid)) {
    const foundSession = activeSessionsByAdmin.get(jid);
    activeSessionsByUser.delete(foundSession.userJid);
    for (const [k, v] of activeSessionsByAdmin.entries()) {
      if (v === foundSession) activeSessionsByAdmin.delete(k);
    }
    return { success: true, session: foundSession, endedBy: 'ADMIN' };
  }

  // Cek jika user membatalkan antrian saat berstatus WAITING
  if (userWaitingQueue.has(jid)) {
    const queueId = userWaitingQueue.get(jid);
    const queueItem = queueId ? waitingQueues.get(queueId) : null;
    userWaitingQueue.delete(jid);
    if (queueId) waitingQueues.delete(queueId);
    return { success: true, cancelledQueue: true, queueItem };
  }

  return { success: false, reason: 'NO_ACTIVE_SESSION' };
}

/**
 * Mendapatkan sesi aktif user
 */
export function getUserActiveSession(userJid) {
  if (!userJid) return null;
  return activeSessionsByUser.get(userJid) || null;
}

/**
 * Mendapatkan sesi aktif admin
 */
export function getAdminActiveSession(adminJid, additionalJids = []) {
  if (adminJid && activeSessionsByAdmin.has(adminJid)) {
    return activeSessionsByAdmin.get(adminJid);
  }
  if (Array.isArray(additionalJids)) {
    for (const jid of additionalJids) {
      if (jid && activeSessionsByAdmin.has(jid)) {
        return activeSessionsByAdmin.get(jid);
      }
    }
  }
  return null;
}

/**
 * Mendapatkan antrian user yang berstatus WAITING (jika ada)
 */
export function getUserQueue(userJid) {
  if (!userWaitingQueue.has(userJid)) return null;
  const queueId = userWaitingQueue.get(userJid);
  return waitingQueues.get(queueId) || null;
}
