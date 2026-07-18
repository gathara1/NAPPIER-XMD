import fetch from 'node-fetch';
import ytSearch from 'yt-search';
import fs from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import os from 'os';
import config from "../config.cjs";

const streamPipeline = promisify(pipeline);
const tmpDir = os.tmpdir();

const play = async (m, Matrix) => {
  try {
    const prefix = config.Prefix || config.PREFIX || ".";
    const cmd = m.body?.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const args = m.body.slice(prefix.length + cmd.length).trim().split(" ");

    if (cmd === "play") {
      if (args.length === 0 || !args.join(" ")) {
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ Give me a song name or keywords to search 😎
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      const searchQuery = args.join(" ");
      await Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* huntin' for "${searchQuery}"... 🎧
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });

      const searchResults = await ytSearch(searchQuery);
      if (!searchResults.videos || searchResults.videos.length === 0) {
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ No tracks found for "${searchQuery}". You slippin'! 💀
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      const song = searchResults.videos[0];
      const safeTitle = song.title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_').substring(0, 100);
      const filePath = `${tmpDir}/${safeTitle}.mp3`;

      let response;
      try {
        const apiUrl = `https://ironman.koyeb.app/ironman/dl/yta?url=${encodeURIComponent(song.url)}`;
        response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`API responded with status: ${response.status}`);
        }
        const fileStream = fs.createWriteStream(filePath);
        await streamPipeline(response.body, fileStream);
      } catch (apiError) {
        console.error(`API error:`, apiError.message);
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* couldn't hit the API for "${song.title}". Server's actin' up! 😡
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      // Send the audio file
      try {
        const doc = {
          audio: {
            url: filePath,
          },
          mimetype: 'audio/mpeg',
          ptt: false,
          fileName: `${safeTitle}.mp3`,
        };
        await Matrix.sendMessage(m.from, doc, { quoted: m });

        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Deleted temp file: ${filePath}`);
            }
          } catch (cleanupErr) {
            console.error('Error during file cleanup:', cleanupErr);
          }
        }, 5000);
      } catch (sendError) {
        console.error(`Failed to send audio:`, sendError.message);
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* can't play "${song.title}". Failed to send audio 😣
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }

      await Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ *${song.title}* dropped by *NAPPIER-XMD*! Blast it! 🎶
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });
    }
  } catch (error) {
    console.error(`❌ Play error: ${error.message}`);
    await Matrix.sendMessage(m.from, {
      text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* hit a snag, fam! Try again or pick a better track! 😈
◈━━━━━━━━━━━━━━━━◈`,
    }, { quoted: m });
  }
};

export default play;