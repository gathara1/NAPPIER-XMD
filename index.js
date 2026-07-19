import dotenv from "dotenv";
dotenv.config();

import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  useMultiFileAuthState,
} from "baileys-pro";
import { Handler, Callupdate, GroupUpdate } from "./data/index.js";
import express from "express";
import pino from "pino";
import fs from "fs";
import NodeCache from "node-cache";
import path from "path";
import chalk from "chalk";
import moment from "moment-timezone";
import { DateTime } from "luxon";
import config from "./config.cjs";
import pkg from "./lib/autoreact.cjs";

const { emojis, doReact } = pkg;
const prefix = process.env.PREFIX || config.PREFIX;
const app = express();
const PORT = process.env.PORT || 3000;

const MAIN_LOGGER = pino({
  timestamp: () => `,"time":"${new Date().toJSON()}"`,
});
const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const msgRetryCounterCache = new NodeCache();

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const sessionDir = path.join(__dirname, "session");
const credsPath = path.join(sessionDir, "creds.json");

// Create session directory if it doesn't exist
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
  console.log(chalk.yellow(`📁 Created session directory: ${sessionDir}`));
}

// ═════════════════════════════════════════════════════════════════════════
// ✅ IMPROVED: Session Loading with Better Error Handling
// ═════════════════════════════════════════════════════════════════════════
async function loadBase64Session() {
  const base64Creds = process.env.SESSION_ID;

  // Check if SESSION_ID exists
  if (!base64Creds || base64Creds.trim() === "") {
    console.error(chalk.red("❌ ERROR: SESSION_ID not found in .env file!"));
    console.log(chalk.yellow("\n📌 How to get SESSION_ID:"));
    console.log(chalk.cyan("   1. Visit: https://nappiero-fbf4880816e4.herokuapp.com/"));
    console.log(chalk.cyan("   2. Scan QR code with WhatsApp"));
    console.log(chalk.cyan("   3. Copy the Base64 session code"));
    console.log(chalk.cyan("   4. Add it to .env as: SESSION_ID=your_base64_code\n"));
    process.exit(1);
  }

  try {
    console.log(chalk.blue("🔐 Loading Session Credentials..."));

    // Validate Base64 format
    if (!isValidBase64(base64Creds)) {
      console.error(chalk.red("❌ Invalid Base64 format in SESSION_ID!"));
      console.log(chalk.yellow("   Please ensure your SESSION_ID is valid Base64 encoded."));
      process.exit(1);
    }

    // Decode and write to file
    const credsBuffer = Buffer.from(base64Creds, "base64");
    await fs.promises.writeFile(credsPath, credsBuffer);
    console.log(chalk.green("✅ Base64 session credentials loaded successfully!"));
    console.log(chalk.gray(`   Location: ${credsPath}\n`));
    return true;

  } catch (error) {
    console.error(chalk.red("❌ Failed to load Base64 session:"), error.message);
    console.log(chalk.yellow("\n💡 Troubleshooting:"));
    console.log(chalk.cyan("   • Check if SESSION_ID is complete and not truncated"));
    console.log(chalk.cyan("   • Verify Base64 encoding is correct"));
    console.log(chalk.cyan("   • Generate a new SESSION_ID from the pairing website\n"));
    process.exit(1);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// ✅ UTILITY: Base64 Validation
// ═════════════════════════════════════════════════════════════════════════
function isValidBase64(str) {
  if (!str || typeof str !== "string") return false;
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(str)) return false;
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// ✅ Greeting Messages
// ═════════════════════════════════════════════════════════════════════════
function getGreeting() {
  const hour = DateTime.now().setZone("Africa/Nairobi").hour;
  if (hour >= 5 && hour < 12) return "Hey there! Ready to kick off the day? 🚀";
  if (hour >= 12 && hour < 18) return "What's up? Time to make things happen! ⚡";
  if (hour >= 18 && hour < 22) return "Evening vibes! Let's get to it! 🌟";
  return "Late night? Let's see what's cooking! 🌙";
}

function getCurrentTime() {
  return DateTime.now().setZone("Africa/Nairobi").toLocaleString(DateTime.TIME_SIMPLE);
}

function toFancyFont(text, isUpperCase = false) {
  const fonts = {
    A: "𝘼", B: "𝘽", C: "𝘾", D: "𝘿", E: "𝙀", F: "𝙁", G: "𝙂", H: "𝙃",
    I: "𝙄", J: "𝙅", K: "𝙆", L: "𝙇", M: "𝙈", N: "𝙉", O: "𝙊", P: "𝙋",
    Q: "𝙌", R: "𝙍", S: "𝙎", T: "𝙏", U: "𝙐", V: "𝙑", W: "𝙒", X: "𝙓",
    Y: "𝙔", Z: "𝙕",
    a: "𝙖", b: "𝙗", c: "𝙘", d: "𝙙", e: "𝙚", f: "𝙛", g: "𝙜", h: "𝙝",
    i: "𝙞", j: "𝙟", k: "𝙠", l: "𝙡", m: "𝙢", n: "𝙣", o: "𝙤", p: "𝙥",
    q: "𝙦", r: "𝙧", s: "𝙨", t: "𝙩", u: "𝙪", v: "𝙫", w: "𝙬", x: "𝙭",
    y: "𝙮", z: "𝙯",
  };
  const formattedText = isUpperCase ? text.toUpperCase() : text.toLowerCase();
  return formattedText.split("").map((char) => fonts[char] || char).join("");
}

// Status replies
const statusReplies = [
  "Yo, caught your status! 😈",
  "Damn, that status tho! 🔥",
  "Saw your status! 💀",
  "What's good? Your status is pure chaos! 😎",
  "Status checked! 💣",
  "Aight, peeped your status! 😏",
  "Your status? Absolute fire! 🚨",
  "Just saw your status! 🖤",
];

// ═════════════════════════════════════════════════════════════════════════
// ✅ CONNECTION RETRY LOGIC
// ═════════════════════════════════════════════════════════════════════════
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds

function resetReconnectAttempts() {
  reconnectAttempts = 0;
}

async function delayReconnect(ms = RECONNECT_DELAY) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═════════════════════════════════════════════════════════════════════════
// ✅ MAIN CONNECTION FUNCTION (Improved)
// ═════════════════════════════════════════════════════════════════════════
async function start() {
  try {
    console.log(chalk.blue.bold("\n╔════════════════════════════════════════════╗"));
    console.log(chalk.blue.bold("║     🤖 NAPPIER-XMD Bot Initializing...    ║"));
    console.log(chalk.blue.bold("╚════════════════════════════════════════════╝\n"));

    // Load session
    await loadBase64Session();

    console.log(chalk.blue("🔄 Loading authentication state..."));
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    console.log(chalk.blue("📡 Fetching latest WhatsApp version..."));
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(chalk.green(`✅ WhatsApp v${version.join(".")} (Latest: ${isLatest})\n`));

    // ═════════════════════════════════════════════════════════════════════
    // Create Socket Connection
    // ═════════════════════════════════════════════════════════════════════
    const Matrix = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      browser: ["NAPPIER-XMD", "Chrome", "1.0.0"],
      auth: state,
      getMessage: async (key) => {
        if (store) {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg.message || undefined;
        }
        return { conversation: "NAPPIER-XMD whatsapp user bot" };
      },
      shouldIgnoreJid: (jid) => /:(status|call)@/.test(jid),
      shouldSyncHistoryMessage: () => false,
      printQRInTerminal: false,
      syncFullHistory: false,
      maxMsgsInMemory: 100,
      fireInitQueries: true,
      retryRequestDelayMs: 10000,
    });

    let hasSentStartMessage = false;

    // ═════════════════════════════════════════════════════════════════════
    // ✅ CONNECTION UPDATE HANDLER (Improved)
    // ═════════════════════════════════════════════════════════════════════
    Matrix.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Show QR Code if needed
      if (qr) {
        console.log(chalk.yellow("\n📲 QR Code received! Scan with WhatsApp."));
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || "Unknown error";

        console.log(chalk.red(`\n❌ Connection closed (Code: ${statusCode})`));
        console.log(chalk.yellow(`   Error: ${errorMessage}`));

        // Handle different disconnect reasons
        switch (statusCode) {
          case DisconnectReason.badSession:
            console.log(chalk.red("\n⚠️  BAD SESSION DETECTED"));
            console.log(chalk.yellow("   Solution:"));
            console.log(chalk.cyan("   1. Delete session folder: rm -rf session/creds.json"));
            console.log(chalk.cyan("   2. Generate new SESSION_ID from pairing website"));
            console.log(chalk.cyan("   3. Update .env file with new SESSION_ID"));
            console.log(chalk.cyan("   4. Restart the bot\n"));
            process.exit(1);
            break;

          case DisconnectReason.connectionClosed:
            console.log(chalk.yellow("🔌 Connection closed by server"));
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              console.log(chalk.blue(`   Reconnecting... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`));
              await delayReconnect();
              start();
            } else {
              console.log(chalk.red("   Max reconnection attempts reached!"));
              process.exit(1);
            }
            break;

          case DisconnectReason.connectionLost:
            console.log(chalk.yellow("📡 Connection lost"));
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              console.log(chalk.blue(`   Reconnecting... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`));
              await delayReconnect();
              start();
            } else {
              console.log(chalk.red("   Max reconnection attempts reached!"));
              process.exit(1);
            }
            break;

          case DisconnectReason.connectionReplaced:
            console.log(chalk.red("\n⚠️  CONNECTION REPLACED"));
            console.log(chalk.yellow("   Another device connected with same account."));
            console.log(chalk.cyan("   Please disconnect other device and try again.\n"));
            process.exit(1);
            break;

          case DisconnectReason.loggedOut:
            console.log(chalk.red("\n⚠️  LOGGED OUT DETECTED"));
            console.log(chalk.yellow("   Solution:"));
            console.log(chalk.cyan("   1. Generate new SESSION_ID"));
            console.log(chalk.cyan("   2. Delete session folder: rm -rf session/"));
            console.log(chalk.cyan("   3. Update .env with new SESSION_ID\n"));
            hasSentStartMessage = false;
            process.exit(1);
            break;

          case DisconnectReason.restartRequired:
            console.log(chalk.yellow("🔄 Restart required"));
            console.log(chalk.blue("   Restarting in 5 seconds..."));
            await delayReconnect();
            start();
            break;

          case DisconnectReason.timedOut:
            console.log(chalk.yellow("⏳ Connection timed out"));
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              console.log(chalk.blue(`   Reconnecting... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`));
              await delayReconnect();
              start();
            } else {
              console.log(chalk.red("   Max reconnection attempts reached!"));
              process.exit(1);
            }
            break;

          default:
            console.log(chalk.yellow(`❓ Unknown disconnect (${statusCode})`));
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              console.log(chalk.blue(`   Reconnecting... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`));
              await delayReconnect();
              start();
            } else {
              console.log(chalk.red("   Max reconnection attempts reached!"));
              process.exit(1);
            }
        }
        return;
      }

      if (connection === "connecting") {
        console.log(chalk.blue("🔗 Connecting to WhatsApp..."));
      }

      if (connection === "open") {
        resetReconnectAttempts();
        console.log(chalk.green("\n✅ CONNECTION ESTABLISHED!\n"));

        // Attempt to join support group (silent fail)
        try {
          await Matrix.groupAcceptInvite("GoXKLVJgTAAC3556FXkfFI");
        } catch (error) {
          // Silent fail
        }

        // Send startup messages
        if (!hasSentStartMessage) {
          try {
            console.log(chalk.blue("📨 Sending startup messages..."));

            const firstMessage = [
              `◈━━━━━━━━━━━━━━━━◈`,
              `│❒ *${getGreeting()}*`,
              `│❒ Welcome to *NAPPIER-XMD*! You're now connected.`,
              ``,
              `✨ *Bot Name*: NAPPIER-XMD`,
              `🔧 *Mode*: ${config.MODE || "public"}`,
              `➡️ *Prefix*: ${prefix}`,
              `📋 *Commands*: Ready`,
              `🕒 *Time*: ${getCurrentTime()}`,
              `💾 *Database*: Initialized`,
              `📚 *Library*: Baileys`,
              ``,
              `│❒ *Credits*: Gathara`,
              `◈━━━━━━━━━━━━━━━━◈`,
            ].join("\n");

            const secondMessage = [
              `◈━━━━━━━━━━━━━━━━◈`,
              `│❒ Tap button to view commands:`,
              `◈━━━━━━━━━━━━━━━━◈`,
            ].join("\n");

            // Send first message
            await Matrix.sendMessage(Matrix.user.id, {
              text: firstMessage,
              footer: `Powered by NAPPIER-XMD`,
              viewOnce: true,
              contextInfo: {
                externalAdReply: {
                  showAdAttribution: false,
                  title: "NAPPIER-XMD",
                  body: `Bot initialized successfully.`,
                  sourceUrl: `https://github.com/gathara1/NAPPIER-XMD`,
                  mediaType: 1,
                  renderLargerThumbnail: true,
                },
              },
            });

            // Send menu button
            await Matrix.sendMessage(Matrix.user.id, {
              text: secondMessage,
              footer: `Powered by NAPPIER-XMD`,
              buttons: [
                {
                  buttonId: `${prefix}menu`,
                  buttonText: { displayText: `📖 ${toFancyFont("MENU")}` },
                  type: 1,
                },
              ],
              headerType: 1,
              viewOnce: true,
              contextInfo: {
                externalAdReply: {
                  showAdAttribution: false,
                  title: "NAPPIER-XMD",
                  body: `Select to proceed.`,
                  sourceUrl: `https://github.com/gathara1/NAPPIER-XMD`,
                  mediaType: 1,
                  renderLargerThumbnail: true,
                },
              },
            });

            hasSentStartMessage = true;
            console.log(chalk.green("✅ Startup messages sent!\n"));

          } catch (error) {
            console.error(chalk.yellow(`⚠️  Failed to send startup messages: ${error.message}`));
          }
        }

        console.log(chalk.green.bold("🚀 NAPPIER-XMD is now operational and ready!\n"));
      }
    });

    // ═════════════════════════════════════════════════════════════════════
    // ✅ CREDENTIALS UPDATE
    // ═════════════════════════════════════════════════════════════════════
    Matrix.ev.on("creds.update", saveCreds);

    // ═════════════════════════════════════════════════════════════════════
    // ✅ MESSAGE HANDLER
    // ═════════════════════════════════════════════════════════════════════
    Matrix.ev.on("messages.upsert", async (chatUpdate) => {
      try {
        const mek = chatUpdate.messages[0];
        if (!mek || !mek.message) return;

        // Skip protocol and system messages
        if (
          mek.message?.protocolMessage ||
          mek.message?.ephemeralMessage ||
          mek.message?.reactionMessage
        )
          return;

        const fromJid = mek.key.participant || mek.key.remoteJid;

        // Status handling
        if (mek.key.remoteJid === "status@broadcast" && config.AUTO_STATUS_SEEN) {
          await Matrix.readMessages([mek.key]);
          if (config.AUTO_STATUS_REPLY) {
            const randomReply = statusReplies[Math.floor(Math.random() * statusReplies.length)];
            await Matrix.sendMessage(fromJid, { text: randomReply }, { quoted: mek });
          }
          return;
        }

        // Auto-react
        if (!mek.key.fromMe && config.AUTO_REACT && mek.message) {
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
          await doReact(randomEmoji, mek, Matrix);
        }

        // Main command handler
        await Handler(chatUpdate, Matrix, logger);

      } catch (err) {
        console.error(chalk.red("Error in messages.upsert:"), err);
      }
    });

    // ═════════════════════════════════════════════════════════════════════
    // ✅ CALL & GROUP HANDLERS
    // ═════════════════════════════════════════════════════════════════════
    Matrix.ev.on("call", async (json) => await Callupdate(json, Matrix));
    Matrix.ev.on("group-participants.update", async (messag) => await GroupUpdate(Matrix, messag));

    // ═════════════════════════════════════════════════════════════════════
    // ✅ MODE CONFIGURATION
    // ═════════════════════════════════════════════════════════════════════
    if (config.MODE === "public") {
      Matrix.public = true;
      console.log(chalk.cyan("📢 Mode: PUBLIC\n"));
    } else if (config.MODE === "private") {
      Matrix.public = false;
      console.log(chalk.cyan("🔐 Mode: PRIVATE\n"));
    }

  } catch (error) {
    console.error(chalk.red.bold("\n❌ CRITICAL ERROR:"), error.message);
    console.log(chalk.yellow("\nStackTrace:"), error.stack);
    console.log(chalk.red("\nThe bot will exit. Please fix the error and restart."));
    process.exit(1);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// ✅ STARTUP
// ═════════════════════════════════════════════════════════════════════════
start();

// ═════════════════════════════════════════════════════════════════════════
// ✅ EXPRESS SERVER
// ═════════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.send(chalk.green("✅ NAPPIER-XMD is running!"));
});

app.get("/status", (req, res) => {
  res.json({
    status: "online",
    bot: "NAPPIER-XMD",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(chalk.green(`\n🌐 Server running on port ${PORT}`));
  console.log(chalk.cyan(`   URL: http://localhost:${PORT}\n`));
});

// ═════════════════════════════════════════════════════════════════════════
// ✅ GRACEFUL SHUTDOWN
// ═════════════════════════════════════════════════════════════════════════
process.on("SIGINT", () => {
  console.log(chalk.yellow("\n\n👋 Shutting down gracefully..."));
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(chalk.yellow("\n\n👋 Shutting down gracefully..."));
  process.exit(0);
});
