/**
 * Nappier XMD - Bot Configuration
 * Load environment variables and default settings
 */

require('dotenv').config();

const config = {
  SESSION_ID: process.env.SESSION_ID || "Gifted~your_session_id_here",
  BOT_NAME: process.env.BOT_NAME || "Nappier XMD",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "254712345678@s.whatsapp.net",
  PREFIX: process.env.PREFIX || ".",
  MODE: process.env.MODE || "public",
  TIME_ZONE: process.env.TIME_ZONE || "Africa/Nairobi",
  AUTO_READ_MESSAGES: process.env.AUTO_READ_MESSAGES || "off",
  AUTO_REACT: process.env.AUTO_REACT || "off",
  AUTO_READ_STATUS: process.env.AUTO_READ_STATUS === "true",
  AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS === "true",
  AUTO_REPLY_STATUS: process.env.AUTO_REPLY_STATUS === "true",
  AUTO_BIO: process.env.AUTO_BIO === "true",
  AUTO_BLOCK: process.env.AUTO_BLOCK || "",
  CHATBOT: process.env.CHATBOT || "false",
  CHATBOT_MODE: process.env.CHATBOT_MODE || "inbox",
  BOT_PIC: process.env.BOT_PIC || "https://i.imgur.com/LyHic3i.gif",
  FOOTER: process.env.FOOTER || "Nappier XMD",
  CAPTION: process.env.CAPTION || "Powered by Nappier XMD",
  VERSION: process.env.VERSION || "1.0.0",
  PACK_NAME: process.env.PACK_NAME || "Nappier XMD",
  PACK_AUTHOR: process.env.PACK_AUTHOR || "nappier",
  BOT_REPO: process.env.BOT_REPO || "https://github.com/gathara1/NAPPIER-XMD",
  YT: process.env.YT || "https://www.youtube.com",
  NEWSLETTER_URL: process.env.NEWSLETTER_URL || "https://whatsapp.com/channel/0029VbCpYtZLtOj5LDuj7Q1p",
  NEWSLETTER_JID: process.env.NEWSLETTER_JID || "120363267244480699@newsletter",
  GC_JID: process.env.GC_JID || "",
  PORT: process.env.PORT || 5000,
};

if (!config.SESSION_ID || config.SESSION_ID === "Gifted~your_session_id_here") {
  console.warn("⚠️  WARNING: SESSION_ID not configured. Get it from: https://nappierxmd-3a4f60d01514.herokuapp.com/");
}

module.exports = config;
