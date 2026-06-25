/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    NAPPIER XMD - WHATSAPP BOT                           ║
 * ║                    Version: 1.0.0 | Status: Active                      ║
 * ║                       Author: nappier                                    ║
 * ║              Advanced Multi-Device WhatsApp Bot Engine                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Main Brain/Entry point for Nappier XMD WhatsApp Bot
 * Complete Stack Implementation with All Features
 * Powered by Baileys Library & Express.js
 */

require("events").EventEmitter.defaultMaxListeners = 960;

// ═══════════════════════════════════════════════════════════════════════════
// CORE DEPENDENCIES & IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

const {
    default: makeWASocket,
    useMultiFileAuthState,
    MessageType,
    Presence,
    ChatModification,
    proto,
    WAMessageStubType,
    DisconnectReason,
    isJidGroup,
    isJidBroadcast,
    downloadMediaMessage,
    getContentType,
} = require("@whiskeysockets/baileys");

const Boom = require("@hapi/boom");
const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const qrcode = require("qrcode-terminal");
const { Console } = require("console");
const moment = require("moment");

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION LOADER
// ═══════════════════════════════════════════════════════════════════════════

const config = require("./config");

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL VARIABLES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 5000;
const app = express();
let sock;
let qrCodeData = null;
let botConnected = false;

const SESSION_DIR = path.join(__dirname, "session");
const LOGS_DIR = path.join(__dirname, "logs");
const MEDIA_DIR = path.join(__dirname, "media");
const PLUGINS_DIR = path.join(__dirname, "plugins");
const DATABASE_DIR = path.join(__dirname, "database");

// Create directories if they don't exist
fs.ensureDirSync(SESSION_DIR);
fs.ensureDirSync(LOGS_DIR);
fs.ensureDirSync(MEDIA_DIR);
fs.ensureDirSync(PLUGINS_DIR);
fs.ensureDirSync(DATABASE_DIR);

// ═══════════════════════════════════════════════════════════════════════════
// LOGGER SETUP
// ═══════════════════════════════════════════════════════════════════════════

class Logger {
    constructor() {
        this.logFile = path.join(LOGS_DIR, "bot.log");
        this.errorFile = path.join(LOGS_DIR, "error.log");
        this.commandFile = path.join(LOGS_DIR, "commands.log");
    }

    log(msg, type = "INFO") {
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        const logMsg = `[${timestamp}] [${type}] ${msg}`;
        console.log(logMsg);
        this.writeToFile(this.logFile, logMsg);
    }

    error(msg) {
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        const errorMsg = `[${timestamp}] [ERROR] ${msg}`;
        console.error(errorMsg);
        this.writeToFile(this.errorFile, errorMsg);
    }

    command(msg) {
        const timestamp = moment().format("YYYY-MM-DD HH:mm:ss");
        const cmdMsg = `[${timestamp}] [COMMAND] ${msg}`;
        this.writeToFile(this.commandFile, cmdMsg);
    }

    writeToFile(file, msg) {
        fs.appendFileSync(file, msg + "\n", "utf8");
    }
}

