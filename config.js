require('dotenv').config();

const config = {
    SESSION_ID: process.env.SESSION_ID || "Nappier~your_session_id_here",
    BOT_NAME: process.env.BOT_NAME || "Nappier XMD",
    VERSION: "1.0.0",
    OWNER_NUMBER: process.env.OWNER_NUMBER || "254712345678@s.whatsapp.net",
    PREFIX: process.env.PREFIX || ".",
    MODE: process.env.MODE || "public",
    TIME_ZONE: process.env.TIME_ZONE || "Africa/Nairobi",
    AUTO_READ_MESSAGES: process.env.AUTO_READ_MESSAGES || "off",
    AUTO_REACT: process.env.AUTO_REACT || "off",
    AUTO_BIO: process.env.AUTO_BIO === "true",
    REJECT_CALLS: process.env.REJECT_CALLS === "true",
    BOT_REPO: "https://github.com/gathara1/NAPPIER-XMD",
    PORT: process.env.PORT || 5000,
};

if (!config.SESSION_ID || config.SESSION_ID === "Gifted~your_session_id_here") {
    console.warn("⚠️ SESSION_ID not configured!");
    console.warn("Get it from: https://nappierxmd-3a4f60d01514.herokuapp.com/");
}

module.exports = config;
