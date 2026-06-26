require('dotenv').config();

const config = {
    // ═══════════════════════════════════════════════════════════════
    // BOT INFO
    // ═══════════════════════════════════════════════════════════════
    BOT_NAME: 'NAPPIER-XMD',
    BOT_VERSION: '6.0.0',
    AUTHOR: 'nappier',
    REPO: 'https://github.com/gathara1/NAPPIER-XMD',
    PREFIX: '.',
    MODE: 'public',
    TIME_ZONE: 'Africa/Nairobi',
    
    // ═══════════════════════════════════════════════════════════════
    // COPYRIGHT & CHANNEL (Attached to EVERYTHING)
    // ═══════════════════════════════════════════════════════════════
    COPYRIGHT: '© nappier | All Rights Reserved',
    WA_CHANNEL: 'https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y',
    WA_NUMBER: 'https://wa.me/254735638957',
    INSTAGRAM: 'https://www.instagram.com/l.ycifer',
    TELEGRAM: 'https://t.me/+254723270450',
    GITHUB: 'https://github.com/gathara1',
    FOOTER: 'Powered by nappier',
    
    // ═══════════════════════════════════════════════════════════════
    // PORT
    // ═══════════════════════════════════════════════════════════════
    PORT: process.env.PORT || 3000,
    
    // ═══════════════════════════════════════════════════════════════
    // DATABASE
    // ═══════════════════════════════════════════════════════════════
    MONGODB_URI: process.env.MONGODB_URI || null,
    DATABASE_URL: process.env.DATABASE_URL || null,
    
    // ═══════════════════════════════════════════════════════════════
    // SESSION
    // ═══════════════════════════════════════════════════════════════
    SESSION_PREFIX: 'NAPPIER~',
    SESSION_SECRET: process.env.SESSION_SECRET || 'nappier-xmd-secret',
    
    // ═══════════════════════════════════════════════════════════════
    // LOGO & BRANDING
    // ═══════════════════════════════════════════════════════════════
    LOGO_URL: 'https://img.sanishtech.com/u/db971cb39b6eee4a066c712bd5fb7565.png',
    PRIMARY_COLOR: '#7c3aed',
    SECONDARY_COLOR: '#06b6d4',
    ACCENT_COLOR: '#ec4899',
    
    // ═══════════════════════════════════════════════════════════════
    // AUTO FEATURES
    // ═══════════════════════════════════════════════════════════════
    AUTO_READ_MESSAGES: process.env.AUTO_READ_MESSAGES || 'off',
    AUTO_REACT: process.env.AUTO_REACT || 'off',
    AUTO_BIO: process.env.AUTO_BIO === 'true',
    AUTO_STATUS: process.env.AUTO_STATUS === 'true',
    REJECT_CALLS: process.env.REJECT_CALLS === 'true',
    
    // ═══════════════════════════════════════════════════════════════
    // GROUP SETTINGS
    // ═══════════════════════════════════════════════════════════════
    WELCOME_MESSAGE: 'Welcome to the group! 🎉\n\nJoin our WhatsApp Channel:\n' + 
                     'https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y',
    GOODBYE_MESSAGE: 'Goodbye! 👋\n\n© nappier | All Rights Reserved',
    ANTILINK_ENABLED: process.env.ANTILINK_ENABLED === 'true',
    ANTISPAM_ENABLED: process.env.ANTISPAM_ENABLED === 'true',
    MAX_WARNS: parseInt(process.env.MAX_WARNS) || 3,
};

module.exports = config;