const logger = new Logger();

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.loadBuiltInCommands();
        this.loadPlugins();
    }

    register(cmd) {
        if (!cmd.name) return logger.error("Command must have a name");
        this.commands.set(cmd.name, cmd);
        if (cmd.aliases) {
            cmd.aliases.forEach((alias) => {
                this.aliases.set(alias, cmd.name);
            });
        }
        logger.log(`Registered command: ${cmd.name}`, "COMMAND");
    }

    async execute(cmdName, args, context) {
        let command = this.commands.get(cmdName);
        if (!command) {
            const actualCmd = this.aliases.get(cmdName);
            command = this.commands.get(actualCmd);
        }

        if (!command) {
            return `❓ Command *${cmdName}* not found. Use *${config.PREFIX}help* for available commands.`;
        }

        try {
            logger.command(`Executing: ${cmdName} | Args: ${args.join(" ")}`);
            return await command.execute(args, context);
        } catch (err) {
            logger.error(`Command execution error: ${err.message}`);
            return `🚨 Error executing command: ${err.message}`;
        }
    }

    loadBuiltInCommands() {
        // Ping Command
        this.register({
            name: "ping",
            aliases: ["test"],
            description: "Check if bot is responding",
            execute: async () => "🏓 Pong! Bot is alive and responding.",
        });

        // Alive Command
        this.register({
            name: "alive",
            aliases: ["status", "hi"],
            description: "Show bot status and uptime",
            execute: async () => {
                const uptime = process.uptime();
                const hours = Math.floor(uptime / 3600);
                const minutes = Math.floor((uptime % 3600) / 60);
                const seconds = Math.floor(uptime % 60);
                return (
                    `✅ *${config.BOT_NAME}* is alive!\n\n` +
                    `⏱️ Uptime: ${hours}h ${minutes}m ${seconds}s\n` +
                    `📌 Mode: ${config.MODE}\n` +
                    `⚙️ Prefix: ${config.PREFIX}\n` +
                    `🤖 Version: ${config.VERSION}`
                );
            },
        });

        // Help Command
        this.register({
            name: "help",
            aliases: ["commands", "?"],
            description: "Show available commands",
            execute: async () => {
                let helpMsg = `📋 *${config.BOT_NAME} Commands*\n\n`;
                this.commands.forEach((cmd, name) => {
                    helpMsg += `${config.PREFIX}${name} - ${cmd.description}\n`;
                });
                return helpMsg;
            },
        });

        // Owner Command
        this.register({
            name: "owner",
            aliases: ["creator"],
            description: "Show bot owner information",
            execute: async () => {
                return (
                    `👤 *Bot Owner Information*\n\n` +
                    `Name: nappier\n` +
                    `GitHub: @gathara1\n` +
                    `Repository: NAPPIER-XMD`
                );
            },
        });

        // Info Command
        this.register({
            name: "info",
            aliases: ["botinfo"],
            description: "Show bot information",
            execute: async () => {
                return (
                    `ℹ️ *${config.BOT_NAME} Information*\n\n` +
                    `Name: ${config.BOT_NAME}\n` +
                    `Version: ${config.VERSION}\n` +
                    `Mode: ${config.MODE}\n` +
                    `Prefix: ${config.PREFIX}\n` +
                    `Author: nappier\n` +
                    `Repository: ${config.BOT_REPO}`
                );
            },
        });

        // Echo Command
        this.register({
            name: "echo",
            aliases: ["say"],
            description: "Repeat what you say",
            execute: async (args) => {
                return args.length ? args.join(" ") : "Please provide text to echo.";
            },
        });
    }

    loadPlugins() {
        try {
            if (!fs.existsSync(PLUGINS_DIR)) return;
            const files = fs.readdirSync(PLUGINS_DIR);
            files.forEach((file) => {
                if (file.endsWith(".js")) {
                    const cmd = require(path.join(PLUGINS_DIR, file));
                    if (cmd && cmd.name) {
                        this.register(cmd);
                    }
                }
            });
        } catch (err) {
            logger.error(`Failed to load plugins: ${err.message}`);
        }
    }
}

const commandHandler = new CommandHandler();

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE & STORAGE MANAGER
// ═══════════════════════════════════════════════════════════════════════════

class DatabaseManager {
    constructor() {
        this.dataFile = path.join(DATABASE_DIR, "data.json");
        this.loadDatabase();
    }

    loadDatabase() {
        try {
            if (fs.existsSync(this.dataFile)) {
                this.data = JSON.parse(fs.readFileSync(this.dataFile, "utf8"));
            } else {
                this.data = {
                    users: {},
                    groups: {},
                    blocked: [],
                    sudo: [],
                    warnings: {},
                };
                this.save();
            }
        } catch (err) {
            logger.error(`Database load error: ${err.message}`);
            this.data = {
                users: {},
                groups: {},
                blocked: [],
                sudo: [],
                warnings: {},
            };
        }
    }

