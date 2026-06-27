/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    NAPPIER-XMD - WHATSAPP BOT                           ║
 * ║                    Version: 2.0.0 | Pure NAPPIER-XMD                    ║
 * ║                       © 2026 Nappier                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

console.log('[NAPPIER-XMD] Starting...');

require("events").EventEmitter.defaultMaxListeners = 960;

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    isJidGroup,
} = require("@whiskeysockets/baileys");

const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
const chalk = require("chalk");
const axios = require("axios");
const moment = require("moment");

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const config = {
    OWNER_NUMBER: process.env.OWNER_NUMBER || "",
    PORT: process.env.PORT || 3000,
    BOT_NAME: "NAPPIER-XMD",
    PREFIX: ".",
    MODE: "public",
    COPYRIGHT: "© 2026 Nappier | All Rights Reserved",
    WA_CHANNEL: "https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y",
    WA_NUMBER: "https://wa.me/254735638957",
    INSTAGRAM: "https://www.instagram.com/l.ycifer",
    TELEGRAM: "https://t.me/+254723270450",
    GITHUB: "https://github.com/gathara1/NAPPIER-XMD",
    LOGO_URL: "https://img.sanishtech.com/u/db971cb39b6eee4a066c712bd5fb7565.png"
};

// ═══════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════

const FOOTER = `\n\n━━━━━━━━━━━━━━━━━━━━━━\nPowered by NAPPIER-XMD v2.0.0\n📢 ${config.WA_CHANNEL}\n📱 ${config.WA_NUMBER}\n📱 ${config.INSTAGRAM}\n💬 ${config.TELEGRAM}\n🔗 ${config.GITHUB}\n━━━━━━━━━━━━━━━━━━━━━━\n${config.COPYRIGHT}`;

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

const app = express();
let sock = null;
let botConnected = false;
const BOT_START = Date.now();
let totalMessages = 0;
let totalUsers = new Set();

// Create directories
const dirs = ['session', 'logs', 'database', 'public'];
dirs.forEach(d => {
    try { fs.ensureDirSync(path.join(__dirname, d)); } catch (e) {}
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════════════════════

class Logger {
    log(msg, type = "INFO") {
        const ts = moment().format("YYYY-MM-DD HH:mm:ss");
        console.log(`[${ts}] [${type}] ${msg}`);
    }
    error(msg) {
        const ts = moment().format("YYYY-MM-DD HH:mm:ss");
        console.error(chalk.red(`[${ts}] [ERROR] ${msg}`));
    }
}

const logger = new Logger();

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════════════

class Database {
    constructor() {
        this.file = path.join(__dirname, "database", "data.json");
        this.load();
    }
    
    load() {
        try {
            if (fs.existsSync(this.file)) {
                this.data = JSON.parse(fs.readFileSync(this.file, "utf8"));
            } else {
                this.data = { users: {}, stats: { totalMessages: 0, totalCommands: 0, totalUsers: 0 } };
                this.save();
            }
        } catch (e) {
            this.data = { users: {}, stats: { totalMessages: 0, totalCommands: 0, totalUsers: 0 } };
        }
    }
    
    save() {
        try {
            fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), "utf8");
        } catch (e) {}
    }
    
    getUser(jid) {
        if (!this.data.users[jid]) {
            this.data.users[jid] = { jid, messages: 0, commands: 0, joined: Date.now() };
            this.data.stats.totalUsers = Object.keys(this.data.users).length;
            this.save();
        }
        return this.data.users[jid];
    }
    
    addMessage(jid) {
        const user = this.getUser(jid);
        user.messages++;
        this.data.stats.totalMessages++;
        this.save();
    }
    
    addCommand(jid) {
        const user = this.getUser(jid);
        user.commands++;
        this.data.stats.totalCommands++;
        this.save();
    }
}

