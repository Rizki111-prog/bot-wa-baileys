import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { config } from '../config.js';
import { picoClawService } from '../services/picoClawService.js';
import { isPicoClawConnected } from '../services/picoClaw.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const commands = new Map();

// Dynamic Command Loader
export async function loadCommands() {
  commands.clear();
  const commandsPath = path.join(__dirname, '../commands');

  if (!fs.existsSync(commandsPath)) return;

  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const fileUrl = pathToFileURL(filePath).href;
      
      try {
        const module = await import(fileUrl);
        if (module.command && module.command.name) {
          const cmd = module.command;
          commands.set(cmd.name.toLowerCase(), cmd);
          if (Array.isArray(cmd.aliases)) {
            for (const alias of cmd.aliases) {
              commands.set(alias.toLowerCase(), cmd);
            }
          }
        }
      } catch (err) {
        console.error(`[HANDLER] Failed to load command ${file}:`, err);
      }
    }
  }

  console.log(`[HANDLER] Loaded ${commands.size} commands successfully.`);
}

export async function handleMessage(sock, msg) {
  try {
    if (!msg.message) return;

    // Extract message body across standard and button/interactive message types
    const messageType = Object.keys(msg.message)[0];
    let body = '';

    if (messageType === 'conversation') {
      body = msg.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
      body = msg.message.extendedTextMessage.text;
    } else if (messageType === 'imageMessage') {
      body = msg.message.imageMessage.caption;
    } else if (messageType === 'videoMessage') {
      body = msg.message.videoMessage.caption;
    } else if (messageType === 'buttonsResponseMessage') {
      body = msg.message.buttonsResponseMessage.selectedButtonId || msg.message.buttonsResponseMessage.selectedDisplayText;
    } else if (messageType === 'templateButtonReplyMessage') {
      body = msg.message.templateButtonReplyMessage.selectedId || msg.message.templateButtonReplyMessage.selectedDisplayText;
    } else if (messageType === 'listResponseMessage') {
      body = msg.message.listResponseMessage.singleSelectReply?.selectedRowId || msg.message.listResponseMessage.title;
    } else if (messageType === 'interactiveResponseMessage') {
      try {
        const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson || '{}');
        body = params.id || params.text || '';
      } catch {
        body = '';
      }
    }

    if (!body) return;

    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = config.ownerNumber.some(num => sender.includes(num));

    const prefix = config.prefix;
    const isCommand = body.startsWith(prefix);

    if (isCommand) {
      const args = body.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      if (!config.isPublic && !isOwner) return;

      const command = commands.get(commandName);
      if (command) {
        const reply = async (text) => {
          return await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
        };

        console.log(`[EXECUTE] Command: ${commandName} | Sender: ${sender} | Group: ${isGroup}`);

        return await command.execute({
          sock,
          msg,
          args,
          prefix,
          commandName,
          body,
          sender,
          isGroup,
          isOwner,
          reply,
          commands
        });
      }
    }

    // Auto-chat ke PicoClaw untuk pesan biasa (tanpa perlu .pico)
    if (config.picoClaw?.enabled && (config.picoClaw.autoChat !== false)) {
      if (isGroup && config.picoClaw.groupAutoChat === false) return;

      if (isPicoClawConnected()) {
        const targetJid = msg.key.remoteJid;
        const senderName = msg.pushName || 'Pengguna WA';

        picoClawService.setLastTarget(targetJid);

        const sent = picoClawService.send({
          chatId: targetJid,
          senderId: sender,
          content: body,
          text: body,
          body: body,
          message: body,
          prompt: body,
          channel: 'whatsapp',
          type: 'message',
          from: targetJid,
          user: targetJid,
          target: targetJid,
          senderName: senderName
        });

        if (sent) {
          console.log(`[PicoClaw AutoChat] 🚀 Pesan dari ${sender} ("${body}") langsung diteruskan ke PicoClaw`);
        }
      }
    }

  } catch (err) {
    console.error(`[ERROR] Message handler error:`, err);
  }
}
