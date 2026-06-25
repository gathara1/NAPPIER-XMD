/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    NAPPIER XMD - WHATSAPP BOT                           ║
 * ║                   Version: 1.0.0 | Status: Active                       ║
 * ║                      Author: nappier                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 * 
 * Main entry point for Nappier XMD WhatsApp Bot
 * Powered by Baileys Library
 */

require("events").EventEmitter.defaultMaxListeners = 960;

// ═══════════════════════════════════════════════════════════════════════════
// CORE DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════════════

const {
    default: makeWASocket,
    useMultiFileAuthState,
    MessageType,
    Presence,
    ChatModification,
    proto,
    WAMessageStubType,
} = require("@whiskeysockets/baileys");

const express = require("express");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const qrcode = require("qrcode-terminal");
const { Console } = require("console");

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const config = require("./config");

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL VARIABLES
// ═══════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 5000;
const app = express();
let sock;
let qrCodeData = null;

const SESSION_DIR = path.join(__dirname, "session");
const LOGS_DIR = path.join(__dirname, "logs");
const MEDIA_DIR = path.join(__dirname, "media");

// Create directories if they don't exist
fs.ensureDirSync(SESSION_DIR);
fs.ensureDirSync(LOGS_DIR);
fs.ensureDirSync(MEDIA_DIR);

// ═══════════════════════════════════════════════════════════════════════════
// LOGGER SETUP
// ═══════════════════════════════════════════════════════════════════════════

const logger = new Console({
    stdout: fs.createWriteStream(path.join(LOGS_DIR, "bot.log"), { flags: "a" }),
    stderr: fs.createWriteStream(path.join(LOGS_DIR, "error.log"), { flags: "a" }),
});

const log = (msg, type = "INFO") => {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] [${type}] ${msg}`;
    console.log(logMsg);
    logger.log(logMsg);
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPRESS SERVER SETUP
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.json());
app.use(express.static("public"));

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "alive",
        uptime: process.uptime(),
        bot_name: config.BOT_NAME,
        timestamp: new Date().toISOString(),
    });
});

// QR Code endpoint
app.get("/qr", (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData, status: "pending" });
    } else {
        res.json({ status: "connected", message: "Bot is connected" });
    }
});

// Status endpoint
app.get("/status", (req, res) => {
    const status = sock ? "connected" : "disconnected";
    res.json({
        status: status,
        bot_name: config.BOT_NAME,
        version: config.VERSION,
        mode: config.MODE,
    });
});

// Main page
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Nappier XMD Bot</title>
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
                .container { background: white; padding: 20px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
                h1 { color: #075e54; }
                p { color: #555; }
                .status { padding: 10px; background: #e8f5e9; border-radius: 5px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 Nappier XMD Bot</h1>
                <p><strong>Version:</strong> ${config.VERSION}</p>
                <p><strong>Bot Name:</strong> ${config.BOT_NAME}</p>
                <p><strong>Mode:</strong> ${config.MODE}</p>
                <div class="status" id="status">Loading...</div>
                <p id="qr-section"></p>
            </div>
            <script>
                fetch('/status')
                    .then(r => r.json())
                    .then(data => {
                        document.getElementById('status').innerHTML = 
                            '<strong>Status:</strong> ' + data.status.toUpperCase();
                    });
                
                fetch('/qr')
                    .then(r => r.json())
                    .then(data => {
                        if (data.qr) {
                            document.getElementById('qr-section').innerHTML = 
                                '<p>📱 Scan QR code in your terminal</p>';
                        }
                    });
            </script>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    log(`✅ Server running on http://localhost:${PORT}`, "SERVER");
});

// ════════════════════════════════════════════��══════════════════════════════
// MEMORY & HEALTH MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Garbage collection
setInterval(() => {
    const used = process.memoryUsage();
    if (used.heapUsed > 400 * 1024 * 1024) {
        if (global.gc) global.gc();
        log("Garbage collection triggered", "MEMORY");
    }
}, 60000);

// Health check ping
setInterval(async () => {
    try {
        const http = require("http");
        http.get(`http://localhost:${PORT}/health`, () => {});
    } catch (e) {}
}, 240000);

// ═══════════════════════════════════════════════════════════════════════════
// NAPPIER BOT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

