import { serialize, decodeJid } from '../lib/Serializer.js';
import path from 'path';
import fs from 'fs/promises';
import config from '../config.cjs';
import { smsg } from '../lib/myfunc.cjs';
import { handleAntilink } from './antilink.js';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═════════════════════════════════════════════════════════════════════════
// ✅ PLUGIN CACHE & COMMAND MAPPING
// ═════════════════════════════════════════════════════════════════════════
const pluginCache = new Map();
let pluginsCached = false;
let cacheInitTime = 0;

// Command to plugin filename mapping
const commandMap = new Map([
  // Info commands
  ['ping', 'ping.js'],
  ['speed', 'ping.js'],
  ['p', 'ping.js'],
  ['alive', 'alive.js'],
  ['owner', 'owner.js'],
  ['menu', 'menu.js'],
  ['main-menu', 'main-menu.js'],
  ['help', 'menu.js'],
  ['repo', 'repo.js'],
  ['status', 'status.js'],
  
  // Admin commands
  ['promote', 'promote.js'],
  ['demote', 'demote.js'],
  ['kick', 'remove.js'],
  ['remove', 'remove.js'],
  ['invite', 'invite.js'],
  ['join', 'join.js'],
  ['setdesc', 'setdesc.js'],
  ['setgroupname', 'setgroupname.js'],
  ['linkgc', 'linkgc.js'],
  ['hidetag', 'hidetag.js'],
  ['tagall', 'tagall.js'],
  ['gpinfo', 'gpinfo.js'],
  
  // Media & Download
  ['play', 'play.js'],
  ['play2', 'play2.js'],
  ['song', 'song.js'],
  ['lyrics', 'lyrics.js'],
  ['image', 'gimage.js'],
  ['gimage', 'gimage.js'],
  ['tiktok', 'dl-tiktok.js'],
  ['fb', 'fb-dl.js'],
  ['insta', 'insta-dl.js'],
  ['fetch', 'fetch.js'],
  ['fetchvv', 'fetch-vv.js'],
  ['whatmusic', 'whatmusic.js'],
  
  // Sticker & Media conversion
  ['sticker', 'sticker.js'],
  ['take', 'take.js'],
  ['qc', 'qc.js'],
  ['attp', 'qc.js'],
  ['tomp3', 'tomp3.js'],
  ['tohd', 'tohd2.js'],
  ['hd', 'hd.js'],
  ['trt', 'trt.js'],
  ['removedbg', 'romovebg.js'],
  ['imagetotext', 'imagetotext.js'],
  ['emojimix', 'emojimix.js'],
  
  // AI & Tools
  ['gpt', 'gpt.js'],
  ['gemini', 'gemini.js'],
  ['stalk', 'githubstalk.js'],
  ['imdb', 'imdb.js'],
  ['qr', 'qrgenerater.js'],
  ['readqr', 'readqr.js'],
  ['waifu', 'waifu.js'],
  ['flirt', 'flirt.js'],
  
  // Utility & Settings
  ['mode', 'mode.js'],
  ['setprefix', 'setprefix.js'],
  ['block', 'block.js'],
  ['unblock', 'unblock.js'],
  ['del', 'del.js'],
  ['restart', 'restart.js'],
  ['updater', 'updater.js'],
  ['exit', 'exit.js'],
  ['report', 'report.js'],
  
  // Binary conversion
  ['ebinary', 'ebinary.js'],
  ['dbinary', 'dbinary.js'],
  
  // Profile
  ['fullpp', 'fullpp.js'],
  ['gcfullpp', 'gcfullpp.js'],
  ['couple-pp', 'couple-pp.js'],
  
  // Others
  ['crick', 'crick.js'],
  ['cal', 'cal.js'],
  ['tourl', 'tourl.js'],
  ['ringtone', 'dl-ringtone.js'],
  ['anticall', 'anticall.js'],
]);

// ═════════════════════════════════════════════════════════════════════════
// ✅ GET GROUP ADMINS
// ═════════════════════════════════════════════════════════════════════════
export const getGroupAdmins = (participants) => {
    let admins = [];
    for (let i of participants) {
        if (i.admin === "superadmin" || i.admin === "admin") {
            admins.push(i.id);
        }
    }
    return admins || [];
};

