import fs from "fs";
import config from "../config.cjs";

const autostatusreplyCommand = async (m, Matrix) => {
  try {
    const botNumber = await Matrix.decodeJid(Matrix.user.id);
    const isCreator = [botNumber, config.OWNER_NUMBER + "@s.whatsapp.net"].includes(m.sender);
    const prefix = config.Prefix || config.PREFIX || ".";
    const cmd = m.body?.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const text = m.body.slice(prefix.length + cmd.length).trim().toLowerCase();

    if (cmd !== "autostatusreply") return;

    if (!isCreator) {
      return Matrix.sendMessage(m.from, {
        text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ Get lost, poser! Only *NAPPIER-XMD*'s boss can fuck with status replies! 😤🔪
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
      }, { quoted: m });
    }

    if (!text) {
      return Matrix.sendMessage(m.from, {
        text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ Yo, braindead, tell *NAPPIER-XMD* *on* or *off*! Don't just stare! 😆
│❒ Ex: *${prefix}autostatusreply on*
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
      }, { quoted: m });
    }

    if (!["on", "off"].includes(text)) {
      return Matrix.sendMessage(m.from, {
        text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ What's this garbage? *NAPPIER-XMD* only takes *on* or *off*, clown! 🤡
│❒ Ex: *${prefix}autostatusreply on*
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
      }, { quoted: m });
    }

    config.AUTO_STATUS_REPLY = text === "on";

    try {
      fs.writeFileSync("./config.cjs", `module.exports = ${JSON.stringify(config, null, 2)};`);
    } catch (error) {
      console.error(`Error saving config.cjs: ${error.message}`);
      return Matrix.sendMessage(m.from, {
        text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ *NAPPIER-XMD* choked tryin' to save that, fam! Server's trash! 😣
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
      }, { quoted: m });
    }

    await Matrix.sendMessage(m.from, {
      text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ *NAPPIER-XMD* auto-status reply flipped to *${text}*! You're runnin' this, boss! 💪🔥
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
    }, { quoted: m });
  } catch (error) {
    console.error(`❌ Autostatusreply error: ${error.message}`);
    await Matrix.sendMessage(m.from, {
      text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ *NAPPIER-XMD* screwed up somewhere, fam! Hit it again! 😈
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
    }, { quoted: m });
  }
};

export default autostatusreplyCommand;