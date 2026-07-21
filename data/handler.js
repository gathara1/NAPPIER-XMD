import { serialize, decodeJid } from '../lib/Serializer.js';
import path from 'path';
import fs from 'fs/promises';
import config from '../config.cjs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═════════════════════════════════════════════════════════════════════════════
// ✅ HYBRID ARCHITECTURE: NAPPIER-XMD SAFETY + MINIBOT SPEED
// ═════════════════════════════════════════════════════════════════════════════

// Plugin registry - registered at startup (like MINIBOT)
const pluginRegistry = new Map();
let pluginsLoaded = false;

// Command to plugin mapping (fast lookup)
const commandMap = new Map([
  // Info commands
  ['ping', { plugin: 'ping.js', timeout: 5000 }],
  ['speed', { plugin: 'ping.js', timeout: 5000 }],
  ['alive', { plugin: 'alive.js', timeout: 5000 }],
  ['owner', { plugin: 'owner.js', timeout: 5000 }],
  ['menu', { plugin: 'menu.js', timeout: 10000 }],
  ['help', { plugin: 'menu.js', timeout: 10000 }],
  ['repo', { plugin: 'repo.js', timeout: 5000 }],
  
  // Admin commands
  ['promote', { plugin: 'promote.js', timeout: 5000 }],
  ['demote', { plugin: 'demote.js', timeout: 5000 }],
  ['kick', { plugin: 'remove.js', timeout: 5000 }],
  ['tagall', { plugin: 'tagall.js', timeout: 5000 }],
  
  // Media commands
  ['play', { plugin: 'play.js', timeout: 30000 }],
  ['song', { plugin: 'song.js', timeout: 30000 }],
  ['sticker', { plugin: 'sticker.js', timeout: 15000 }],
  
  // AI commands
  ['gpt', { plugin: 'gpt.js', timeout: 30000 }],
  ['gemini', { plugin: 'gemini.js', timeout: 30000 }],
  ['stalk', { plugin: 'githubstalk.js', timeout: 10000 }],
]);

// ═════════════════════════════════════════════════════════════════════════════
// ✅ LOAD PLUGINS AT STARTUP (Like MINIBOT - once, not per message)
// ═════════════════════════════════════════════════════════════════════════════
const loadPluginsAtStartup = async () => {
  if (pluginsLoaded) return;

  const pluginDir = path.resolve(__dirname, '..', 'plugins');
  
  try {
    console.log(chalk.blue('\n📦 Loading plugins (startup)...'));
    const pluginFiles = await fs.readdir(pluginDir);
    let loaded = 0;
    let failed = 0;

    for (const file of pluginFiles) {
      if (file.endsWith('.js')) {
        try {
          const pluginPath = path.join(pluginDir, file);
          const pluginModule = await import(`file://${pluginPath}`);
          pluginRegistry.set(file, pluginModule.default);
          loaded++;
        } catch (err) {
          console.warn(chalk.yellow(`⚠️  Failed to load ${file}: ${err.message}`));
          failed++;
        }
      }
    }

    pluginsLoaded = true;
    console.log(chalk.green(`✅ Plugin startup complete! (${loaded} loaded, ${failed} failed)\n`));

  } catch (err) {
    console.error(chalk.red('❌ Plugin loading error:'), err.message);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ✅ EXECUTE PLUGIN WITH TIMEOUT (Safety feature)
// ═════════════════════════════════════════════════════════════════════════════
const executePluginSafe = async (plugin, m, sock, timeoutMs = 30000) => {
  try {
    await Promise.race([
      plugin(m, sock),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      )
    ]);
  } catch (err) {
    if (err.message === 'timeout') {
      console.warn(chalk.yellow(`⏱️  Plugin timeout (${timeoutMs}ms)`));
    }
    // Silently continue on errors
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// ✅ GET GROUP ADMINS
// ═════════════════════════════════════════════════════════════════════════════
export const getGroupAdmins = (participants) => {
  return participants
    .filter(p => p.admin === "superadmin" || p.admin === "admin")
    .map(p => p.id) || [];
};

// ═════════════════════════════════════════════════════════════════════════════
// ✅ MAIN HANDLER (Hybrid: NAPPIER-XMD + MINIBOT)
// ═════════════════════════════════════════════════════════════════════════════
const Handler = async (chatUpdate, sock, logger) => {
  try {
    if (chatUpdate.type !== 'notify') return;

    const m = serialize(JSON.parse(JSON.stringify(chatUpdate.messages[0])), sock, logger);
    if (!m.message) return;

    // ─────────────────────────────────────────────────────────────────────────
    // Load plugins on first message (lazy loading)
    // ─────────────────────────────────────────────────────────────────────────
    if (!pluginsLoaded) {
      await loadPluginsAtStartup();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Get group info
    // ─────────────────────────────────────────────────────────────────────────
    const participants = m.isGroup 
      ? await sock.groupMetadata(m.from).then(metadata => metadata.participants)
      : [];
    const groupAdmins = m.isGroup ? getGroupAdmins(participants) : [];
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const isBotAdmins = m.isGroup ? groupAdmins.includes(botId) : false;
    const isAdmins = m.isGroup ? groupAdmins.includes(m.sender) : false;

    // ─────────────────────────────────────────────────────────────────────────
    // Parse command (extract prefix + command name)
    // ─────────────────────────────────────────────────────────────────────────
    const PREFIX = /^[\\/!#.]/;
    const prefixMatch = m.body.match(PREFIX);
    
    if (!prefixMatch) {
      // No prefix - run auto-reply plugins
      for (const plugin of pluginRegistry.values()) {
        await executePluginSafe(plugin, m, sock, 10000);
      }
      return;
    }

    const prefix = prefixMatch[0];
    const cmd = m.body
      .slice(prefix.length)
      .split(' ')[0]
      .toLowerCase();
    const text = m.body.slice(prefix.length + cmd.length).trim();

    if (!cmd) return; // Empty command

    // ─────────────────────────────────────────────────────────────────────────
    // ✨ FAST COMMAND LOOKUP (O(1) - like MINIBOT)
    // ─────────────────────────────────────────────────────────────────────────
    const commandInfo = commandMap.get(cmd);

    if (commandInfo) {
      // Found in map - execute ONLY that plugin
      const pluginFile = commandInfo.plugin;
      const timeoutMs = commandInfo.timeout || 30000;

      if (pluginRegistry.has(pluginFile)) {
        const plugin = pluginRegistry.get(pluginFile);
        await executePluginSafe(plugin, m, sock, timeoutMs);
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fallback: Try all plugins (for custom/unmapped commands)
    // ─────────────────────────────────────────────────────────────────────────
    for (const plugin of pluginRegistry.values()) {
      await executePluginSafe(plugin, m, sock, 15000);
    }

  } catch (e) {
    console.error(chalk.red('❌ Handler error:'), e.message);
  }
};

export default Handler;
