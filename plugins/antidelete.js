// anti-delete.js
import pkg from 'baileys-pro';
const { proto, downloadContentFromMessage } = pkg;
import config from '../config.cjs';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), "antidelete.json");

class AntiDeleteSystem {
  constructor() {
    this.enabled = config.ANTI_DELETE || false;
    this.cacheExpiry = 1800000;
    this.messageCache = new Map();
    this.cleanupTimer = null;
    this.isSaving = false;
    this.saveQueue = [];
    
    this.loadDatabase();
    this.startCleanup();
    console.log("🛡️ NAPPIER-XMD Anti-Delete System Initialized");
  }

  async loadDatabase() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const data = await fs.promises.readFile(DB_FILE, 'utf8');
        const entries = JSON.parse(data);
        const now = Date.now();
        const validEntries = entries.filter(([key, message]) => now - message.timestamp <= this.cacheExpiry);
        
        this.messageCache = new Map(validEntries);
        console.log(`📦 Loaded ${validEntries.length} messages from database`);
        
        if (entries.length !== validEntries.length) {
          await this.saveDatabase();
        }
      }
    } catch (error) {
      console.error("🔴 Database load error:", error);
      this.messageCache = new Map();
    }
  }

  async saveDatabase() {
    if (this.isSaving) {
      return new Promise(resolve => this.saveQueue.push(resolve));
    }
    
    this.isSaving = true;
    try {
      const data = JSON.stringify(Array.from(this.messageCache.entries()));
      await fs.promises.writeFile(DB_FILE, data);
      console.log(`💾 Database saved (${this.messageCache.size} messages)`);
      
      while (this.saveQueue.length) {
        const resolve = this.saveQueue.shift();
        resolve();
      }
    } catch (error) {
      console.error("🔴 Database save error:", error);
    } finally {
      this.isSaving = false;
    }
  }

  async addMessage(id, message) {
    if (this.messageCache.size > 1000) {
      this.cleanExpiredMessages(true);
    }
    
    this.messageCache.set(id, message);
    console.log(`📥 Cached message: ${id}`);
    await this.saveDatabase();
  }

  async deleteMessage(id) {
    if (this.messageCache.has(id)) {
      this.messageCache.delete(id);
      console.log(`🗑️ Deleted from cache: ${id}`);
      await this.saveDatabase();
    }
  }

  cleanExpiredMessages(force = false) {
    const now = Date.now();
    let cleaned = 0;
    const limit = force ? this.messageCache.size : Math.min(100, this.messageCache.size);

    for (const [key, message] of this.messageCache.entries()) {
      if (now - message.timestamp > this.cacheExpiry) {
        this.messageCache.delete(key);
        cleaned++;
      }
      if (!force && cleaned >= limit) break;
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired messages`);
      this.saveDatabase();
    }
  }

  startCleanup() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    
    this.cleanupTimer = setInterval(
      () => this.cleanExpiredMessages(),
      Math.min(this.cacheExpiry, 300000)
    );
    console.log("⏰ Cleanup scheduler started");
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('en-PK', {
      timeZone: "Asia/Karachi",
      dateStyle: 'medium',
      timeStyle: 'medium',
      hour12: true
    }) + " (PKT)";
  }

  async destroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.saveDatabase();
  }
}

const antiDelete = new AntiDeleteSystem();

const AntiDelete = async (m, Matrix) => {
  const prefix = config.PREFIX;
  const botNumber = await Matrix.decodeJid(Matrix.user.id);
  const isCreator = [botNumber, config.OWNER_NUMBER + '@s.whatsapp.net'].includes(m.sender);
  const args = m.body?.slice(prefix.length).trim().split(" ") || [];
  const cmd = args[0]?.toLowerCase();
  const subcmd = args[1]?.toLowerCase();

  const getChatInfo = async jid => {
    if (!jid) return { name: "🚫 Unknown Chat", isGroup: false };
    
    try {
      return jid.includes("@g.us") 
        ? { 
            name: (await Matrix.groupMetadata(jid))?.subject || "👥 Private Group", 
            isGroup: true 
          }
        : { name: "👤 Private Chat", isGroup: false };
    } catch {
      return { name: "🚫 Unknown Chat", isGroup: false };
    }
  };

  if (cmd === "antidelete" && isCreator) {
    try {
      const modes = {
        same: "🔄 Same Chat",
        inbox: "📥 Bot Inbox",
        owner: "👑 Owner PM"
      };
      const currentMode = modes[config.ANTI_DELETE_PATH] || modes.owner;

      const responses = {
        on: `🌟 *NAPPIER-XMD Anti-Delete Activated* 🌟
            \n• Status: 🟢 Active
            \n• Protection: Full Coverage
            \n• Cache: 30 Minutes
            \n• Mode: ${currentMode}
            \n📦 Stored: ${antiDelete.messageCache.size} messages`,

        off: `⚠️ *NAPPIER-XMD Anti-Delete Deactivated* ⚠️
             \n• Status: 🔴 Inactive
             \n• Cache: Cleared
             \n• Protection: Disabled`,

        stats: `📊 *NAPPIER-XMD Anti-Delete Stats*
               \n• Stored Messages: ${antiDelete.messageCache.size}
               \n• Status: ${antiDelete.enabled ? '🟢 Active' : '🔴 Inactive'}
               \n• Mode: ${currentMode}
               \n• Uptime: Continuous`,

        help: `🛡️ *NAPPIER-XMD Anti-Delete Help*
              \n• ${prefix}antidelete on - Enable protection
              \n• ${prefix}antidelete off - Disable system
              \n• ${prefix}antidelete stats - Show statistics
              \n• Current Mode: ${currentMode}`
      };

      switch(subcmd) {
        case 'on':
          antiDelete.enabled = true;
          antiDelete.startCleanup();
          await m.reply(responses.on);
          await m.React('🛡️');
          break;

        case 'off':
          antiDelete.enabled = false;
          antiDelete.messageCache.clear();
          await antiDelete.saveDatabase();
          await m.reply(responses.off);
          await m.React('⚠️');
          break;

        case 'stats':
          await m.reply(responses.stats);
          await m.React('📊');
          break;

        default:
          await m.reply(responses.help);
          await m.React('ℹ️');
      }
    } catch (error) {
      console.error("🔴 Command Error:", error);
      await m.React('❌');
    }
    return;
  }

  // Message handling events...
  Matrix.ev.on("messages.upsert", async ({ messages, type }) => {
    if (!antiDelete.enabled || type !== 'notify' || !messages?.length) return;

    for (const msg of messages) {
      try {
        if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;

        // Voice message handling
        if (msg.message.audioMessage?.ptt) {
          try {
            console.log("🔊 Processing voice message");
            const stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
            const mediaBuffer = await collectStream(stream);
            
            const cacheEntry = {
              type: 'ptt',
              media: mediaBuffer,
              mimetype: msg.message.audioMessage.mimetype || "audio/ogg; codecs=opus",
              sender: msg.key.participant || msg.key.remoteJid,
              senderFormatted: '@' + (msg.key.participant || msg.key.remoteJid)
                                .replace(/@s\.whatsapp\.net|@g\.us/g, ''),
              timestamp: Date.now(),
              chatJid: msg.key.remoteJid
            };
            
            await antiDelete.addMessage(msg.key.id, cacheEntry);
            console.log("✅ Voice message cached");
            continue;
          } catch (error) {
            console.error("🔇 Voice message error:", error);
          }
        }

        // Rest of message processing...
      } catch (error) {
        console.error("📥 Message Processing Error:", error);
      }
    }
  });

  Matrix.ev.on("messages.update", async updates => {
    if (!antiDelete.enabled || !updates?.length) return;

    for (const update of updates) {
      try {
        const { key, update: status } = update;
        const isDeleted = status?.messageStubType === proto.WebMessageInfo.StubType.REVOKE ||
                        status?.status === proto.WebMessageInfo.Status.DELETED;

        if (!isDeleted || key.fromMe || !antiDelete.messageCache.has(key.id)) continue;

        const cached = antiDelete.messageCache.get(key.id);
        await antiDelete.deleteMessage(key.id);

        // Determine destination
        let destination;
        switch(config.ANTI_DELETE_PATH) {
          case 'same': destination = key.remoteJid; break;
          case 'inbox': destination = Matrix.user.id; break;
          default: destination = config.OWNER_NUMBER + '@s.whatsapp.net';
        }

        // Send alert first
        await Matrix.sendMessage(destination, { 
          text: `🚨 *Deleted ${cached.type?.toUpperCase() || 'Message'} Recovered!*
                \n▫️ *Sender:* ${cached.senderFormatted}
                \n▫️ *Chat:* ${(await getChatInfo(cached.chatJid)).name}
                \n🕒 *Time:* ${antiDelete.formatTime(cached.timestamp)}`
        });

        // Handle voice notes
        if (cached.type === 'ptt') {
          await Matrix.sendMessage(destination, {
            audio: cached.media,
            mimetype: cached.mimetype,
            ptt: true
          });
        } 
        // Handle other media
        else if (cached.media) {
          await Matrix.sendMessage(destination, {
            [cached.type]: cached.media,
            mimetype: cached.mimetype
          });
        }
        // Handle text
        if (cached.content) {
          await Matrix.sendMessage(destination, {
            text: `📝 *Content:*\n${cached.content}`
          });
        }

        await Matrix.sendReaction(destination, { id: key.id, remoteJid: key.remoteJid }, '✅');

      } catch (error) {
        console.error("🔴 Recovery Error:", error);
        await Matrix.sendReaction(destination, { id: key.id, remoteJid: key.remoteJid }, '❌');
      }
    }
  });
};

async function collectStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default AntiDelete;