<a><img src='https://img.sanishtech.com/u/db971cb39b6eee4a066c712bd5fb7565.png'/></a>

<h1 align="center">🤖 NAPPIER-XMD V6.0.0</h1>
<p align="center"><b>Advanced WhatsApp Bot with 500+ Commands</b></p>

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-gathara1-blue?style=for-the-badge&logo=github)](https://github.com/gathara1)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18+-green?style=for-the-badge)](https://nodejs.org)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Channel-25D366?style=for-the-badge&logo=whatsapp)](https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y)
[![Deploy](https://img.shields.io/badge/Deploy-Heroku-430098?style=for-the-badge&logo=heroku)](https://dashboard.heroku.com/new?template=https://github.com/gathara1/NAPPIER-XMD)

</div>

---

## 📢 **Join Our Community**

| Platform | Link |
|----------|------|
| 📱 **WhatsApp Channel** | [Click Here](https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y) |
| 💬 **WhatsApp Number** | [Click Here](https://wa.me/254735638957) |
| 📱 **Instagram** | [@l.ycifer](https://www.instagram.com/l.ycifer) |
| 💬 **Telegram** | [Join Here](https://t.me/+254723270450) |
| 🔗 **GitHub** | [gathara1](https://github.com/gathara1) |

---

## 📋 **Features**

- ✅ **500+ Commands** - Comprehensive bot functionality
- ✅ **Advanced Group Management** - tagall, promote, demote, warn system
- ✅ **Games & Fun** - truth, dare, rps, slot, quiz, tictactoe
- ✅ **Download Tools** - ytmp3, ytmp4, instagram, tiktok
- ✅ **AI Chatbot** - ai, ask, brain integration
- ✅ **Utility Tools** - weather, qr, shorten, calc
- ✅ **Admin System** - block, unblock, sudo, reboot
- ✅ **Professional Dashboard** - Real-time statistics
- ✅ **Copyright Protection** - All commands include copyright and channel links

---

## 🔑 **Session & Authentication**

### **Step 1: Get Your Session ID**

NAPPIER-XMD supports **two login methods** for your convenience:

#### **Method 1: QR Code Login (Recommended)**
1. Visit the session generator: **[https://nappierxmd-3a4f60d01514.herokuapp.com/](https://nappierxmd-3a4f60d01514.herokuapp.com/)**
2. Click on **"QR Login"**
3. Scan the QR code with your WhatsApp mobile app
4. Copy the generated session ID (starts with `NAPPIER~`)

#### **Method 2: Pair Code Login**
1. Visit the session generator: **[https://nappierxmd-3a4f60d01514.herokuapp.com/](https://nappierxmd-3a4f60d01514.herokuapp.com/)**
2. Click on **"Pair Code"**
3. Enter your WhatsApp number with country code (e.g., `254712345678`)
4. Copy the 8-digit code from WhatsApp
5. Paste it in the session generator
6. Copy the generated session ID

### **Step 2: Configure Session**

Add your session ID to the bot configuration:

```bash
# For Heroku
heroku config:set SESSION_SECRET="NAPPIER~YOUR_SESSION_ID"

# For local development
echo "SESSION_SECRET=NAPPIER~YOUR_SESSION_ID" >> .env
