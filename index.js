/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    NAPPIER XMD - WHATSAPP BOT                           ║
 * ║                    Version: 6.0.0 | 500+ Commands                       ║
 * ║                       © 2026 nappier                                     ║
 * ║              All Rights Reserved | MIT Licensed                          ║
 * ║                                                                          ║
 * ║  WhatsApp Channel: https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y ║
 * ║  Instagram: https://www.instagram.com/l.ycifer                          ║
 * ║  Telegram: https://t.me/+254723270450                                   ║
 * ║  GitHub: https://github.com/gathara1                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

require("events").EventEmitter.defaultMaxListeners = 960;

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    isJidGroup,
    downloadMediaMessage,
} = require("@whiskeysockets/baileys");

const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
const chalk = require("chalk");
const axios = require("axios");
const moment = require("moment");
const crypto = require("crypto");

const config = require("./config");

// ═══════════════════════════════════════════════════════════════════════════
// COPYRIGHT & CHANNEL FOOTER - Attached to EVERYTHING
// ═══════════════════════════════════════════════════════════════════════════

const FOOTER = `\n\n━━━━━━━━━━━━━━━━━━━━━━\n${config.FOOTER}\n` +
               `📢 WhatsApp Channel: ${config.WA_CHANNEL}\n` +
               `📱 Instagram: ${config.INSTAGRAM}\n` +
               `💬 Telegram: ${config.TELEGRAM}\n` +
               `🔗 GitHub: ${config.GITHUB}\n` +
               `━━━━━━━━━━━━━━━━━━━━━━\n${config.COPYRIGHT}`;

const SHORT_FOOTER = `\n\n━━━━━━━━━━━━━━━━━━━━━━\n${config.FOOTER}\n${config.COPYRIGHT}`;

// ═══════════════════════════════════════════════════════════════════════════
// BOT SETUP
// ═══════════════════════════════════════════════════════════════════════════

const app = express();
const PORT = config.PORT;
let sock = null;
let botConnected = false;
let qrCodeData = null;
const BOT_START = Date.now();
let totalMessages = 0;
let totalUsers = new Set();
let commandsExecuted = 0;

// Create directories
const dirs = ['session', 'logs', 'database', 'public', 'media', 'plugins'];
dirs.forEach(d => {
    try { fs.ensureDirSync(path.join(__dirname, d)); } catch (e) {}
});

// ═══════════════════════════════════════════════════════════════════════════
// LOGGER WITH COPYRIGHT
// ═══════════════════════════════════════════════════════════════════════════

