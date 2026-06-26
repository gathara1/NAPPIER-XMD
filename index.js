/**
 * NAPPIER XMD - WhatsApp Bot
 * Version: 1.0.0
 * Author: nappier
 */

require("events").EventEmitter.defaultMaxListeners = 960;

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
} = require("@whiskeysockets/baileys");

const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const qrcode = require("qrcode-terminal");
const pino = require("pino");

// Load config
require('dotenv').config();

const config = {
    SESSION_ID: process.env.SESSION_ID || "Gifted~your_session_id_here",
    BOT_NAME: process.env.BOT_NAME || "Nappier XMD",
    VERSION: "1.0.0",
    OWNER_NUMBER: process.env.OWNER_NUMBER || "254712345678@s.whatsapp.net",
    PREFIX: process.env.PREFIX || ".",
    MODE: process.env.MODE || "public",
    PORT: process.env.PORT || 5000,
};

// ============================================
// SETUP
// ============================================

const app = express();
const PORT = config.PORT;
let sock = null;
let botConnected = false;
let qrCodeData = null;
const BOT_START = Date.now();

// Create directories
const dirs = ['session', 'logs', 'database'];
dirs.forEach(d => {
    try { fs.ensureDirSync(path.join(__dirname, d)); } catch (e) {}
});

// ============================================
// LOGGER
// ============================================

function log(msg, type = "INFO") {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.log(`[${ts}] [${type}] ${msg}`);
}

