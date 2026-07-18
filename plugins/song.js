import axios from "axios";
import yts from "yt-search";
import config from "../config.cjs";

const song = async (m, Matrix) => {
  try {
    const prefix = config.Prefix || config.PREFIX || ".";
    const cmd = m.body?.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const args = m.body.slice(prefix.length + cmd.length).trim().split(" ");

    if (cmd === "song") {
      if (args.length === 0 || !args.join(" ")) {
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ Yo, *NAPPIER-XMD* needs a song name or keywords, fam! 🎵
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      const searchQuery = args.join(" ");
      await Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* huntin' for "${searchQuery}"... 🎥🔍
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });

      const searchResults = await yts(searchQuery);
      if (!searchResults.videos || searchResults.videos.length === 0) {
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ No tracks found for "${searchQuery}". You slippin'! 💀
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      const firstResult = searchResults.videos[0];
      const videoUrl = firstResult.url;

      // Fetch video using API
      const apiUrl = `https://apis.davidcyriltech.my.id/youtube/mp4?url=${videoUrl}`;
      let response;
      try {
        response = await axios.get(apiUrl);
        console.log(`API response:`, JSON.stringify(response.data, null, 2)); // Debug log
      } catch (apiError) {
        console.error(`API error:`, apiError.message);
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* couldn't fetch "${searchQuery}". API's actin' weak! 😡
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      if (!response.data?.success || !response.data?.result) {
        console.error(`Invalid API response:`, response.data);
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* got junk data for "${searchQuery}". API's trash! 😤
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      const { title, download_url } = response.data.result;
      if (!title || !download_url) {
        console.error(`Missing title or download_url:`, response.data.result);
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* can't play "${searchQuery}". No video link, fam! 😣
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      // Send the video file
      await Matrix.sendMessage(
        m.from,
        {
          video: { url: download_url },
          mimetype: "video/mp4",
          caption: `◈━━━━━━━━━━━━━━━━◈
│❒ *${title}* dropped by *NAPPIER-XMD*! Blast it, fam! 🎬🔥
◈━━━━━━━━━━━━━━━━◈`,
        },
        { quoted: m }
      );
    }
  } catch (error) {
    console.error(`❌ Song error: ${error.message}`);
    await Matrix.sendMessage(m.from, {
      text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* hit a snag, fam! Try another track! 😈
◈━━━━━━━━━━━━━━━━◈`,
    }, { quoted: m });
  }
};

export default song;