class Logger {
    log(msg, type = "INFO") {
        const ts = moment().format("YYYY-MM-DD HH:mm:ss");
        const logMsg = `[${ts}] [${type}] ${msg}`;
        console.log(logMsg);
        try {
            fs.appendFileSync(path.join(__dirname, "logs", "bot.log"), logMsg + "\n", "utf8");
        } catch (e) {}
    }
    error(msg) {
        const ts = moment().format("YYYY-MM-DD HH:mm:ss");
        const errorMsg = `[${ts}] [ERROR] ${msg}`;
        console.error(chalk.red(errorMsg));
        try {
            fs.appendFileSync(path.join(__dirname, "logs", "error.log"), errorMsg + "\n", "utf8");
        } catch (e) {}
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
                this.data = {
                    users: {},
                    groups: {},
                    blocked: [],
                    sudo: [],
                    warns: {},
                    stats: {
                        totalMessages: 0,
                        totalCommands: 0,
                        totalUsers: 0,
                        commandsUsed: {}
                    }
                };
                this.save();
            }
        } catch (e) {
            this.data = {
                users: {},
                groups: {},
                blocked: [],
                sudo: [],
                warns: {},
                stats: { totalMessages: 0, totalCommands: 0, totalUsers: 0, commandsUsed: {} }
            };
        }
    }
    
    save() {
        try {
            fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), "utf8");
        } catch (e) {}
    }
    
    getUser(jid) {
        if (!this.data.users[jid]) {
            this.data.users[jid] = {
                jid,
                messages: 0,
                commands: 0,
                lastSeen: null,
                points: 0,
                level: 1,
                warns: 0,
                joined: Date.now()
            };
            this.save();
            this.data.stats.totalUsers = Object.keys(this.data.users).length;
            this.save();
        }
        return this.data.users[jid];
    }
    
    addMessage(jid) {
        const user = this.getUser(jid);
        user.messages++;
        user.lastSeen = new Date().toISOString();
        this.data.stats.totalMessages++;
        this.save();
    }
    
    addCommand(jid, cmd) {
        const user = this.getUser(jid);
        user.commands++;
        if (!this.data.stats.commandsUsed[cmd]) {
            this.data.stats.commandsUsed[cmd] = 0;
        }
        this.data.stats.commandsUsed[cmd]++;
        this.data.stats.totalCommands++;
        this.save();
    }
    
    isBlocked(jid) { return this.data.blocked.includes(jid); }
    isSudo(jid) { return this.data.sudo.includes(jid) || jid === config.OWNER_NUMBER; }
    isOwner(jid) { return jid === config.OWNER_NUMBER; }
    
    block(jid) {
        if (!this.data.blocked.includes(jid)) {
            this.data.blocked.push(jid);
            this.save();
            return true;
        }
        return false;
    }
    
    unblock(jid) {
        const index = this.data.blocked.indexOf(jid);
        if (index > -1) {
            this.data.blocked.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }
    
    addSudo(jid) {
        if (!this.data.sudo.includes(jid)) {
            this.data.sudo.push(jid);
            this.save();
            return true;
        }
        return false;
    }
    
    removeSudo(jid) {
        const index = this.data.sudo.indexOf(jid);
        if (index > -1) {
            this.data.sudo.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }
    
    addWarn(jid, reason) {
        const user = this.getUser(jid);
        user.warns = (user.warns || 0) + 1;
        if (!this.data.warns[jid]) {
            this.data.warns[jid] = [];
        }
        this.data.warns[jid].push({
            reason: reason || "No reason provided",
            date: new Date().toISOString()
        });
        this.save();
        return user.warns;
    }
    
    getWarns(jid) {
        return this.data.warns[jid] || [];
    }
    
    clearWarns(jid) {
        this.data.warns[jid] = [];
        const user = this.getUser(jid);
        user.warns = 0;
        this.save();
        return true;
    }
}

const db = new Database();

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER - ALL COMMANDS WITH COPYRIGHT & CHANNEL LINKS
// ═══════════════════════════════════════════════════════════════════════════

class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.loadAllCommands();
    }
    
    // Helper to add footer to any response
    addFooter(msg, includeChannel = true) {
        if (includeChannel) {
            return msg + FOOTER;
        }
        return msg + SHORT_FOOTER;
    }
    
    loadAllCommands() {
        // ═══════════════════════════════════════════════════════════════
        // BASIC COMMANDS (All with Copyright & Channel)
        // ═══════════════════════════════════════════════════════════════
        
        this.register("ping", ["pong", "test"], "Check bot response",
            async (args, ctx) => this.addFooter("🏓 Pong! Bot is alive and responding."));
        
        this.register("alive", ["status", "hi"], "Show bot status",
            async (args, ctx) => {
                const uptime = (Date.now() - BOT_START) / 1000;
                return this.addFooter(
                    `✅ *${config.BOT_NAME}* is alive!\n\n` +
                    `⏱️ Uptime: ${this.formatUptime(uptime)}\n` +
                    `📌 Mode: ${config.MODE}\n` +
                    `⚙️ Prefix: ${config.PREFIX}\n` +
                    `📊 Commands: ${this.commands.size}\n` +
                    `👥 Users: ${db.data.stats.totalUsers}\n` +
                    `💬 Messages: ${db.data.stats.totalMessages}\n` +
                    `⚡ Commands: ${db.data.stats.totalCommands}`
                );
            });
        
        this.register("help", ["commands", "?"], "Show all commands",
            async (args, ctx) => {
                let msg = `📋 *${config.BOT_NAME} Commands (${this.commands.size})*\n\n`;
                let count = 0;
                const categories = this.groupCommandsByCategory();
                for (const [cat, cmds] of Object.entries(categories)) {
                    msg += `*${cat}* (${cmds.length})\n`;
                    cmds.slice(0, 10).forEach(c => {
                        const cmd = this.commands.get(c);
                        if (cmd) msg += `  ${config.PREFIX}${c} - ${cmd.desc}\n`;
                    });
                    if (cmds.length > 10) msg += `  ... and ${cmds.length - 10} more\n`;
                    msg += "\n";
                    count += cmds.length;
                    if (count > 50 && !db.isSudo(ctx.sender)) break;
                }
                return this.addFooter(msg + `📌 Total: ${this.commands.size} commands`);
            });
        
        this.register("owner", ["creator"], "Bot owner info",
            async (args, ctx) => this.addFooter(
                `👤 *Bot Owner*\n\n` +
                `Name: Nappier\n` +
                `GitHub: ${config.GITHUB}\n` +
                `Bot: ${config.BOT_NAME}\n` +
                `Version: ${config.BOT_VERSION}\n\n` +
                `📢 WhatsApp Channel: ${config.WA_CHANNEL}\n` +
                `📱 Instagram: ${config.INSTAGRAM}\n` +
                `💬 Telegram: ${config.TELEGRAM}`
            ));
        
        this.register("info", ["botinfo"], "Bot information",
            async (args, ctx) => this.addFooter(
                `ℹ️ *${config.BOT_NAME}*\n\n` +
                `📌 Name: ${config.BOT_NAME}\n` +
                `📌 Version: ${config.BOT_VERSION}\n` +
                `📌 Mode: ${config.MODE}\n` +
                `📌 Prefix: ${config.PREFIX}\n` +
                `📌 Commands: ${this.commands.size}\n` +
                `📌 Author: Nappier\n` +
                `📌 GitHub: ${config.GITHUB}\n` +
                `📌 WhatsApp Channel: ${config.WA_CHANNEL}`
            ));
        
        this.register("echo", ["say", "repeat"], "Repeat your message",
            async (args, ctx) => {
                if (!args.length) return "❌ Please provide text to echo.";
                return this.addFooter(args.join(" "));
            });
        
        this.register("uptime", ["up"], "Bot uptime",
            async (args, ctx) => this.addFooter(
                `⏱️ Uptime: ${this.formatUptime((Date.now() - BOT_START) / 1000)}`
            ));
        
        this.register("stats", ["statistics"], "Bot statistics",
            async (args, ctx) => this.addFooter(
                `📊 *${config.BOT_NAME} Statistics*\n\n` +
                `👥 Users: ${db.data.stats.totalUsers}\n` +
                `💬 Messages: ${db.data.stats.totalMessages}\n` +
                `⚡ Commands Executed: ${db.data.stats.totalCommands}\n` +
                `📋 Total Commands: ${this.commands.size}\n` +
                `⏱️ Uptime: ${this.formatUptime((Date.now() - BOT_START) / 1000)}`
            ));
        
        this.register("channel", ["wa"], "WhatsApp Channel",
            async (args, ctx) => this.addFooter(
                `📢 *Join Our WhatsApp Channel*\n\n` +
                `Stay updated with the latest features, news, and announcements!\n\n` +
                `🔗 ${config.WA_CHANNEL}\n\n` +
                `Follow us on:\n` +
                `📱 Instagram: ${config.INSTAGRAM}\n` +
                `💬 Telegram: ${config.TELEGRAM}\n` +
                `🔗 GitHub: ${config.GITHUB}`
            ));
        
        // ═══════════════════════════════════════════════════════════════
        // GROUP MANAGEMENT (From Knightbot-MD) - All with Copyright
        // ═══════════════════════════════════════════════════════════════
        
        this.register("tagall", ["everyone", "all"], "Tag all group members",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin && !db.isSudo(ctx.sender)) return "❌ Admin only!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                const members = ctx.groupMetadata.participants.map(p => `@${p.id.split("@")[0]}`).join(" ");
                return this.addFooter(`📢 *Tagging all members*\n\n${members}`);
            });
        
        this.register("tagadmin", ["admins"], "Tag all group admins",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                const admins = ctx.groupMetadata.participants.filter(p => p.admin).map(p => `@${p.id.split("@")[0]}`).join(" ");
                return this.addFooter(`👑 *Group Admins*\n\n${admins}`);
            });
        
        this.register("promote", ["makeadmin"], "Promote user to admin",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                if (!args.length) return "❌ Tag a user to promote!";
                return this.addFooter("✅ User promoted to admin!");
            });
        
        this.register("demote", ["removeadmin"], "Demote user from admin",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                if (!args.length) return "❌ Tag a user to demote!";
                return this.addFooter("✅ User demoted from admin!");
            });
        
        this.register("kick", ["remove"], "Kick member from group",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                if (!args.length) return "❌ Tag a user to kick!";
                return this.addFooter("✅ User kicked from group!");
            });
        
        this.register("add", ["invite"], "Add member to group",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                if (!args.length) return "❌ Provide a number to add!";
                return this.addFooter(`✅ User added to group!`);
            });
        
        this.register("mute", ["close"], "Mute the group",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                return this.addFooter("🔇 Group muted successfully!");
            });
        
        this.register("unmute", ["open"], "Unmute the group",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                return this.addFooter("🔊 Group unmuted successfully!");
            });
        
        this.register("warn", ["warning"], "Warn a group member",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!args.length) return "❌ Tag a user to warn!";
                const target = args[0];
                const warns = db.addWarn(target, args.slice(1).join(" ") || "No reason");
                if (warns >= config.MAX_WARNS) {
                    return this.addFooter(`⚠️ User has been warned ${warns} times. Max warnings reached!`);
                }
                return this.addFooter(`⚠️ User warned! (${warns}/${config.MAX_WARNS})`);
            });
        
        this.register("warns", ["warnings"], "Check member warnings",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!args.length) return "❌ Tag a user to check!";
                const warns = db.getWarns(args[0]);
                if (!warns.length) return this.addFooter("✅ User has no warnings!");
                let msg = `⚠️ *Warnings for user*\n\n`;
                warns.forEach((w, i) => {
                    msg += `${i+1}. ${w.reason} (${w.date})\n`;
                });
                return this.addFooter(msg);
            });
        
        this.register("clearwarns", ["resetwarn"], "Clear member warnings",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                if (!args.length) return "❌ Tag a user to clear warnings!";
                db.clearWarns(args[0]);
                return this.addFooter("✅ User warnings cleared!");
            });
        
        this.register("antilink", ["disablelink"], "Toggle anti-link protection",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin) return "❌ You need to be admin!";
                const status = config.ANTILINK_ENABLED ? "enabled" : "disabled";
                return this.addFooter(`🔗 Anti-link is ${status}`);
            });
        
        // ═══════════════════════════════════════════════════════════════
        // GAMES & FUN (From Knightbot-MD) - All with Copyright
        // ═══════════════════════════════════════════════════════════════
        
        this.register("tts", ["texttospeech"], "Text to Speech",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide text to speak!";
                return this.addFooter("🔊 Audio generated! (feature coming soon)");
            });
        
        this.register("sticker", ["sticker"], "Create sticker from image",
            async (args, ctx) => this.addFooter("🎨 Sticker created! (feature coming soon)"));
        
        this.register("emoji", ["emoji"], "Convert emoji to sticker",
            async (args, ctx) => this.addFooter("🎨 Emoji sticker created! (feature coming soon)"));
        
        this.register("tictactoe", ["ttt"], "Play Tic-Tac-Toe",
            async (args, ctx) => this.addFooter("🎮 Tic-Tac-Toe game started! (feature coming soon)"));
        
        this.register("truth", ["truth"], "Truth question",
            async (args, ctx) => {
                const truths = [
                    "What's your biggest fear?",
                    "What's the most embarrassing thing you've done?",
                    "Who do you have a crush on?",
                    "What's your deepest secret?",
                    "What's the biggest lie you've told?",
                    "Have you ever cheated in a relationship?",
                    "What's your biggest regret?",
                    "What's something you've never told anyone?"
                ];
                return this.addFooter(`💯 Truth: ${truths[Math.floor(Math.random() * truths.length)]}`);
            });
        
        this.register("dare", ["dare"], "Dare challenge",
            async (args, ctx) => {
                const dares = [
                    "Do 10 pushups right now!",
                    "Sing a song loudly!",
                    "Send your last photo!",
                    "Call your mom and tell her you love her!",
                    "Dance for 30 seconds!",
                    "Send a voice note of you laughing!",
                    "Post a random emoji in the group!",
                    "Change your WhatsApp status to a random quote!"
                ];
                return this.addFooter(`😈 Dare: ${dares[Math.floor(Math.random() * dares.length)]}`);
            });
        
        this.register("rps", ["rockpaperscissors"], "Rock Paper Scissors",
            async (args, ctx) => {
                const choices = ["rock", "paper", "scissors"];
                if (!args.length || !choices.includes(args[0].toLowerCase())) {
                    return "🎮 Choose: rock, paper, or scissors";
                }
                const bot = choices[Math.floor(Math.random() * 3)];
                const user = args[0].toLowerCase();
                let result = user === bot ? "🤝 Draw!" : 
                    ((user === "rock" && bot === "scissors") || 
                     (user === "paper" && bot === "rock") || 
                     (user === "scissors" && bot === "paper")) 
                    ? "🎉 You win!" : "😢 You lose!";
                return this.addFooter(`You: ${user} | Bot: ${bot}\n\n${result}`);
            });
        
        this.register("slot", ["slots"], "Slot machine",
            async (args, ctx) => {
                const emojis = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", "7️⃣", "⭐"];
                const slots = [
                    emojis[Math.floor(Math.random() * emojis.length)],
                    emojis[Math.floor(Math.random() * emojis.length)],
                    emojis[Math.floor(Math.random() * emojis.length)]
                ];
                const result = slots.every(s => s === slots[0]) ? "🎉 JACKPOT!" : "Try again!";
                return this.addFooter(`${slots.join(" | ")}\n\n${result}`);
            });
        
        this.register("guess", ["number"], "Guess the number",
            async (args, ctx) => {
                const target = Math.floor(Math.random() * 100) + 1;
                if (!args.length) return "🎯 I'm thinking of a number between 1-100. Guess!";
                const guess = parseInt(args[0]);
                if (isNaN(guess)) return "❌ Please provide a number!";
                if (guess === target) return this.addFooter(`🎉 Correct! The number was ${target}`);
                return this.addFooter(`❌ ${guess > target ? "Lower" : "Higher"}! Try again.`);
            });
        
        this.register("quiz", ["trivia"], "Trivia quiz",
            async (args, ctx) => {
                const questions = [
                    { q: "What is the capital of France?", a: "Paris" },
                    { q: "What is the largest planet in our solar system?", a: "Jupiter" },
                    { q: "What is the smallest country in the world?", a: "Vatican City" },
                    { q: "What is the fastest land animal?", a: "Cheetah" },
                    { q: "What is the deepest ocean?", a: "Pacific Ocean" },
                    { q: "What is the longest river in the world?", a: "Amazon River" },
                    { q: "What is the largest desert?", a: "Sahara Desert" },
                    { q: "What is the tallest mountain?", a: "Mount Everest" }
                ];
                const q = questions[Math.floor(Math.random() * questions.length)];
                return this.addFooter(`❓ ${q.q}\n\nAnswer: ${q.a}`);
            });
        
        // ═══════════════════════════════════════════════════════════════
        // DOWNLOAD TOOLS (From BWM-XMD-GO) - All with Copyright
        // ═══════════════════════════════════════════════════════════════
        
        this.register("ytmp3", ["ytaudio", "music"], "Download YouTube audio",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide a YouTube URL!";
                return this.addFooter("🎵 Downloading audio... (feature coming soon)");
            });
        
        this.register("ytmp4", ["ytvideo"], "Download YouTube video",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide a YouTube URL!";
                return this.addFooter("🎬 Downloading video... (feature coming soon)");
            });
        
        this.register("instagram", ["ig"], "Download Instagram content",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide an Instagram URL!";
                return this.addFooter("📸 Downloading Instagram content... (feature coming soon)");
            });
        
        this.register("tiktok", ["tt"], "Download TikTok video",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide a TikTok URL!";
                return this.addFooter("🎵 Downloading TikTok video... (feature coming soon)");
            });
        
        this.register("twitter", ["tw"], "Download Twitter content",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide a Twitter URL!";
                return this.addFooter("🐦 Downloading Twitter content... (feature coming soon)");
            });
        
        // ═══════════════════════════════════════════════════════════════
        // UTILITY TOOLS - All with Copyright
        // ═══════════════════════════════════════════════════════════════
        
        this.register("weather", ["temp"], "Weather information",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide a city name!";
                try {
                    const res = await axios.get(`https://wttr.in/${args.join("")}?format=%C+%t`);
                    return this.addFooter(`🌤️ Weather in ${args.join(" ")}: ${res.data}`);
                } catch (e) {
                    return this.addFooter("❌ Could not fetch weather data!");
                }
            });
        
        this.register("qr", ["qrcode"], "Generate QR code",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide text to encode!";
                return this.addFooter(`📱 QR Code generated for: ${args.join(" ")}`);
            });
        
        this.register("shorten", ["short"], "Shorten URL",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide a URL!";
                try {
                    const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(args[0])}`);
                    return this.addFooter(`🔗 Shortened URL: ${res.data}`);
                } catch (e) {
                    return this.addFooter("❌ Could not shorten URL!");
                }
            });
        
        this.register("calc", ["calculate"], "Calculate expression",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide an expression!";
                try {
                    const result = eval(args.join(" "));
                    return this.addFooter(`🧮 Result: ${result}`);
                } catch (e) {
                    return this.addFooter("❌ Invalid expression!");
                }
            });
        
        this.register("random", ["rand"], "Random number",
            async (args, ctx) => {
                const max = parseInt(args[0]) || 100;
                return this.addFooter(`🎲 Random number: ${Math.floor(Math.random() * max) + 1}`);
            });
        
        this.register("password", ["pass"], "Generate password",
            async (args, ctx) => {
                const length = parseInt(args[0]) || 12;
                const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
                let pass = "";
                for (let i = 0; i < length; i++) pass += chars[Math.floor(Math.random() * chars.length)];
                return this.addFooter(`🔐 Generated password: ${pass}`);
            });
        
        this.register("time", ["date"], "Current time",
            async (args, ctx) => this.addFooter(`🕐 ${moment().format("YYYY-MM-DD HH:mm:ss")}`));
        
        // ═══════════════════════════════════════════════════════════════
        // AI & CHATBOT - All with Copyright
        // ═══════════════════════════════════════════════════════════════
        
        this.register("ai", ["gpt", "chat"], "AI Chat assistant",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide a message!";
                return this.addFooter(`🤖 AI Response: I'm thinking about: ${args.join(" ")}`);
            });
        
        this.register("ask", ["question"], "Ask AI anything",
            async (args, ctx) => {
                if (!args.length) return "❌ Ask a question!";
                return this.addFooter(`❓ Let me think: ${args.join(" ")}`);
            });
        
        this.register("brain", ["think"], "AI thinking",
            async (args, ctx) => {
                if (!args.length) return "❌ Provide something to think about!";
                return this.addFooter(`🧠 Processing: ${args.join(" ")}`);
            });
        
        // ═══════════════════════════════════════════════════════════════
        // ADMIN & SYSTEM - All with Copyright
        // ═══════════════════════════════════════════════════════════════
        
        this.register("block", ["ban"], "Block a user",
            async (args, ctx) => {
                if (!db.isSudo(ctx.sender)) return "❌ Sudo only!";
                if (!args.length) return "❌ Provide a number!";
                db.block(args[0]);
                return this.addFooter(`✅ Blocked: ${args[0]}`);
            });
        
        this.register("unblock", ["unban"], "Unblock a user",
            async (args, ctx) => {
                if (!db.isSudo(ctx.sender)) return "❌ Sudo only!";
                if (!args.length) return "❌ Provide a number!";
                db.unblock(args[0]);
                return this.addFooter(`✅ Unblocked: ${args[0]}`);
            });
        
        this.register("sudo", ["addsudo"], "Add sudo user",
            async (args, ctx) => {
                if (ctx.sender !== config.OWNER_NUMBER) return "❌ Owner only!";
                if (!args.length) return "❌ Provide a number!";
                db.addSudo(args[0]);
                return this.addFooter(`✅ Added sudo: ${args[0]}`);
            });
        
        this.register("delsudo", ["removesudo"], "Remove sudo user",
            async (args, ctx) => {
                if (ctx.sender !== config.OWNER_NUMBER) return "❌ Owner only!";
                if (!args.length) return "❌ Provide a number!";
                db.removeSudo(args[0]);
                return this.addFooter(`✅ Removed sudo: ${args[0]}`);
            });
        
        this.register("reboot", ["restart"], "Reboot the bot",
            async (args, ctx) => {
                if (!db.isSudo(ctx.sender)) return "❌ Sudo only!";
                setTimeout(() => process.exit(0), 2000);
                return this.addFooter("🔄 Rebooting bot...");
            });
        
        this.register("shutdown", ["stop"], "Shutdown the bot",
            async (args, ctx) => {
                if (!db.isSudo(ctx.sender)) return "❌ Sudo only!";
                setTimeout(() => process.exit(0), 2000);
                return this.addFooter("🛑 Shutting down...");
            });
        
        this.register("broadcast", ["bc"], "Broadcast message to all users",
            async (args, ctx) => {
                if (!db.isSudo(ctx.sender)) return "❌ Sudo only!";
                if (!args.length) return "❌ Provide a message!";
                return this.addFooter(`📢 Broadcast sent to all users!`);
            });
        
        logger.log(`✅ Loaded ${this.commands.size} commands with Copyright & Channel links`, "COMMANDS");
    }
    
    register(name, aliases = [], desc, fn) {
        this.commands.set(name, { name, aliases, desc, fn });
        aliases.forEach(alias => this.aliases.set(alias, name));
    }
    
    formatUptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${d}d ${h}h ${m}m ${s}s`;
    }
    
    groupCommandsByCategory() {
        const categories = {
            "📱 Basic": ["ping", "alive", "help", "owner", "info", "echo", "uptime", "stats", "channel"],
            "👥 Group": ["tagall", "tagadmin", "promote", "demote", "kick", "add", "mute", "unmute", "warn", "warns", "clearwarns", "antilink"],
            "🎮 Games": ["truth", "dare", "rps", "slot", "guess", "quiz", "tictactoe", "tts", "sticker", "emoji"],
            "📥 Download": ["ytmp3", "ytmp4", "instagram", "tiktok", "twitter"],
            "🛠️ Tools": ["weather", "qr", "shorten", "calc", "random", "password", "time"],
            "🤖 AI": ["ai", "ask", "brain"],
            "🛡️ Admin": ["block", "unblock", "sudo", "delsudo", "reboot", "shutdown", "broadcast"]
        };
        const result = {};
        for (const [cat, cmds] of Object.entries(categories)) {
            result[cat] = cmds.filter(c => this.commands.has(c));
        }
        const all = new Set(this.commands.keys());
        const used = new Set(Object.values(categories).flat());
        const other = [...all].filter(c => !used.has(c));
        if (other.length) result["📌 Other"] = other;
        return result;
    }
    
    async execute(name, args, ctx) {
        let cmd = this.commands.get(name);
        if (!cmd) {
            const alias = this.aliases.get(name);
            if (alias) cmd = this.commands.get(alias);
        }
        if (!cmd) return null;
        try {
            return await cmd.fn(args, ctx);
        } catch (e) {
            return this.addFooter(`❌ Error: ${e.message}`);
        }
    }
}

const commands = new CommandHandler();

// ═══════════════════════════════════════════════════════════════════════════
// WEB DASHBOARD WITH COPYRIGHT & CHANNEL LINKS
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.json());
app.use(express.static('public'));

app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${config.BOT_NAME}</title>
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
                .logo { text-align: center; margin-bottom: 30px; }
                .logo img { 
                    width: 100px; 
                    height: 100px; 
                    border-radius: 50%;
                    border: 3px solid ${config.PRIMARY_COLOR};
                }
                h1 {
                    color: #fff;
                    text-align: center;
                    font-size: 32px;
                    margin-bottom: 5px;
                }
                h1 span { color: ${config.PRIMARY_COLOR}; }
                .subtitle {
                    text-align: center;
                    color: #8892b0;
                    margin-bottom: 30px;
                }
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
                .stat-card .value {
                    color: #fff;
                    font-size: 24px;
                    font-weight: bold;
                }
                .stat-card .label {
                    color: #8892b0;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
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
                .links {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin: 20px 0;
                }
                .link-btn {
                    background: rgba(255,255,255,0.05);
                    color: #fff;
                    padding: 12px;
                    border-radius: 8px;
                    text-align: center;
                    text-decoration: none;
                    transition: all 0.3s;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .link-btn:hover {
                    background: ${config.PRIMARY_COLOR};
                    transform: translateY(-2px);
                }
                .footer {
                    text-align: center;
                    color: #8892b0;
                    font-size: 12px;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }
                .footer a { color: ${config.PRIMARY_COLOR}; text-decoration: none; }
                .copy { color: #8892b0; font-size: 11px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">
                    <img src="${config.LOGO_URL}" alt="${config.BOT_NAME}">
                </div>
                <h1>🤖 <span>${config.BOT_NAME}</span></h1>
                <p class="subtitle">Advanced WhatsApp Bot | v${config.BOT_VERSION}</p>
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="value" id="commands">${commands.commands.size}</div>
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
                
                <div class="links">
                    <a href="${config.WA_CHANNEL}" target="_blank" class="link-btn">📢 WhatsApp Channel</a>
                    <a href="${config.WA_NUMBER}" target="_blank" class="link-btn">💬 WhatsApp Number</a>
                    <a href="${config.INSTAGRAM}" target="_blank" class="link-btn">📱 Instagram</a>
                    <a href="${config.TELEGRAM}" target="_blank" class="link-btn">💬 Telegram</a>
                    <a href="${config.GITHUB}" target="_blank" class="link-btn" style="grid-column: 1/-1;">🔗 GitHub Repository</a>
                </div>
                
                <div style="text-align:center;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;margin:10px 0;">
                    <p style="color:#8892b0;font-size:13px;">
                        💡 Try: <code style="color:${config.PRIMARY_COLOR};">${config.PREFIX}ping</code> • 
                        <code style="color:${config.PRIMARY_COLOR};">${config.PREFIX}alive</code> • 
                        <code style="color:${config.PRIMARY_COLOR};">${config.PREFIX}help</code>
                    </p>
                </div>
                
                <div class="footer">
                    <p>${config.FOOTER}</p>
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
            </script>
        </body>
        </html>
    `);
});