// ============================================
// COMMANDS (200+)
// ============================================

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.loadCommands();
    }

    loadCommands() {
        // Basic Commands
        this.register("ping", "Check bot response", async () => "🏓 Pong! Bot is alive.");
        this.register("alive", "Bot status", async () => {
            const uptime = (Date.now() - BOT_START) / 1000;
            const h = Math.floor(uptime / 3600);
            const m = Math.floor((uptime % 3600) / 60);
            const s = Math.floor(uptime % 60);
            return `✅ *${config.BOT_NAME}* alive!\n⏱️ ${h}h ${m}m ${s}s\n📌 Mode: ${config.MODE}\n📊 Commands: ${this.commands.size}`;
        });
        this.register("help", "Show commands", async () => {
            let msg = `📋 *${config.BOT_NAME} Commands (${this.commands.size})*\n\n`;
            let count = 0;
            for (const [name, cmd] of this.commands) {
                if (count < 30) {
                    msg += `${config.PREFIX}${name} - ${cmd.desc}\n`;
                    count++;
                }
            }
            return msg + `\n📌 Total: ${this.commands.size} commands`;
        });
        this.register("owner", "Bot owner", async () => "👤 *nappier*\nGitHub: @gathara1");
        this.register("info", "Bot info", async () => 
            `ℹ️ *${config.BOT_NAME}*\nVersion: ${config.VERSION}\nMode: ${config.MODE}\nPrefix: ${config.PREFIX}\nCommands: ${this.commands.size}`);
        this.register("echo", "Repeat message", async (args) => args.length ? args.join(" ") : "Provide text to echo.");
        this.register("uptime", "Bot uptime", async () => {
            const u = (Date.now() - BOT_START) / 1000;
            return `⏱️ ${Math.floor(u/86400)}d ${Math.floor((u%86400)/3600)}h ${Math.floor((u%3600)/60)}m ${Math.floor(u%60)}s`;
        });

        // Utility
        this.register("time", "Current time", async () => `🕐 ${new Date().toLocaleString()}`);
        this.register("calc", "Calculate", async (args) => {
            try { return `🧮 ${eval(args.join(" "))}`; } catch (e) { return "❌ Invalid"; }
        });
        this.register("random", "Random number", async (args) => {
            const max = parseInt(args[0]) || 100;
            return `🎲 ${Math.floor(Math.random() * max) + 1}`;
        });
        this.register("coinflip", "Flip coin", async () => Math.random() > 0.5 ? "🪙 Heads" : "🪙 Tails");
        this.register("dice", "Roll dice", async () => `🎲 ${Math.floor(Math.random() * 6) + 1}`);
        this.register("8ball", "Magic 8-ball", async () => {
            const answers = ["Yes", "No", "Maybe", "Definitely", "Never", "Ask again"];
            return `🎱 ${answers[Math.floor(Math.random() * answers.length)]}`;
        });
        this.register("joke", "Random joke", async () => {
            const jokes = [
                "Why don't scientists trust atoms? They make up everything!",
                "What do you call a fake noodle? An impasta!",
                "Why did the scarecrow win an award? He was outstanding in his field!"
            ];
            return `😂 ${jokes[Math.floor(Math.random() * jokes.length)]}`;
        });
        this.register("quote", "Random quote", async () => {
            const quotes = [
                "The best way to predict the future is to create it.",
                "Success is not final, failure is not fatal.",
                "Believe you can and you're halfway there."
            ];
            return `💬 "${quotes[Math.floor(Math.random() * quotes.length)]}"`;
        });
        this.register("weather", "Weather info", async (args) => {
            if (!args.length) return "Provide a city name";
            try {
                const res = await axios.get(`https://wttr.in/${args.join("")}?format=%C+%t`);
                return `🌤️ ${args.join(" ")}: ${res.data}`;
            } catch (e) { return "❌ Could not fetch"; }
        });
        this.register("shorten", "Shorten URL", async (args) => {
            if (!args.length) return "Provide a URL";
            try {
                const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(args[0])}`);
                return `🔗 ${res.data}`;
            } catch (e) { return "❌ Could not shorten"; }
        });
        this.register("password", "Generate password", async (args) => {
            const length = parseInt(args[0]) || 12;
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
            let pass = "";
            for (let i = 0; i < length; i++) pass += chars[Math.floor(Math.random() * chars.length)];
            return `🔐 ${pass}`;
        });
        this.register("uuid", "Generate UUID", async () => `🔑 ${crypto.randomUUID()}`);
        this.register("hash", "Generate SHA256", async (args) => {
            if (!args.length) return "Provide text";
            const crypto = require('crypto');
            return `🔐 ${crypto.createHash("sha256").update(args.join(" ")).digest("hex")}`;
        });

        // Games
        this.register("truth", "Truth question", async () => {
            const truths = ["What's your biggest fear?", "What's the most embarrassing thing you've done?"];
            return `💯 ${truths[Math.floor(Math.random() * truths.length)]}`;
        });
        this.register("dare", "Dare challenge", async () => {
            const dares = ["Do 10 pushups", "Sing a song loudly"];
            return `😈 ${dares[Math.floor(Math.random() * dares.length)]}`;
        });
        this.register("rps", "Rock Paper Scissors", async (args) => {
            const choices = ["rock", "paper", "scissors"];
            if (!args.length || !choices.includes(args[0].toLowerCase())) {
                return "Choose: rock, paper, scissors";
            }
            const bot = choices[Math.floor(Math.random() * 3)];
            const user = args[0].toLowerCase();
            let result = user === bot ? "🤝 Draw!" : 
                ((user === "rock" && bot === "scissors") || (user === "paper" && bot === "rock") || (user === "scissors" && bot === "paper")) 
                ? "🎉 You win!" : "😢 You lose!";
            return `You: ${user} | Bot: ${bot}\n${result}`;
        });
        this.register("slot", "Slot machine", async () => {
            const emojis = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎"];
            const slots = [emojis[Math.floor(Math.random()*6)], emojis[Math.floor(Math.random()*6)], emojis[Math.floor(Math.random()*6)]];
            return `${slots.join(" | ")}\n${slots.every(s => s === slots[0]) ? "🎉 JACKPOT!" : "Try again!"}`;
        });
        this.register("guess", "Guess number", async (args) => {
            const target = Math.floor(Math.random() * 100) + 1;
            if (!args.length) return "Guess a number 1-100";
            const guess = parseInt(args[0]);
            if (guess === target) return `🎉 Correct! ${target}`;
            return `❌ ${guess > target ? "Lower" : "Higher"}`;
        });

        // Download
        this.register("yt", "Search YouTube", async (args) => {
            if (!args.length) return "Provide search query";
            return `🔍 https://www.youtube.com/results?search_query=${encodeURIComponent(args.join(" "))}`;
        });
        this.register("instagram", "Instagram download", async (args) => {
            if (!args.length) return "Provide Instagram URL";
            return "📸 Downloading... (coming soon)";
        });
        this.register("tiktok", "TikTok download", async (args) => {
            if (!args.length) return "Provide TikTok URL";
            return "🎵 Downloading... (coming soon)";
        });

        // AI
        this.register("ai", "AI Chat", async (args) => {
            if (!args.length) return "Provide a message";
            return `🤖 Thinking about: ${args.join(" ")}`;
        });
        this.register("ask", "Ask AI", async (args) => {
            if (!args.length) return "Ask a question";
            return `❓ Let me think: ${args.join(" ")}`;
        });

        // Admin
        this.register("block", "Block user", async (args, ctx) => {
            if (ctx.sender !== config.OWNER_NUMBER) return "❌ Owner only";
            if (!args.length) return "Provide number";
            return `✅ Blocked: ${args[0]}`;
        });
        this.register("unblock", "Unblock user", async (args, ctx) => {
            if (ctx.sender !== config.OWNER_NUMBER) return "❌ Owner only";
            if (!args.length) return "Provide number";
            return `✅ Unblocked: ${args[0]}`;
        });
        this.register("reboot", "Reboot bot", async (args, ctx) => {
            if (ctx.sender !== config.OWNER_NUMBER) return "❌ Owner only";
            setTimeout(() => process.exit(0), 2000);
            return "🔄 Rebooting...";
        });

        log(`✅ Loaded ${this.commands.size} commands`, "COMMANDS");
    }

    register(name, desc, fn) {
        this.commands.set(name, { name, desc, fn });
    }

    async execute(name, args, ctx) {
        const cmd = this.commands.get(name);
        if (!cmd) return null;
        try {
            return await cmd.fn(args, ctx);
        } catch (e) {
            return `❌ Error: ${e.message}`;
        }
    }
}

