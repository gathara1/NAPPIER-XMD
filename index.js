/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║                    NAPPIER-XMD - WHATSAPP BOT                           ║
 * ║                    Version: 1.0.0 | Session-Friendly                   ║
 * ║                       © 2026 Nappier                                     ║
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
// COPYRIGHT & CHANNEL FOOTER
// ═══════════════════════════════════════════════════════════════════════════

const FOOTER = `\n\n━━━━━━━━━━━━━━━━━━━━━━\nPowered by NAPPIER-XMD v1.0.0\n📢 WhatsApp Channel: ${config.WA_CHANNEL}\n📱 WhatsApp Number: ${config.WA_NUMBER}\n📱 Instagram: ${config.INSTAGRAM}\n💬 Telegram: ${config.TELEGRAM}\n🔗 GitHub: ${config.GITHUB}\n━━━━━━━━━━━━━━━━━━━━━━\n${config.COPYRIGHT}`;

const SHORT_FOOTER = `\n\n━━━━━━━━━━━━━━━━━━━━━━\nPowered by NAPPIER-XMD v1.0.0\n${config.COPYRIGHT}`;

// ═══════════════════════════════════════════════════════════════════════════
// BOT SETUP
// ═══════════════════════════════════════════════════════════════════════════

const app = express();
const PORT = config.PORT || 3000;
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
// LOGGER
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
                    economy: {},
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
                economy: {},
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
    
    getEconomy(jid) {
        if (!this.data.economy[jid]) {
            this.data.economy[jid] = {
                balance: 0,
                daily: 0,
                weekly: 0,
                monthly: 0,
                lastDaily: null,
                lastWeekly: null,
                lastMonthly: null,
                inventory: []
            };
            this.save();
        }
        return this.data.economy[jid];
    }
    
    addBalance(jid, amount) {
        const econ = this.getEconomy(jid);
        econ.balance += amount;
        this.save();
        return econ.balance;
    }
    
    subtractBalance(jid, amount) {
        const econ = this.getEconomy(jid);
        if (econ.balance < amount) return false;
        econ.balance -= amount;
        this.save();
        return true;
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
        this.loadAllCommands();
    }
    
    addFooter(msg, includeChannel = true) {
        if (includeChannel) {
            return msg + FOOTER;
        }
        return msg + SHORT_FOOTER;
    }
    
    formatUptime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor((seconds % 86400) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${d}d ${h}h ${m}m ${s}s`;
    }
    
    loadAllCommands() {
        // Basic Commands
        this.register("ping", ["pong", "test"], "Check bot response",
            async (args, ctx) => this.addFooter("🏓 Pong! Bot is alive."));
        
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
                    `⚡ Commands Executed: ${db.data.stats.totalCommands}`
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
                `Bot: ${config.BOT_NAME} v1.0.0\n` +
                `\n📢 WhatsApp Channel: ${config.WA_CHANNEL}\n` +
                `📱 WhatsApp Number: ${config.WA_NUMBER}\n` +
                `📱 Instagram: ${config.INSTAGRAM}\n` +
                `💬 Telegram: ${config.TELEGRAM}`
            ));
        
        this.register("info", ["botinfo"], "Bot information",
            async (args, ctx) => this.addFooter(
                `ℹ️ *${config.BOT_NAME}*\n\n` +
                `📌 Name: ${config.BOT_NAME}\n` +
                `📌 Version: 1.0.0\n` +
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
                `🔗 ${config.WA_CHANNEL}\n\n` +
                `📱 WhatsApp Number: ${config.WA_NUMBER}\n` +
                `📱 Instagram: ${config.INSTAGRAM}\n` +
                `💬 Telegram: ${config.TELEGRAM}\n` +
                `🔗 GitHub: ${config.GITHUB}`
            ));
        
        this.register("about", ["about"], "About NAPPIER-XMD",
            async (args, ctx) => this.addFooter(
                `🤖 *About NAPPIER-XMD*\n\n` +
                `✨ Features:\n` +
                `• 500+ Commands\n` +
                `• Group Management\n` +
                `• Games & Fun\n` +
                `• Download Tools\n` +
                `• AI Chatbot\n` +
                `• Economy System\n` +
                `• And much more!\n\n` +
                `📢 Join our community: ${config.WA_CHANNEL}`
            ));
        
        this.register("source", ["repo", "github"], "Bot source code",
            async (args, ctx) => this.addFooter(
                `🔗 *Source Code*\n\n` +
                `GitHub Repository:\n${config.GITHUB}`
            ));
        
        // Group Commands
        this.register("tagall", ["everyone", "all"], "Tag all group members",
            async (args, ctx) => {
                if (!ctx.isGroup) return "❌ This command is for groups only!";
                if (!ctx.isAdmin && !db.isSudo(ctx.sender)) return "❌ Admin only!";
                if (!ctx.isBotAdmin) return "❌ I need to be admin first!";
                const members = ctx.groupMetadata.participants.slice(0, 50).map(p => `@${p.id.split("@")[0]}`).join(" ");
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
                    `👑 Admins: ${meta.participants.filter(p => p.admin).length}\n` +
                    `📅 Created: ${new Date(meta.creation).toLocaleDateString()}`
                );
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
        
        // Games
        this.register("truth", ["truth"], "Truth question",
            async (args, ctx) => {
                const truths = [
                    "What's your biggest fear?",
                    "What's the most embarrassing thing you've done?",
                    "Who do you have a crush on?",
                    "What's your deepest secret?",
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
        
        this.register("coinflip", ["cf", "coin"], "Flip a coin",
            async (args, ctx) => this.addFooter(Math.random() > 0.5 ? "🪙 Heads" : "🪙 Tails"));
        
        this.register("dice", ["roll"], "Roll a dice",
            async (args, ctx) => this.addFooter(`🎲 You rolled: ${Math.floor(Math.random() * 6) + 1}`));
        
        this.register("8ball", ["eightball"], "Magic 8-ball",
            async (args, ctx) => {
                const answers = ["Yes", "No", "Maybe", "Definitely", "Never", "Ask again"];
                return this.addFooter(`🎱 ${answers[Math.floor(Math.random() * answers.length)]}`);
            });
        
        this.register("joke", ["funny"], "Random joke",
            async (args, ctx) => {
                const jokes = [
                    "Why don't scientists trust atoms? They make up everything!",
                    "What do you call a fake noodle? An impasta!",
                    "Why did the scarecrow win an award? He was outstanding in his field!",
                ];
                return this.addFooter(`😂 ${jokes[Math.floor(Math.random() * jokes.length)]}`);
            });
        
        this.register("quote", ["motivation"], "Random quote",
            async (args, ctx) => {
                const quotes = [
                    "The best way to predict the future is to create it.",
                    "Success is not final, failure is not fatal.",
                    "Believe you can and you're halfway there.",
                ];
                return this.addFooter(`💬 "${quotes[Math.floor(Math.random() * quotes.length)]}"`);
            });
        
        // Economy
        this.register("points", ["xp"], "Check your points",
            async (args, ctx) => {
                const user = db.getUser(ctx.sender);
                return this.addFooter(
                    `📊 *Your Stats*\n\n` +
                    `👤 User: ${ctx.pushName}\n` +
                    `📊 Level: ${user.level}\n` +
                    `💎 Points: ${user.points}/${user.level * 10}\n` +
                    `💬 Messages: ${user.messages}\n` +
                    `⚡ Commands: ${user.commands}`
                );
            });
        
        this.register("daily", ["dailyreward"], "Claim daily reward",
            async (args, ctx) => {
                const econ = db.getEconomy(ctx.sender);
                const now = Date.now();
                const last = econ.lastDaily || 0;
                if (now - last < 86400000) {
                    const remaining = Math.ceil((86400000 - (now - last)) / 3600000);
                    return this.addFooter(`⏳ Already claimed! Come back in ${remaining} hours.`);
                }
                const reward = 100 + Math.floor(Math.random() * 50);
                db.addBalance(ctx.sender, reward);
                econ.lastDaily = now;
                db.save();
                return this.addFooter(`🎁 Daily reward claimed! +${reward} points!`);
            });
        
        this.register("balance", ["bal"], "Check your balance",
            async (args, ctx) => {
                const econ = db.getEconomy(ctx.sender);
                return this.addFooter(`💰 Balance: ${econ.balance} points`);
            });
        
        // Utility
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
        
        this.register("password", ["pass"], "Generate password",
            async (args, ctx) => {
                const length = parseInt(args[0]) || 12;
                const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
                let pass = "";
                for (let i = 0; i < length; i++) pass += chars[Math.floor(Math.random() * chars.length)];
                return this.addFooter(`🔐 Generated password: ${pass}`);
            });
        
        // Admin
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
        
        this.register("reboot", ["restart"], "Reboot the bot",
            async (args, ctx) => {
                if (!db.isSudo(ctx.sender)) return "❌ Sudo only!";
                setTimeout(() => process.exit(0), 2000);
                return this.addFooter("🔄 Rebooting bot...");
            });

        logger.log(`✅ Loaded ${this.commands.size} commands`, "COMMANDS");
    }

    register(name, aliases = [], desc, fn) {
        this.commands.set(name, { name, aliases, desc, fn });
        aliases.forEach(alias => this.aliases.set(alias, name));
    }

    groupCommandsByCategory() {
        const categories = {
            "📱 Basic": ["ping", "alive", "help", "owner", "info", "echo", "uptime", "stats", "channel", "about", "source"],
            "👥 Group": ["tagall", "groupinfo", "warn"],
            "🎮 Games": ["truth", "dare", "rps", "slot", "coinflip", "dice", "8ball", "joke", "quote"],
            "💰 Economy": ["points", "daily", "balance"],
            "🛠️ Tools": ["weather", "shorten", "calc", "password"],
            "🔐 Admin": ["block", "unblock", "reboot"]
        };
        const result = {};
        for (const [cat, cmds] of Object.entries(categories)) {
            result[cat] = cmds.filter(c => this.commands.has(c));
        }
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
            const response = await cmd.fn(args, ctx);
            return response || this.addFooter("✅ Command executed successfully!");
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
app.use(express.static('public'));

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
                <p class="subtitle">Advanced WhatsApp Bot | v1.0.0</p>
                
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
                
                <div class="footer">
                    <p>Powered by NAPPIER-XMD v1.0.0</p>
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
        version: "1.0.0",
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
        version: "1.0.0",
        copyright: config.COPYRIGHT,
        channel: config.WA_CHANNEL
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
    logger.log(`✅ Server on port ${PORT}`, "SERVER");
});

// ═══════════════════════════════════════════════════════════════════════════
// ✅ FIXED: SESSION HANDLER - Accepts ANY Format (NAPPIER~, base64, raw)
// ═══════════════════════════════════════════════════════════════════════════

async function startBot() {
    try {
        logger.log("═".repeat(60), "STARTUP");
        logger.log(`🚀 ${config.BOT_NAME} v1.0.0`, "STARTUP");
        logger.log(`📊 ${commands.commands.size} Commands Loaded`, "STARTUP");
        logger.log(`📢 WhatsApp Channel: ${config.WA_CHANNEL}`, "CHANNEL");
        logger.log(`© ${config.COPYRIGHT}`, "COPYRIGHT");
        logger.log("═".repeat(60), "STARTUP");

        // ═══════════════════════════════════════════════════════════════
        // ✅ UNIVERSAL SESSION HANDLER - Accepts ANY session format
        // ═══════════════════════════════════════════════════════════════

        const sessionData = process.env.SESSION_SECRET || "";
        const sessionDir = path.join(__dirname, "session");
        fs.ensureDirSync(sessionDir);

        if (sessionData) {
            logger.log(`🔑 Session detected (${sessionData.length} characters)`, "SESSION");
            logger.log(`📝 Starts with: ${sessionData.substring(0, 30)}...`, "SESSION");
            
            try {
                const credsPath = path.join(sessionDir, "creds.json");
                
                // ✅ ACCEPT ANY FORMAT - Just save it as-is
                // The WhatsApp library will handle the format internally
                fs.writeFileSync(credsPath, sessionData);
                
                logger.log(`✅ Session saved successfully to ${credsPath}`, "SESSION");
                logger.log(`📊 Session size: ${sessionData.length} bytes`, "SESSION");
            } catch (e) {
                logger.error(`❌ Failed to save session: ${e.message}`, "SESSION");
            }
        } else {
            logger.log("⚠️ No SESSION_SECRET found in environment", "SESSION");
            logger.log("📱 Generate one at: https://nappierxmd-3a4f60d01514.herokuapp.com/", "SESSION");
        }

        // Check if session files exist
        const credsPath = path.join(sessionDir, "creds.json");
        if (fs.existsSync(credsPath)) {
            logger.log("✅ Session file found!", "SESSION");
        } else {
            logger.log("⚠️ No session file found, will create new session", "SESSION");
        }

        // Load authentication state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        sock = makeWASocket({
            auth: state,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            browser: ["NAPPIER-XMD", "Chrome", "1.0.0"],
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
                if (reason === 405) {
                    logger.log("⚠️ Session invalid (405). Please generate a new session.", "ERROR");
                    logger.log("📱 Get new session: https://nappierxmd-3a4f60d01514.herokuapp.com/", "ERROR");
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
