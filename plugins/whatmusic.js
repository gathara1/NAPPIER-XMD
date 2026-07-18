import fs from "fs";
import acrcloud from "acrcloud";
import config from "../config.cjs";

const acr = new acrcloud({
  host: "identify-eu-west-1.acrcloud.com",
  access_key: "716b4ddfa557144ce0a459344fe0c2c9",
  access_secret: "Lz75UbI8g6AzkLRQgTgHyBlaQq9YT5wonr3xhFkf",
});

const shazam = async (m, Matrix) => {
  try {
    const prefix = config.Prefix || config.PREFIX || ".";
    const cmd = m.body?.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const text = m.body.slice(prefix.length + cmd.length).trim();

    const validCommands = ["shazam", "find", "whatmusic"];
    if (!validCommands.includes(cmd)) return;

    const quoted = m.quoted || {};
    if (!quoted || (quoted.mtype !== "audioMessage" && quoted.mtype !== "videoMessage")) {
      return Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ Yo, *NAPPIER-XMD* needs a quoted audio or video to ID, fam! 🎵
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });
    }

    try {
      const media = await m.quoted.download();
      const filePath = `./${Date.now()}.mp3`;
      fs.writeFileSync(filePath, media);

      await Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* sniffin' out that track, hold up... 🔍
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });

      const res = await acr.identify(fs.readFileSync(filePath));
      const { code, msg } = res.status;

      if (code !== 0) {
        throw new Error(msg);
      }

      const { title, artists, album, genres, release_date } = res.metadata.music[0];
      const txt = `◈━━━━━━━━━━━━━━━━◈
│❒ 🎉 *NAPPIER-XMD* FOUND IT! 🎉
│❒ 📌 *Title*: ${title}
│❒ 👨‍🎤 *Artist*: ${artists ? artists.map((v) => v.name).join(", ") : "Unknown"}
│❒ 💿 *Album*: ${album ? album.name : "Unknown"}
│❒ 🎸 *Genre*: ${genres ? genres.map((v) => v.name).join(", ") : "Unknown"}
│❒ 📅 *Release*: ${release_date || "Unknown"}
◈━━━━━━━━━━━━━━━━◈`;

      fs.unlinkSync(filePath);
      await Matrix.sendMessage(m.from, { text: txt }, { quoted: m });
    } catch (error) {
      console.error(`🎵 Shazam error: ${error.message}`);
      fs.unlinkSync(filePath); // Clean up even on error
      await Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* couldn't ID that track, fam! Try another! 😣
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });
    }
  } catch (error) {
    console.error(`❌ Shazam error: ${error.message}`);
    await Matrix.sendMessage(m.from, {
      text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* hit a glitch, fam! Retry that jam! 😈
◈━━━━━━━━━━━━━━━━◈`,
    }, { quoted: m });
  }
};

export default shazam;