    save() {
        try {
            fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2), "utf8");
        } catch (err) {
            logger.error(`Database save error: ${err.message}`);
        }
    }

    getUserData(jid) {
        if (!this.data.users[jid]) {
            this.data.users[jid] = { jid, messageCount: 0, lastSeen: null };
            this.save();
        }
        return this.data.users[jid];
    }

    incrementUserMessageCount(jid) {
        const user = this.getUserData(jid);
        user.messageCount++;
        user.lastSeen = new Date();
        this.save();
    }

    addToSudo(jid) {
        if (!this.data.sudo.includes(jid)) {
            this.data.sudo.push(jid);
            this.save();
        }
    }

    removeFromSudo(jid) {
        this.data.sudo = this.data.sudo.filter((j) => j !== jid);
        this.save();
    }

    isSudo(jid) {
        return this.data.sudo.includes(jid) || jid === config.OWNER_NUMBER;
    }

    blockUser(jid) {
        if (!this.data.blocked.includes(jid)) {
            this.data.blocked.push(jid);
            this.save();
        }
    }

    unblockUser(jid) {
        this.data.blocked = this.data.blocked.filter((j) => j !== jid);
        this.save();
    }

    isBlocked(jid) {
        return this.data.blocked.includes(jid);
    }
}

const db = new DatabaseManager();

// ═══════════════════════════════════════════════════════════════════════════
// ANTI-SPAM & RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════

class RateLimiter {
    constructor() {
        this.limits = new Map();
        this.max = 5; // max commands per
        this.window = 10000; // 10 seconds
    }

    isRateLimited(jid) {
        if (!this.limits.has(jid)) {
            this.limits.set(jid, []);
        }

        const now = Date.now();
        const userLimits = this.limits.get(jid).filter((t) => now - t < this.window);

        if (userLimits.length >= this.max) {
            return true;
        }

        userLimits.push(now);
        this.limits.set(jid, userLimits);
        return false;
    }

    reset(jid) {
        this.limits.delete(jid);
    }
}

const rateLimiter = new RateLimiter();

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE PROCESSOR & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

class MessageProcessor {
    static extractText(message) {
        if (message.conversation) {
            return message.conversation;
        } else if (message.extendedTextMessage) {
            return message.extendedTextMessage.text;
        } else if (message.imageMessage?.caption) {
            return message.imageMessage.caption;
        } else if (message.videoMessage?.caption) {
            return message.videoMessage.caption;
        } else if (message.audioMessage?.caption) {
            return message.audioMessage.caption;
        }
        return "";
    }

    static extractCommand(text, prefix) {
        if (!text.startsWith(prefix)) return null;
        const parts = text.slice(1).split(/\s+/);
        return {
            command: parts[0].toLowerCase(),
            args: parts.slice(1),
            fullCommand: text,
        };
    }

    static getMessageType(message) {
        const keys = Object.keys(message);
        const msgType = keys.find(
            (key) =>
                (key.includes("Message") && key !== "messageContextInfo") ||
                key.includes("media") ||
                key.includes("call")
        );
        return msgType || "unknown";
    }

    static async parseMessageContext(m, sock) {
        const message = m.messages[0];
        const jid = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const isGroup = jid.endsWith("@g.us");
        const isBot = message.key.fromMe;
        const text = this.extractText(message.message || {});

        let groupMetadata = null;
        if (isGroup) {
            try {
                groupMetadata = await sock.groupMetadata(jid);
            } catch (err) {
                logger.error(`Failed to get group metadata: ${err.message}`);
            }
        }

        return {
            message,
            jid,
            sender,
            isGroup,
            isBot,
            text,
            groupMetadata,
            messageId: message.key.id,
            timestamp: message.messageTimestamp,
            type: this.getMessageType(message.message || {}),
            pushName: message.pushName || "Unknown",
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPRESS SERVER SETUP & ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Health Check Endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "alive",
        uptime: process.uptime(),
        bot_name: config.BOT_NAME,
        bot_connected: botConnected,
        timestamp: new Date().toISOString(),
        version: config.VERSION,
    });
});

// QR Code Endpoint
app.get("/qr", (req, res) => {
    if (qrCodeData) {
        res.status(200).json({
            qr: qrCodeData,
            status: "pending",
            message: "Scan QR code to connect",
        });
    } else if (botConnected) {
        res.status(200).json({
            status: "connected",
            message: "Bot is already connected",
        });
    } else {
        res.status(200).json({
            status: "loading",
            message: "Bot is initializing",
        });
    }
});