const db = new Database();

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.loadCommands();
    }
    
    addFooter(msg) { return msg + FOOTER; }
    
    formatUptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${d}d ${h}h ${m}m ${s}s`;
    }
    
    loadCommands() {
        // Basic Commands
        this.register("ping", ["pong"], "Check bot response",
            async () => this.addFooter("🏓 Pong! Bot is alive."));
        
        this.register("alive", ["status"], "Show bot status",
            async () => {
                const uptime = (Date.now() - BOT_START) / 1000;
                return this.addFooter(
                    `✅ *${config.BOT_NAME}* is alive!\n\n` +
                    `⏱️ Uptime: ${this.formatUptime(uptime)}\n` +
                    `📌 Mode: ${config.MODE}\n` +
                    `⚙️ Prefix: ${config.PREFIX}\n` +
                    `📊 Commands: ${this.commands.size}\n` +
                    `👥 Users: ${db.data.stats.totalUsers}\n` +
                    `💬 Messages: ${db.data.stats.totalMessages}`
                );
            });
        
        this.register("help", ["commands"], "Show all commands",
            async () => {
                let msg = `📋 *${config.BOT_NAME} Commands (${this.commands.size})*\n\n`;
                for (const [name, cmd] of this.commands) {
                    msg += `  ${config.PREFIX}${name} - ${cmd.desc}\n`;
                }
                return this.addFooter(msg);
            });
        
        this.register("owner", ["creator"], "Bot owner info",
            async () => this.addFooter(
                `👤 *Bot Owner*\n\n` +
                `Name: Nappier\n` +
                `GitHub: ${config.GITHUB}\n` +
                `Bot: ${config.BOT_NAME} v2.0.0\n\n` +
                `📢 ${config.WA_CHANNEL}`
            ));
        
        this.register("info", ["botinfo"], "Bot information",
            async () => this.addFooter(
                `ℹ️ *${config.BOT_NAME}*\n\n` +
                `📌 Version: 2.0.0\n` +
                `📌 Mode: ${config.MODE}\n` +
                `📌 Prefix: ${config.PREFIX}\n` +
                `📌 Commands: ${this.commands.size}\n` +
                `📌 Author: Nappier\n` +
                `📌 GitHub: ${config.GITHUB}`
            ));
        
        this.register("uptime", ["up"], "Bot uptime",
            async () => this.addFooter(
                `⏱️ Uptime: ${this.formatUptime((Date.now() - BOT_START) / 1000)}`
            ));
        
        this.register("stats", ["statistics"], "Bot statistics",
            async () => this.addFooter(
                `📊 *${config.BOT_NAME} Statistics*\n\n` +
                `👥 Users: ${db.data.stats.totalUsers}\n` +
                `💬 Messages: ${db.data.stats.totalMessages}\n` +
                `⚡ Commands Executed: ${db.data.stats.totalCommands}\n` +
                `📋 Total Commands: ${this.commands.size}\n` +
                `⏱️ Uptime: ${this.formatUptime((Date.now() - BOT_START) / 1000)}`
            ));

        // Games
        this.register("truth", ["truth"], "Truth question",
            async () => {
                const truths = ["What's your biggest fear?", "What's the most embarrassing thing you've done?", "Who do you have a crush on?"];
                return this.addFooter(`💯 Truth: ${truths[Math.floor(Math.random() * truths.length)]}`);
            });
        
        this.register("dare", ["dare"], "Dare challenge",
            async () => {
                const dares = ["Do 10 pushups right now!", "Sing a song loudly!", "Send your last photo!"];
                return this.addFooter(`😈 Dare: ${dares[Math.floor(Math.random() * dares.length)]}`);
            });
        
        this.register("coinflip", ["cf"], "Flip a coin",
            async () => this.addFooter(Math.random() > 0.5 ? "🪙 Heads" : "🪙 Tails"));
        
        this.register("dice", ["roll"], "Roll a dice",
            async () => this.addFooter(`🎲 You rolled: ${Math.floor(Math.random() * 6) + 1}`));
        
        this.register("joke", ["funny"], "Random joke",
            async () => {
                const jokes = ["Why don't scientists trust atoms? They make up everything!", "What do you call a fake noodle? An impasta!"];
                return this.addFooter(`😂 ${jokes[Math.floor(Math.random() * jokes.length)]}`);
            });
        
        this.register("quote", ["motivation"], "Random quote",
            async () => {
                const quotes = ["The best way to predict the future is to create it.", "Success is not final, failure is not fatal."];
                return this.addFooter(`💬 "${quotes[Math.floor(Math.random() * quotes.length)]}"`);
            });

        // Group Commands
        this.register("tagall", ["everyone"], "Tag all group members",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ Admin only!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                const members = ctx.groupMetadata.participants.slice(0, 30).map(p => `@${p.id.split("@")[0]}`).join(" ");
                return this.addFooter(`📢 *Tagging all members*\n\n${members}`);
            });
        
        this.register("groupinfo", ["gcinfo"], "Group information",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                const meta = ctx.groupMetadata;
                return this.addFooter(
                    `📊 *Group Info*\n\n` +
                    `📌 Name: ${meta.subject}\n` +
                    `👥 Members: ${meta.participants.length}\n` +
                    `👑 Admins: ${meta.participants.filter(p => p.admin).length}`
                );
            });

        // Utility
        this.register("weather", ["temp"], "Weather information",
            async (args) => {
                if (!args.length) return "❌ Provide a city name!";
                try {
                    const res = await axios.get(`https://wttr.in/${args.join("")}?format=%C+%t`);
                    return this.addFooter(`🌤️ Weather in ${args.join(" ")}: ${res.data}`);
                } catch (e) {
                    return this.addFooter("❌ Could not fetch weather data!");
                }
            });
        
        this.register("shorten", ["short"], "Shorten URL",
            async (args) => {
                if (!args.length) return "❌ Provide a URL!";
                try {
                    const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(args[0])}`);
                    return this.addFooter(`🔗 Shortened URL: ${res.data}`);
                } catch (e) {
                    return this.addFooter("❌ Could not shorten URL!");
                }
            });
        
        this.register("calc", ["calculate"], "Calculate expression",
            async (args) => {
                if (!args.length) return "❌ Provide an expression!";
                try {
                    const result = eval(args.join(" "));
                    return this.addFooter(`🧮 Result: ${result}`);
                } catch (e) {
                    return this.addFooter("❌ Invalid expression!");
                }
            });

        logger.log(`✅ Loaded ${this.commands.size} commands`, "COMMANDS");
    }

    register(name, aliases = [], desc, fn) {
        this.commands.set(name, { name, aliases, desc, fn });
        aliases.forEach(alias => this.aliases.set(alias, name));
    }

    async execute(name, args, ctx) {
        let cmd = this.commands.get(name);
        if (!cmd) {
            const alias = this.aliases.get(name);
            if (alias) cmd = this.commands.get(alias);
        }
        if (!cmd) return null;
        try {
            return await cmd.fn(args, ctx) || this.addFooter("✅ Done!");
        } catch (e) {
            return this.addFooter(`❌ Error: ${e.message}`);
        }
    }
}

const commands = new CommandHandler();

// ═══════════════════════════════════════════════════════════════════════════
// WEB DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.json());

app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${config.BOT_NAME} - Dashboard</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .container {
                    background: rgba(255,255,255,0.05);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 700px;
                    width: 100%;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                h1 { color: #fff; text-align: center; font-size: 32px; margin-bottom: 5px; }
                h1 span { color: #7c3aed; }
                .subtitle { text-align: center; color: #8892b0; margin-bottom: 30px; }
                .stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                    padding: 15px;
                    text-align: center;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .stat-card .value { color: #fff; font-size: 24px; font-weight: bold; }
                .stat-card .label { color: #8892b0; font-size: 12px; text-transform: uppercase; }
                .status {
                    text-align: center;
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                }
                .status.online {
                    background: rgba(0, 255, 0, 0.1);
                    border: 1px solid rgba(0, 255, 0, 0.2);
                    color: #4ade80;
                }
                .status.offline {
                    background: rgba(255, 0, 0, 0.1);
                    border: 1px solid rgba(255, 0, 0, 0.2);
                    color: #f87171;
                }
                .footer {
                    text-align: center;
                    color: #8892b0;
                    font-size: 12px;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }
                .copy { color: #8892b0; font-size: 11px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 <span>${config.BOT_NAME}</span></h1>
                <p class="subtitle">Advanced WhatsApp Bot | v2.0.0</p>
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="value">${commands.commands.size}</div>
                        <div class="label">Commands</div>
                    </div>
                    <div class="stat-card">
                        <div class="value" id="users">${db.data.stats.totalUsers}</div>
                        <div class="label">Users</div>
                    </div>
                    <div class="stat-card">
                        <div class="value" id="messages">${db.data.stats.totalMessages}</div>
                        <div class="label">Messages</div>
                    </div>
                </div>
                
                <div class="status ${botConnected ? 'online' : 'offline'}" id="status">
                    ${botConnected ? '✅ Connected to WhatsApp' : '❌ Disconnected - Please wait'}
                </div>
                
                <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;margin:10px 0;">
                    <p style="color:#8892b0;font-size:13px;">
                        💡 Try: <code style="color:#7c3aed;">${config.PREFIX}ping</code> • 
                        <code style="color:#7c3aed;">${config.PREFIX}alive</code> • 
                        <code style="color:#7c3aed;">${config.PREFIX}help</code>
                    </p>
                </div>
                
                <div class="footer">
                    <p>Powered by NAPPIER-XMD v2.0.0</p>
                    <p>📢 ${config.WA_CHANNEL}</p>
                    <p class="copy">${config.COPYRIGHT}</p>
                </div>
            </div>
            
            <script>
                async function updateStatus() {
                    try {
                        const res = await fetch('/api/status');
                        const data = await res.json();
                        const statusEl = document.getElementById('status');
                        if (data.status === 'connected') {
                            statusEl.className = 'status online';
                            statusEl.textContent = '✅ Connected to WhatsApp';
                        } else {
                            statusEl.className = 'status offline';
                            statusEl.textContent = '❌ Disconnected - Please wait';
                        }
                        document.getElementById('users').textContent = data.users || 0;
                        document.getElementById('messages').textContent = data.messages || 0;
                    } catch (e) {}
                }
                setInterval(updateStatus, 5000);
                updateStatus();
            </script>
        </body>
        </html>
    `);
});