// ═════════════════════════════════════════════════════════════════════════
// ✅ CACHE ALL PLUGINS (Loads once at startup)
// ═════════════════════════════════════════════════════════════════════════
const cacheAllPlugins = async () => {
    if (pluginsCached) return; // Already cached

    const cacheStart = Date.now();
    const pluginDir = path.resolve(__dirname, '..', 'plugins');
    
    try {
        console.log(chalk.blue('\n📦 Initializing plugin cache...'));
        const pluginFiles = await fs.readdir(pluginDir);
        let successCount = 0;
        let failCount = 0;
        
        for (const file of pluginFiles) {
            if (file.endsWith('.js')) {
                const pluginPath = path.join(pluginDir, file);
                try {
                    const pluginModule = await import(`file://${pluginPath}`);
                    pluginCache.set(file, pluginModule.default);
                    successCount++;
                } catch (err) {
                    console.error(chalk.yellow(`⚠️  Skipped ${file}: ${err.message}`));
                    failCount++;
                }
            }
        }
        
        cacheInitTime = Date.now() - cacheStart;
        pluginsCached = true;
        
        console.log(chalk.green(`✅ Plugin cache ready! (${successCount} loaded, ${failCount} skipped in ${cacheInitTime}ms)\n`));
    } catch (err) {
        console.error(chalk.red(`❌ Plugin caching error:`, err.message));
    }
};

// ═════════════════════════════════════════════════════════════════════════
// ✅ EXECUTE SINGLE PLUGIN WITH TIMEOUT
// ═════════════════════════════════════════════════════════════════════════
const executePlugin = async (plugin, m, sock, timeoutMs = 30000) => {
    try {
        await Promise.race([
            plugin(m, sock),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('timeout')), timeoutMs)
            )
        ]);
    } catch (err) {
        if (err.message !== 'timeout') {
            console.error(chalk.yellow(`⚠️  Plugin error: ${err.message}`));
        }
    }
};

// ═════════════════════════════════════════════════════════════════════════
// ✅ MAIN HANDLER (OPTIMIZED)
// ═════════════════════════════════════════════════════════════════════════
const Handler = async (chatUpdate, sock, logger) => {
    try {
        if (chatUpdate.type !== 'notify') return;

        const m = serialize(JSON.parse(JSON.stringify(chatUpdate.messages[0])), sock, logger);
        if (!m.message) return;

        // Initialize cache on first message
        if (!pluginsCached) {
            await cacheAllPlugins();
        }

        // Get group info
        const participants = m.isGroup ? await sock.groupMetadata(m.from).then(metadata => metadata.participants) : [];
        const groupAdmins = m.isGroup ? getGroupAdmins(participants) : [];
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isBotAdmins = m.isGroup ? groupAdmins.includes(botId) : false;
        const isAdmins = m.isGroup ? groupAdmins.includes(m.sender) : false;

        // Parse command
        const PREFIX = /^[\\/!#.]/;
        const isCOMMAND = (body) => PREFIX.test(body);
        const prefixMatch = isCOMMAND(m.body) ? m.body.match(PREFIX) : null;
        const prefix = prefixMatch ? prefixMatch[0] : '/';
        const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
        const text = m.body.slice(prefix.length + cmd.length).trim();
        
        const botNumber = await sock.decodeJid(sock.user.id);
        const ownerNumber = config.OWNER_NUMBER + '@s.whatsapp.net';
        let isCreator = false;

        if (m.isGroup) {
            isCreator = m.sender === ownerNumber || m.sender === botNumber;
        } else {
            isCreator = m.sender === ownerNumber || m.sender === botNumber;
        }

        // Check if private mode
        if (!sock.public) {
            if (!isCreator) {
                return;
            }
        }

        // Handle antilink
        await handleAntilink(m, sock, logger, isBotAdmins, isAdmins, isCreator);

        const { isGroup, type, sender, from, body } = m;

        // ─────────────────────────────────────────────────────────────────
        // OPTIMIZED PLUGIN EXECUTION
        // ─────────────────────────────────────────────────────────────────
        
        if (cmd && prefixMatch) {
            // User sent a command - try direct mapping first
            const pluginFile = commandMap.get(cmd);
            
            if (pluginFile && pluginCache.has(pluginFile)) {
                // Found in command map - execute directly
                const plugin = pluginCache.get(pluginFile);
                await executePlugin(plugin, m, sock, 30000);
            } else {
                // Not in command map - try all plugins (for fallback/custom commands)
                for (const plugin of pluginCache.values()) {
                    await executePlugin(plugin, m, sock, 15000);
                }
            }
        } else {
            // No command - run auto-reply plugins (reactions, status, etc)
            for (const plugin of pluginCache.values()) {
                await executePlugin(plugin, m, sock, 10000);
            }
        }

    } catch (e) {
        console.error(chalk.red('❌ Handler error:'), e.message);
    }
};

export default Handler;
