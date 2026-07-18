import axios from 'axios';
import pkg, { prepareWAMessageMedia } from 'baileys-pro';
const { generateWAMessageFromContent, proto } = pkg;
import config from '../config.cjs';

const Lyrics = async (m, Matrix) => {
  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  const validCommands = ['lyrics', 'lyric'];

  if (validCommands.includes(cmd)) {
    if (!text) return m.reply(`◈━━━━━━━━━━━━━━━━◈
│❒ Hello *_${m.pushName}_,*
│❒ Here's Example Usage: _.lyrics Dynasty MIIA._
◈━━━━━━━━━━━━━━━━◈`);

    try {
      await m.React('🕘');
      await m.reply(`◈━━━━━━━━━━━━━━━━◈
│❒ A moment, *NAPPIER-XMD* is generating your lyrics request...
◈━━━━━━━━━━━━━━━━◈`);

      const query = text.trim();
      const apiUrl = `https://api.giftedtech.web.id/api/search/lyrics?apikey=gifted_api_se5dccy&query=${encodeURIComponent(query)}`;
      const response = await axios.get(apiUrl);
      const result = response.data;

      if (result && result.success && result.result) {
        const { title, artist, link, image, lyrics } = result.result;

        const formattedMessage = `◈━━━━━━━━━━━━━━━━◈
│❒ 🎵 *${title}* by *${artist}*
│❒ 
│❒ ${lyrics}
│❒ 
│❒ 🔗 ${link}
◈━━━━━━━━━━━━━━━━◈`;

        let buttons = [
          {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 ᴄᴏᴘʏ ʟʏʀɪᴄs",
              id: "copy_code",
              copy_code: lyrics
            })
          },
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "Follow our Channel",
              url: `https://whatsapp.com/channel/0029VbClDVLLNSa8W94oEk2t`
            })
          },
          {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "ᴍᴀɪɴ ᴍᴇɴᴜ",
              id: ".menu"
            })
          }
        ];

        let msg = generateWAMessageFromContent(m.from, {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2
              },
              interactiveMessage: proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({
                  text: formattedMessage
                }),
                footer: proto.Message.InteractiveMessage.Footer.create({
                  text: "> *© ᴘᴏᴡᴇʀᴇᴅ ʙʏ NAPPIER-XMD*"
                }),
                header: proto.Message.InteractiveMessage.Header.create({
                  title: "",
                  subtitle: "",
                  hasMediaAttachment: true,
                  ...(await prepareWAMessageMedia({ image: { url: image } }, { upload: Matrix.waUploadToServer }))
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                  buttons: buttons
                })
              })
            }
          }
        }, {});

        await Matrix.relayMessage(msg.key.remoteJid, msg.message, {
          messageId: msg.key.id
        });

        await m.React('✅');
      } else {
        throw new Error('Invalid response from the Lyrics API.');
      }
    } catch (error) {
      console.error('Error getting lyrics:', error.message);
      m.reply(`◈━━━━━━━━━━━━━━━━◈
│❒ Error getting lyrics. Please try a different song or check your query format.
◈━━━━━━━━━━━━━━━━◈`);
      await m.React('❌');
    }
  }
};

export default Lyrics;