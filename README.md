<a><img src='https://img.sanishtech.com/u/db971cb39b6eee4a066c712bd5fb7565.png'/></a>

<h1 align="center">🤖 NAPPIER-XMD V6.0.0</h1>
<p align="center"><b>Advanced WhatsApp Bot | Smart Assistant for Tech, Tools & APIs</b></p>

<div align="center">

[![GitHub](https://img.shields.io/badge/GitHub-gathara1-blue?style=for-the-badge&logo=github)](https://github.com/gathara1)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node-18+-green?style=for-the-badge)](https://nodejs.org)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Channel-25D366?style=for-the-badge&logo=whatsapp)](https://whatsapp.com/channel/0029VbCPRUwLI8YhL4yg9l0y)
[![Deploy](https://img.shields.io/badge/Deploy-Heroku-430098?style=for-the-badge&logo=heroku)](https://dashboard.heroku.com/new?template=https://github.com/gathara1/NAPPIER-XMD)

</div>

---

## 📌 **How to Connect NAPPIER XMD Bot**

### Step 1: Get Session ID

Click the button below to quickly generate your WhatsApp session ID:

<a href="https://nappierxmd-3a4f60d01514.herokuapp.com/">
  <img src="https://img.shields.io/badge/🔑_Get_Session_ID-7c3aed?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Get Session ID">
</a>

**Session Generator:** [https://nappierxmd-3a4f60d01514.herokuapp.com/](https://nappierxmd-3a4f60d01514.herokuapp.com/)

- **Method 1:** Scan QR code with WhatsApp
- **Method 2:** Use Pair Code with your phone number
- Copy the session ID (starts with `NAPPIER~`)

### Step 2: Configure Settings

Before deployment, configure your bot:

- **Option A:** Edit `config.env` file
- **Option B:** Use environment variables on your hosting platform

```env
# Required
SESSION_SECRET=NAPPIER~YOUR_SESSION_ID_HERE

# Optional
AUTO_READ_MESSAGES=off
AUTO_REACT=off
ANTILINK_ENABLED=false
MAX_WARNS=3