// Bot Status Endpoint
app.get("/status", (req, res) => {
    const status = botConnected ? "connected" : "disconnected";
    res.status(200).json({
        status: status,
        bot_name: config.BOT_NAME,
        version: config.VERSION,
        mode: config.MODE,
        prefix: config.PREFIX,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// API Stats Endpoint
app.get("/stats", (req, res) => {
    const totalUsers = Object.keys(db.data.users).length;
    const totalMessages = Object.values(db.data.users).reduce((sum, u) => sum + u.messageCount, 0);
    const blockedUsers = db.data.blocked.length;
    const sudoUsers = db.data.sudo.length;

    res.status(200).json({
        total_users: totalUsers,
        total_messages: totalMessages,
        blocked_users: blockedUsers,
        sudo_users: sudoUsers,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Main Page
app.get("/", (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${config.BOT_NAME} Dashboard</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 15px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    padding: 40px;
                    max-width: 600px;
                    width: 100%;
                }
                h1 {
                    color: #075e54;
                    margin-bottom: 10px;
                    font-size: 32px;
                }
                .subtitle {
                    color: #666;
                    margin-bottom: 30px;
                    font-size: 14px;
                }
                .status-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .status-card {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 10px;
                    text-align: center;
                    border-left: 4px solid #075e54;
                }
                .status-card label {
                    display: block;
                    font-size: 12px;
                    color: #999;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                }
                .status-card .value {
                    font-size: 20px;
                    color: #075e54;
                    font-weight: bold;
                }
                .status-indicator {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    margin-right: 8px;
                }
                .status-indicator.online { background: #4caf50; }
                .status-indicator.offline { background: #f44336; }
                .info-box {
                    background: #e8f5e9;
                    padding: 15px;
                    border-radius: 10px;
                    border-left: 4px solid #4caf50;
                    margin-bottom: 20px;
                }
                .info-box p {
                    color: #2e7d32;
                    margin: 5px 0;
                    font-size: 14px;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #eee;
                    color: #999;
                    font-size: 12px;
                }
                .refresh-btn {
                    background: #075e54;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 14px;
                    width: 100%;
                    margin-top: 10px;
                }
                .refresh-btn:hover {
                    background: #054540;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 ${config.BOT_NAME}</h1>
                <p class="subtitle">Advanced WhatsApp Bot | v${config.VERSION}</p>

                <div class="status-grid">
                    <div class="status-card">
                        <label>Bot Status</label>
                        <div class="value" id="bot-status">
                            <span class="status-indicator offline"></span>
                            <span>Checking...</span>
                        </div>
                    </div>
                    <div class="status-card">
                        <label>Uptime</label>
                        <div class="value" id="uptime">${hours}h ${minutes}m ${seconds}s</div>
                    </div>
                    <div class="status-card">
                        <label>Mode</label>
                        <div class="value">${config.MODE}</div>
                    </div>
                    <div class="status-card">
                        <label>Prefix</label>
                        <div class="value">${config.PREFIX}</div>
                    </div>
                </div>

                <div class="info-box" id="info-section">
                    <p id="status-msg">Initializing bot...</p>
                </div>

                <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>

                <div class="footer">
                    <p>Made with ❤️ by <strong>nappier</strong></p>
                    <p>© 2026 Nappier XMD | All Rights Reserved</p>
                </div>
            </div>

            <script>
                async function updateStatus() {
                    try {
                        const response = await fetch('/status');
                        const data = await response.json();
                        const statusEl = document.getElementById('bot-status');
                        const msgEl = document.getElementById('status-msg');
                        
                        if (data.status === 'connected') {
                            statusEl.innerHTML = '<span class="status-indicator online"></span><span>Connected</span>';
                            msgEl.textContent = '✅ Bot is connected and running!';
                        } else {
                            statusEl.innerHTML = '<span class="status-indicator offline"></span><span>Disconnected</span>';
                            msgEl.textContent = '⏳ Bot is connecting... Please wait';
                        }
                    } catch (err) {
                        document.getElementById('status-msg').textContent = '❌ Failed to fetch status';
                    }
                }

                updateStatus();
                setInterval(updateStatus, 5000);
            </script>
        </body>
        </html>
    `);
});

const server = app.listen(PORT, () => {
    logger.log(`✅ Server started on http://localhost:${PORT}`, "SERVER");
});

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY & PERFORMANCE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Garbage collection interval
setInterval(() => {
    const used = process.memoryUsage();
    const totalMemory = used.heapTotal / 1024 / 1024;
    const usedMemory = used.heapUsed / 1024 / 1024;
    const memPercent = ((usedMemory / totalMemory) * 100).toFixed(2);

    if (used.heapUsed > 400 * 1024 * 1024) {
        if (global.gc) {
            global.gc();
            logger.log(`Garbage collection triggered (${memPercent}% memory)`, "MEMORY");
        }
    }
}, 60000);

// Health check ping
setInterval(async () => {
    try {
        const http = require("http");
        http.get(`http://localhost:${PORT}/health`, (res) => {
            if (res.statusCode !== 200) {
                logger.log("Health check failed", "WARNING");
            }
        });
    } catch (err) {
        logger.error(`Health check error: ${err.message}`);
    }
}, 240000);

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-FEATURES MODULE
// ═══════════════════════════════════════════════════════════════════════════

class AutoFeatures {
    static emojis = ["😂", "😍", "🔥", "✨", "👍", "💯", "🎉", "❤️", "😢", "🤔"];

    static async handleAutoRead(sock, message, context) {
        if (!config.AUTO_READ_MESSAGES) return;

        const modes = config.AUTO_READ_MESSAGES.split(",").map((m) => m.trim());
        let shouldRead = false;

        if (modes.includes("all")) {
            shouldRead = true;
        } else if (modes.includes("dm") && !context.isGroup) {
            shouldRead = true;
        } else if (modes.includes("groups") && context.isGroup) {
            shouldRead = true;
        }

        if (shouldRead) {
            try {
                await sock.readMessages([message.key]);
            } catch (err) {
                logger.error(`Auto-read error: ${err.message}`);
            }
        }
    }

    static async handleAutoReact(sock, message, context) {
        if (!config.AUTO_REACT) return;

        const modes = config.AUTO_REACT.split(",").map((m) => m.trim());
        let shouldReact = false;

        if (modes.includes("all")) {
            shouldReact = true;
        } else if (modes.includes("dm") && !context.isGroup) {
            shouldReact = true;
        } else if (modes.includes("groups") && context.isGroup) {
            shouldReact = true;
        }

        if (shouldReact) {
            try {
                const emoji = this.emojis[Math.floor(Math.random() * this.emojis.length)];
                await sock.sendMessage(context.jid, {
                    react: { text: emoji, key: message.key },
                });
            } catch (err) {
                logger.error(`Auto-react error: ${err.message}`);
            }
        }
    }

    static async handleAutoBio(sock) {
        if (!config.AUTO_BIO) return;

        try {
            const status = `${config.BOT_NAME} | v${config.VERSION} | ${moment().format("DD/MM/YYYY")}`;
            await sock.updateProfileStatus(status);
            logger.log(`Bio updated: ${status}`, "AUTO_BIO");
        } catch (err) {
            logger.error(`Auto-bio error: ${err.message}`);
        }
    }

    static async handleAutoPresence(sock, jid) {
        if (!config.AUTO_PRESENCE) return;

        try {
            await sock.sendPresenceUpdate("available", jid);
        } catch (err) {
            logger.error(`Auto-presence error: ${err.message}`);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUP MANAGEMENT MODULE
// ═══════════════════════════════════════════════════════════════════════════

class GroupManager {
    static async getGroupInfo(sock, jid) {
        try {
            const metadata = await sock.groupMetadata(jid);
            return {
                subject: metadata.subject,
                participants: metadata.participants,
                participantCount: metadata.participants.length,
                owner: metadata.owner,
                creation: metadata.creation,
                desc: metadata.desc,
                announce: metadata.announce,
            };
        } catch (err) {
            logger.error(`Get group info error: ${err.message}`);
            return null;
        }
    }

    static async isGroupAdmin(sock, jid, sender) {
        try {
            const metadata = await sock.groupMetadata(jid);
            const participant = metadata.participants.find((p) => p.id === sender);
            return participant && (participant.admin || metadata.owner === sender);
        } catch (err) {
            return false;
        }
    }

    static async isGroupMember(sock, jid, sender) {
        try {
            const metadata = await sock.groupMetadata(jid);
            return metadata.participants.some((p) => p.id === sender);
        } catch (err) {
            return false;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// NAPPIER BOT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

async function startNappierBot() {
    try {
        logger.log("═".repeat(70), "STARTUP");
        logger.log(`🚀 Starting ${config.BOT_NAME} v${config.VERSION}`, "STARTUP");
        logger.log(`👤 Author: nappier`, "STARTUP");
        logger.log(`🔧 Prefix: ${config.PREFIX}`, "STARTUP");
        logger.log(`📱 Mode: ${config.MODE}`, "STARTUP");
        logger.log("═".repeat(70), "STARTUP");

        // Load authentication state
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        // Create socket connection
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            downloadHistory: false,
            browser: ["Nappier XMD", "Chrome", "1.0"],
            logger: Pino({ level: "silent" }),
        });

        // ═══════════════════════════════════════════════════════════════════
        // CONNECTION UPDATES
        // ══════════════════════════════════════════��════════════════════════

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCodeData = qr;
                logger.log("📱 QR Code generated - Scan with WhatsApp", "QR");
                qrcode.generate(qr, { small: true });
            }

            if (connection === "connecting") {
                logger.log("⏳ Connecting to WhatsApp...", "CONNECTION");
                botConnected = false;
            } else if (connection === "open") {
                qrCodeData = null;
                botConnected = true;
                logger.log("✅ Connected to WhatsApp!", "CONNECTION");
                logger.log(`💜 Bot: ${config.BOT_NAME}`, "BOT");
                logger.log(`📌 Mode: ${config.MODE}`, "BOT");
                logger.log(`⚙️ Prefix: ${config.PREFIX}`, "BOT");

                // Auto-bio on connect
                if (config.AUTO_BIO) {
                    await AutoFeatures.handleAutoBio(sock);
                }
            } else if (connection === "close") {
                botConnected = false;
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

                if (reason === DisconnectReason.loggedOut) {
                    logger.log("❌ Device logged out. Please scan QR again.", "ERROR");
                    process.exit();
                } else if (reason === DisconnectReason.connectionClosed) {
                    logger.log("⚠️ Connection closed. Reconnecting...", "WARNING");
                    setTimeout(() => startNappierBot(), 3000);
                } else if (reason === DisconnectReason.connectionLost) {
                    logger.log("⚠️ Connection lost. Reconnecting...", "WARNING");
                    setTimeout(() => startNappierBot(), 3000);
                } else if (reason === DisconnectReason.connectionReplaced) {
                    logger.log("⚠️ Connection replaced. Reconnecting...", "WARNING");
                    setTimeout(() => startNappierBot(), 3000);
                } else if (reason === DisconnectReason.restartRequired) {
                    logger.log("🔄 Restart required. Restarting...", "INFO");
                    setTimeout(() => startNappierBot(), 3000);
                } else {
                    logger.log(`Unexpected disconnect (${reason}). Reconnecting...`, "WARNING");
                    setTimeout(() => startNappierBot(), 5000);
                }
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // CREDENTIALS UPDATE
        // ═══════════════════════════════════════════════════════════════════

        sock.ev.on("creds.update", saveCreds);

        // ═══════════════════════════════════════════════════════════════════
        // MESSAGE HANDLING
        // ═══════════════════════════════════════════════════════════════════

        sock.ev.on("messages.upsert", async (m) => {
            try {
                if (m.type !== "notify" && m.type !== "append") return;

                const message = m.messages[0];
                if (!message.message || message.key.fromMe) return;

                // Parse message context
                const context = await MessageProcessor.parseMessageContext(m, sock);

                // Check if user is blocked
                if (db.isBlocked(context.sender)) {
                    logger.log(`Blocked user attempted message: ${context.sender}`, "BLOCKED");
                    return;
                }

                // Update user data
                db.incrementUserMessageCount(context.sender);

                // Log message
                const msgType = `[${context.isGroup ? "GROUP" : "DM"}]`;
                logger.log(
                    `📨 ${msgType} ${context.pushName}: ${context.text.substring(0, 50)}`,
                    "MESSAGE"
                );

                // Auto-read
                await AutoFeatures.handleAutoRead(sock, message, context);

                // Auto-react
                await AutoFeatures.handleAutoReact(sock, message, context);

                // Auto-presence
                await AutoFeatures.handleAutoPresence(sock, context.jid);

                // Check if it's a command
                if (context.text.startsWith(config.PREFIX)) {
                    const cmd = MessageProcessor.extractCommand(context.text, config.PREFIX);
                    if (!cmd) return;

                    // Rate limit check
                    if (rateLimiter.isRateLimited(context.sender)) {
                        await sock.sendMessage(context.jid, {
                            text: `⏱️ Too many commands. Please wait before sending another command.`,
                        });
                        return;
                    }

                    // Execute command
                    logger.log(
                        `🔧 Command: ${cmd.command} | User: ${context.pushName} | Args: ${cmd.args.join(" ")}`,
                        "COMMAND"
                    );

                    try {
                        const response = await commandHandler.execute(cmd.command, cmd.args, {
                            sock,
                            message,
                            context,
                            db,
                            GroupManager,
                        });

                        if (response) {
                            await sock.sendMessage(context.jid, {
                                text: response,
                            });
                        }
                    } catch (err) {
                        logger.error(`Command execution error: ${err.message}`);
                        await sock.sendMessage(context.jid, {
                            text: `🚨 Error executing command: ${err.message}`,
                        });
                    }
                }
            } catch (err) {
                logger.error(`Message handler error: ${err.message}`);
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // GROUP UPDATES
        // ═══════════════════════════════════════════════════════════════════

        sock.ev.on("groups.update", (groupUpdates) => {
            groupUpdates.forEach((group) => {
                logger.log(`👥 Group updated: ${group.id}`, "GROUP");
            });
        });

        // ═══════════════════════════════════════════════════════════════════
        // CHAT UPDATES
        // ═══════════════════════════════════════════════════════════════════

        sock.ev.on("chats.update", (chats) => {
            logger.log(`💬 ${chats.length} chat(s) updated`, "CHAT");
        });

        // ═══════════════════════════════════════════════════════════════════
        // PRESENCE UPDATES
        // ═══════════════════════════════════════════════════════════════════

        sock.ev.on("presence.update", (presenceUpdates) => {
            presenceUpdates.forEach((presence) => {
                const status = presence.lastSeen ? "offline" : "online";
                logger.log(`👤 Presence: ${presence.id} - ${status}`, "PRESENCE");
            });
        });

        // ═══════════════════════════════════════════════════════════════════
        // CALL HANDLING
        // ═══════════════════════════════════════════════════════════════════

        sock.ev.on("call", async (calls) => {
            for (const call of calls) {
                logger.log(`📞 Call received from: ${call.from}`, "CALL");
                if (config.REJECT_CALLS) {
                    try {
                        await sock.rejectCall(call.id, call.from);
                        logger.log(`📞 Call rejected from: ${call.from}`, "CALL");
                    } catch (err) {
                        logger.error(`Call rejection error: ${err.message}`);
                    }
                }
            }
        });
    } catch (error) {
        logger.error(`Fatal bot initialization error: ${error.message}`);
        logger.log("🔄 Retrying in 5 seconds...", "RETRY");
        setTimeout(() => startNappierBot(), 5000);
    }
}

// ══════════════════════════════════════════════════════════════════════��════
// GRACEFUL SHUTDOWN HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

process.on("SIGINT", async () => {
    logger.log("═".repeat(70), "SHUTDOWN");
    logger.log("🛑 Shutting down bot gracefully...", "SHUTDOWN");
    if (sock) {
        try {
            await sock.end();
        } catch (err) {
            logger.error(`Error closing socket: ${err.message}`);
        }
    }
    server.close(() => {
        logger.log("✅ Server closed successfully", "SHUTDOWN");
        logger.log("═".repeat(70), "SHUTDOWN");
        process.exit(0);
    });
});

process.on("SIGTERM", async () => {
    logger.log("═".repeat(70), "SHUTDOWN");
    logger.log("🛑 Shutting down bot (SIGTERM)...", "SHUTDOWN");
    if (sock) {
        try {
            await sock.end();
        } catch (err) {
            logger.error(`Error closing socket: ${err.message}`);
        }
    }
    server.close(() => {
        logger.log("✅ Server closed successfully", "SHUTDOWN");
        logger.log("═".repeat(70), "SHUTDOWN");
        process.exit(0);
    });
});

process.on("uncaughtException", (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    logger.error(`Stack: ${err.stack}`);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error(`Unhandled Rejection at ${promise}: ${reason}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// BOT STARTUP
// ═══════════════════════════════════════════════════════════════════════════

startNappierBot().catch((err) => {
    logger.error(`Failed to start bot: ${err.message}`);
    process.exit(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
    sock,
    startNappierBot,
    commandHandler,
    db,
    logger,
    AutoFeatures,
    GroupManager,
    MessageProcessor,
    RateLimiter,
    DatabaseManager,
};