async function startNappierBot() {
    try {
        log("🔄 Initializing Nappier XMD Bot...", "BOT");

        // Load authentication state
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

        // Create socket connection
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
        });

        // ═══════════════════════════════════════════════════════════════════
        // EVENT HANDLERS
        // ═══════════════════════════════════════════════════════════════════

        // Connection Update
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCodeData = qr;
                log("📱 QR Code generated - Scan with WhatsApp", "QR");
                qrcode.generate(qr, { small: true });
            }

            if (connection === "connecting") {
                log("⏳ Connecting to WhatsApp...", "CONNECTION");
            } else if (connection === "open") {
                qrCodeData = null;
                log("✅ Connected to WhatsApp!", "CONNECTION");
                log(`💜 Bot Name: ${config.BOT_NAME}`, "BOT");
                log(`📌 Mode: ${config.MODE}`, "BOT");
                log(`⚙️  Prefix: ${config.PREFIX}`, "BOT");
            } else if (connection === "close") {
                const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                if (reason === DisconnectReason.loggedOut) {
                    log("❌ Device logged out. Please scan QR again.", "ERROR");
                    process.exit();
                } else if (reason === DisconnectReason.connectionClosed) {
                    log("⚠️  Connection closed. Reconnecting...", "WARNING");
                    startNappierBot();
                } else if (reason === DisconnectReason.connectionLost) {
                    log("⚠️  Connection lost. Reconnecting...", "WARNING");
                    startNappierBot();
                } else if (reason === DisconnectReason.connectionReplaced) {
                    log("⚠️  Connection replaced. Reconnecting...", "WARNING");
                    startNappierBot();
                } else if (reason === DisconnectReason.restartRequired) {
                    log("🔄 Restart required. Restarting...", "INFO");
                    startNappierBot();
                }
            }
        });

        // Credentials Update
        sock.ev.on("creds.update", saveCreds);

        // ═══════════════════════════════════════════════════════════════════
        // MESSAGE HANDLER
        // ═══════════════════════════════════════════════════════════════════

        sock.ev.on("messages.upsert", async (m) => {
            try {
                const message = m.messages[0];

                if (!message.message) return;

                // Get sender info
                const sender = message.key.remoteJid;
                const isGroup = sender?.endsWith("@g.us");
                const isBot = message.key.fromMe;

                // Extract text
                let text = "";
                if (message.message.conversation) {
                    text = message.message.conversation;
                } else if (message.message.extendedTextMessage) {
                    text = message.message.extendedTextMessage.text;
                }

                // Log message
                log(`📨 ${isGroup ? "[GROUP] " : "[DM] "}${message.pushName}: ${text}`, "MESSAGE");

                // Check if it's a command
                if (text.startsWith(config.PREFIX)) {
                    const command = text.slice(1).split(" ")[0].toLowerCase();
                    const args = text.slice(1).split(" ").slice(1);

                    log(`🔧 Command: ${command} | Args: ${args.join(" ")}`, "COMMAND");

                    // Handle commands
                    switch (command) {
                        case "ping":
                            await sock.sendMessage(sender, {
                                text: "🏓 Pong! Bot is alive.",
                            });
                            break;

                        case "alive":
                            await sock.sendMessage(sender, {
                                text: `✅ *${config.BOT_NAME}* is alive!\n\nUptime: ${process.uptime().toFixed(0)}s`,
                            });
                            break;

                        case "help":
                            await sock.sendMessage(sender, {
                                text: `📋 *${config.BOT_NAME} Help*\n\n${config.PREFIX}ping - Check if bot is alive\n${config.PREFIX}alive - Bot status\n${config.PREFIX}help - Show this message`,
                            });
                            break;

                        default:
                            await sock.sendMessage(sender, {
                                text: `❓ Command *${command}* not found.\nType *${config.PREFIX}help* for available commands.`,
                            });
                    }
                }

                // Auto-read messages
                if (config.AUTO_READ_MESSAGES === "all") {
                    await sock.readMessages([message.key]);
                }

                // Auto-react
                if (config.AUTO_REACT === "all") {
                    const emojis = ["😂", "😍", "🔥", "✨", "👍", "💯"];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    await sock.sendMessage(sender, {
                        react: { text: randomEmoji, key: message.key },
                    });
                }
            } catch (err) {
                log(`Error in message handler: ${err.message}`, "ERROR");
            }
        });

        // ═══════════════════════════════════════════════════════════════════
        // OTHER EVENTS
        // ═══════════════════════════════════════════════════════════════════

        // Group metadata update
        sock.ev.on("groups.update", (groupUpdates) => {
            groupUpdates.forEach((group) => {
                log(`👥 Group updated: ${group.id}`, "GROUP");
            });
        });

        // Chat update
        sock.ev.on("chats.update", (chats) => {
            log(`💬 ${chats.length} chat(s) updated`, "CHAT");
        });

        // Presence update
        sock.ev.on("presence.update", (presenceUpdates) => {
            presenceUpdates.forEach((presence) => {
                log(`👤 Presence: ${presence.id} - ${presence.lastSeen ? "online" : "offline"}`, "PRESENCE");
            });
        });

    } catch (error) {
        log(`Fatal error: ${error.message}`, "ERROR");
        setTimeout(() => startNappierBot(), 5000);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════

process.on("SIGINT", async () => {
    log("🛑 Shutting down bot...", "SHUTDOWN");
    if (sock) {
        await sock.end();
    }
    process.exit(0);
});

process.on("SIGTERM", async () => {
    log("🛑 Shutting down bot...", "SHUTDOWN");
    if (sock) {
        await sock.end();
    }
    process.exit(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// START BOT
// ═══════════════════════════════════════════════════════════════════════════

log(`🚀 Starting Nappier XMD v${config.VERSION}`, "STARTUP");
log(`📱 Bot: ${config.BOT_NAME}`, "STARTUP");
log(`👤 Owner: ${config.OWNER_NUMBER}`, "STARTUP");
startNappierBot().catch((err) => {
    log(`Failed to start bot: ${err.message}`, "ERROR");
    process.exit(1);
});

module.exports = { sock, startNappierBot };