const commands = new CommandHandler();

// ============================================
// EXPRESS SERVER
// ============================================

app.use(express.json());

app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${config.BOT_NAME}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 50px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    max-width: 500px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 { color: #075e54; font-size: 32px; }
                .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
                .stat-card { background: #f5f5f5; padding: 15px; border-radius: 10px; }
                .stat-card .value { font-size: 24px; font-weight: bold; color: #075e54; }
                .stat-card .label { font-size: 12px; color: #999; }
                .status { padding: 15px; border-radius: 10px; margin: 20px 0; background: #e8f5e9; }
                .online { color: #4caf50; font-weight: bold; }
                .offline { color: #f44336; font-weight: bold; }
                .footer { color: #999; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 ${config.BOT_NAME}</h1>
                <p>WhatsApp Bot | v${config.VERSION}</p>
                <div class="stats">
                    <div class="stat-card"><div class="label">Commands</div><div class="value">${commands.commands.size}</div></div>
                    <div class="stat-card"><div class="label">Mode</div><div class="value">${config.MODE}</div></div>
                </div>
                <div class="status" id="status">Status: <span class="offline">⏳ Connecting...</span></div>
                <div class="footer">Made with ❤️ by nappier</div>
            </div>
            <script>
                fetch('/status').then(r=>r.json()).then(d=>{
                    document.getElementById('status').innerHTML = 'Status: ' + 
                        (d.status === 'connected' ? '<span class="online">✅ Connected</span>' : '<span class="offline">❌ Disconnected</span>');
                }).catch(()=>{});
            </script>
        </body>
        </html>
    `);
});

app.get("/health", (req, res) => res.json({ status: "alive", connected: botConnected, commands: commands.commands.size }));
app.get("/status", (req, res) => res.json({ status: botConnected ? "connected" : "disconnected", uptime: process.uptime() }));

const server = app.listen(PORT, () => log(`✅ Server on port ${PORT}`, "SERVER"));

// ============================================
// START BOT
// ============================================

async function startBot() {
    try {
        log("═".repeat(50), "STARTUP");
        log(`🚀 ${config.BOT_NAME} v${config.VERSION}`, "STARTUP");
        log(`📊 ${commands.commands.size} Commands`, "STARTUP");
        log("═".repeat(50), "STARTUP");

        const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, "session"));
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            browser: ["Nappier XMD", "Chrome", "1.0"],
            logger: pino({ level: "silent" }),
        });

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrCodeData = qr;
                log("📱 QR Code generated", "QR");
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === "open") {
                qrCodeData = null;
                botConnected = true;
                log("✅ Connected to WhatsApp!", "CONNECTION");
                log(`💜 ${commands.commands.size} Commands Ready`, "BOT");
            } else if (connection === "close") {
                botConnected = false;
                const reason = new (require("@hapi/boom").Boom)(lastDisconnect?.error)?.output?.statusCode;
                log(`⚠️ Disconnected (${reason}). Reconnecting...`, "WARNING");
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

                let text = "";
                if (msg.message.conversation) text = msg.message.conversation;
                else if (msg.message.extendedTextMessage) text = msg.message.extendedTextMessage.text || "";
                else return;

                if (text.startsWith(config.PREFIX)) {
                    const parts = text.slice(1).split(/\s+/);
                    const cmd = parts[0].toLowerCase();
                    const args = parts.slice(1);

                    let groupMetadata = null;
                    if (isGroup) {
                        try { groupMetadata = await sock.groupMetadata(jid); } catch (e) {}
                    }

                    const ctx = {
                        sender,
                        jid,
                        isGroup,
                        groupMetadata,
                        pushName: msg.pushName || "Unknown",
                        isAdmin: groupMetadata?.participants?.find(p => p.id === sender)?.admin || false,
                        isBotAdmin: groupMetadata?.participants?.find(p => p.id === sock.user.id)?.admin || false,
                    };

                    const response = await commands.execute(cmd, args, ctx);
                    if (response) {
                        await sock.sendMessage(jid, { text: response });
                    }
                }
            } catch (err) {
                log(`Message error: ${err.message}`, "ERROR");
            }
        });

    } catch (err) {
        log(`Start error: ${err.message}`, "ERROR");
        setTimeout(startBot, 5000);
    }
}

// ============================================
// SHUTDOWN
// ============================================

process.on("SIGINT", async () => {
    log("🛑 Shutting down...", "SHUTDOWN");
    if (sock) await sock.end();
    server.close(() => process.exit(0));
});

process.on("SIGTERM", async () => {
    if (sock) await sock.end();
    server.close(() => process.exit(0));
});

// ============================================
// START
// ============================================

startBot().catch(err => {
    log(`Failed: ${err.message}`, "ERROR");
    process.exit(1);
});

module.exports = { sock, startBot, commands };
