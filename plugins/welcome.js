import config from "../config.cjs";

const gcEvent = async (m, Matrix) => {
  try {
    const prefix = config.Prefix || config.PREFIX || ".";
    const cmd = m.body?.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const text = m.body.slice(prefix.length + cmd.length).trim();

    if (cmd === "welcome") {
      if (!m.isGroup) {
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ This ain't for lone wolves, fam! Use in a group! 🐺
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      const groupMetadata = await Matrix.groupMetadata(m.from);
      const participants = groupMetadata.participants;
      const botNumber = await Matrix.decodeJid(Matrix.user.id);
      const botAdmin = participants.find((p) => p.id === botNumber)?.admin;
      const senderAdmin = participants.find((p) => p.id === m.sender)?.admin;

      if (!botAdmin) {
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* needs admin powers to run this, fam! 😡
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      if (!senderAdmin) {
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ You ain't an admin, bruh! Step up or step out! 😎
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      let responseMessage;
      if (text === "on") {
        config.WELCOME = true;
        responseMessage = `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* welcome & left messages ON! Newbies beware! 😈
◈━━━━━━━━━━━━━━━━◈`;
      } else if (text === "off") {
        config.WELCOME = false;
        responseMessage = `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* welcome & left messages OFF! Silent mode, fam! 💀
◈━━━━━━━━━━━━━━━━◈`;
      } else {
        responseMessage = `◈━━━━━━━━━━━━━━━━◈
│❒ Yo, use it right, fam!
│❒ - \`${prefix}welcome on\`: Enable welcome & left
│❒ - \`${prefix}welcome off\`: Disable welcome & left
◈━━━━━━━━━━━━━━━━◈`;
      }

      await Matrix.sendMessage(m.from, { text: responseMessage }, { quoted: m });
    }
  } catch (error) {
    console.error(`❌ Welcome error: ${error.message}`);
    await Matrix.sendMessage(m.from, {
      text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* hit a snag, fam! Try again, we still savage! 😈
◈━━━━━━━━━━━━━━━━◈`,
    }, { quoted: m });
  }
};

export default gcEvent;