import { picoClawService } from './picoClawService.js';

export function isPicoClawConnected() {
  return picoClawService.isConnected || picoClawService.clients.size > 0;
}

export async function sendToPicoClaw(messageText, options = {}) {
  const chatId = options.chatId || options.sender || picoClawService.getLastTarget();

  const payload = {
    chatId: chatId,
    senderId: options.sender || chatId,
    content: messageText,
    text: messageText,
    body: messageText,
    message: messageText,
    prompt: messageText,
    channel: 'whatsapp',
    type: 'message',
    from: chatId,
    user: chatId,
    target: chatId,
    senderName: options.senderName || 'WA User'
  };

  const sent = picoClawService.send(payload);
  if (!sent) {
    throw new Error('Belum ada client PicoClaw yang terhubung ke Server Bridge.');
  }

  if (chatId) {
    picoClawService.setLastTarget(chatId);
  }

  return true;
}

export { picoClawService };
