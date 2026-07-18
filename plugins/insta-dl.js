import axios from "axios";
import config from "../config.cjs";

const instagram = async (m, Matrix) => {
  const prefix = config.Prefix || config.PREFIX || ".";
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
  const query = m.body.slice(prefix.length + cmd.length).trim();

  if (!["ig", "insta", "instagram"].includes(cmd)) return;

  if (!query || !query.startsWith("http")) {
    return Matrix.sendMessage(m.from, {
      text: `◈━━━━━━━━━━━━━━━━◈
│❒ Yo, give me an Instagram URL to download, fam! 😎
│❒ Example: *${prefix}${cmd}* https://www.instagram.com/reel/C9bjQfRprHK
◈━━━━━━━━━━━━━━━━◈`,
    }, { quoted: m });
  }

  try {
    await Matrix.sendMessage(m.from, { react: { text: "⏳", key: m.key } });

    const apiEndpoint = `https://api.giftedtech.web.id/api/download/instadl?apikey=gifted_api_se5dccy&url=${encodeURIComponent(query)}`;
    const { data } = await axios.get(apiEndpoint);

    if (!data.success || !data.result?.download_url) {
      console.error(`[ERROR] Invalid Instagram API response: ${JSON.stringify(data)}`);
      return Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* couldn't fetch the Instagram video. API's actin' up! 😡
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });
    }

    const { download_url } = data.result;
    await Matrix.sendMessage(m.from, {
      video: { url: download_url },
      mimetype: "video/mp4",
      caption: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* dropped your Instagram video! Watch it 📹, fam!
◈━━━━━━━━━━━━━━━━◈`,
      contextInfo: {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true,
      },
    }, { quoted: m });

    await Matrix.sendMessage(m.from, { react: { text: "✅", key: m.key } });

  } catch (error) {
    console.error(`[ERROR] Instagram Downloader Error: ${error.message}`);
    await Matrix.sendMessage(m.from, {
      text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* hit a snag while fetching the Instagram video, fam! Try again! 😈
◈━━━━━━━━━━━━━━━━◈`,
    }, { quoted: m });
  }
};

export default instagram;