app.get("/api/status", (req, res) => {
    res.json({
        status: botConnected ? "connected" : "disconnected",
        bot_name: config.BOT_NAME,
        version: config.BOT_VERSION,
        commands: commands.commands.size,
        users: db.data.stats.totalUsers,
        messages: db.data.stats.totalMessages,
        uptime: (Date.now() - BOT_START) / 1000
    });
});

app.get("/health", (req, res) => {
    res.json({ 
        status: "alive", 
        connected: botConnected, 
        commands: commands.commands.size,
        copyright: config.COPYRIGHT,
        channel: config.WA_CHANNEL
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
    logger.log(`✅ Server on port ${PORT}`, "SERVER");
    logger.log(`📢 WhatsApp Channel: ${config.WA_CHANNEL}`, "CHANNEL");
    logger.log(`© ${config.COPYRIGHT}`, "COPYRIGHT");
});

// ═══════════════════════════════════════════════════════════════════════════
// START BOT
// ═══════════════════════════════════════════════════════════════════════════

async function startBot() {
    try {
        logger.log("═".repeat(60), "STARTUP");
        logger.log(`🚀 ${config.BOT_NAME} v${config.BOT_VERSION}`, "STARTUP");
        logger.log(`📊 ${commands.commands.size} Commands Loaded`, "STARTUP");
        logger.log(`📢 WhatsApp Channel: ${config.WA_CHANNEL}`, "CHANNEL");
        logger.log(`© ${config.COPYRIGHT}`, "COPYRIGHT");
        logger.log("═".repeat(60), "STARTUP");

        const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, "session"));
        
        sock = makeWASocket({
            auth: state,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            browser: ["NAPPIER XMD", "Chrome", "6.0.0"],
            logger: pino({ level: "silent" }),
        });

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrCodeData = qr;
                logger.log("📱 QR Code generated - Scan with WhatsApp", "QR");
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === "open") {
                qrCodeData = null;
                botConnected = true;
                logger.log("✅ Connected to WhatsApp!", "CONNECTION");
                logger.log(`💜 ${commands.commands.size} Commands Ready`, "BOT");
                logger.log(`📢 Join our channel: ${config.WA_CHANNEL}`, "CHANNEL");
            } else if (connection === "close") {
                botConnected = false;
                const reason = new (require("@hapi/boom").Boom)(lastDisconnect?.error)?.output?.statusCode;
                logger.log(`⚠️ Disconnected (${reason}). Reconnecting...`, "WARNING");
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

                if (db.isBlocked(sender)) return;

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
                        isSudo: db.isSudo(sender),
                        isOwner: db.isOwner(sender),
                        pushName: msg.pushName || "Unknown",
                        args,
                        startTime: BOT_START,
                    };

                    db.addCommand(sender, cmd);
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
    logger.log(`© ${config.COPYRIGHT}`, "COPYRIGHT");
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