app.get("/api/status", (req, res) => {
    res.json({
        status: botConnected ? "connected" : "disconnected",
        bot_name: config.BOT_NAME,
        version: "2.0.0",
        commands: commands.commands.size,
        users: db.data.stats.totalUsers,
        messages: db.data.stats.totalMessages,
        uptime: (Date.now() - BOT_START) / 1000
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

const server = app.listen(config.PORT, () => {
    logger.log(`✅ Server on port ${config.PORT}`, "SERVER");
});

// ═══════════════════════════════════════════════════════════════════════════
// BOT CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

async function startBot() {
    try {
        logger.log("═".repeat(60), "STARTUP");
        logger.log(`🚀 ${config.BOT_NAME} v2.0.0`, "STARTUP");
        logger.log(`📊 ${commands.commands.size} Commands Loaded`, "STARTUP");
        logger.log(`📢 ${config.WA_CHANNEL}`, "CHANNEL");
        logger.log(`© ${config.COPYRIGHT}`, "COPYRIGHT");
        logger.log("═".repeat(60), "STARTUP");

        const sessionDir = path.join(__dirname, "session");
        fs.ensureDirSync(sessionDir);

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        sock = makeWASocket({
            auth: state,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            browser: ["NAPPIER-XMD", "Chrome", "2.0.0"],
            logger: pino({ level: "silent" }),
        });

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                logger.log("📱 QR Code generated - Scan with WhatsApp", "QR");
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === "open") {
                botConnected = true;
                logger.log("✅ Connected to WhatsApp!", "CONNECTION");
                logger.log(`💜 ${commands.commands.size} Commands Ready`, "BOT");
                logger.log(`📢 Join our channel: ${config.WA_CHANNEL}`, "CHANNEL");
            } else if (connection === "close") {
                botConnected = false;
                const reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === 405) {
                    logger.log("⚠️ Session invalid (405). Generating new QR code...", "ERROR");
                } else {
                    logger.log(`⚠️ Disconnected (${reason}). Reconnecting...`, "WARNING");
                }
                setTimeout(startBot, 3000);
            }
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("messages.upsert", async (m) => {
            try {
                if (m.type !== "notify") return;
                const msg = m.messages[0];
                if (!msg?.message || msg.key.fromMe) return;

                const jid = msg.key.remoteJid;
                const sender = msg.key.participant || jid;
                const isGroup = jid?.endsWith("@g.us") || false;

                totalUsers.add(sender);
                totalMessages++;
                db.addMessage(sender);

                let text = "";
                if (msg.message.conversation) text = msg.message.conversation;
                else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text || "";
                else return;

                if (text.startsWith(config.PREFIX)) {
                    const parts = text.slice(1).split(/\s+/);
                    const cmd = parts[0].toLowerCase();
                    const args = parts.slice(1);

                    let groupMetadata = null;
                    let isAdmin = false;
                    let isBotAdmin = false;

                    if (isGroup) {
                        try {
                            groupMetadata = await sock.groupMetadata(jid);
                            isAdmin = groupMetadata?.participants?.find(p => p.id === sender)?.admin || false;
                            isBotAdmin = groupMetadata?.participants?.find(p => p.id === sock.user.id)?.admin || false;
                        } catch (e) {}
                    }

                    const ctx = {
                        sock,
                        msg,
                        jid,
                        sender,
                        isGroup,
                        groupMetadata,
                        isAdmin,
                        isBotAdmin,
                        pushName: msg.pushName || "Unknown",
                        args,
                    };

                    db.addCommand(sender);
                    const response = await commands.execute(cmd, args, ctx);
                    if (response) {
                        await sock.sendMessage(jid, { text: response });
                    }
                }
            } catch (err) {
                logger.error(`Message error: ${err.message}`);
            }
        });

    } catch (err) {
        logger.error(`Start error: ${err.message}`);
        setTimeout(startBot, 5000);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════

process.on("SIGINT", async () => {
    logger.log("🛑 Shutting down...", "SHUTDOWN");
    if (sock) await sock.end();
    server.close(() => process.exit(0));
});

process.on("SIGTERM", async () => {
    logger.log("🛑 Shutting down...", "SHUTDOWN");
    if (sock) await sock.end();
    server.close(() => process.exit(0));
});

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

startBot().catch(err => {
    logger.error(`Failed: ${err.message}`);
    process.exit(1);
});

module.exports = { sock, startBot, commands, db, config };
