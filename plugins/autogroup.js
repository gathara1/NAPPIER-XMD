import cron from "node-cron";
import moment from "moment-timezone";
import config from "../config.cjs";

let scheduledTasks = {};

const groupSetting = async (m, Matrix) => {
  try {
    const prefix = config.Prefix || config.PREFIX || ".";
    const cmd = m.body?.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const text = m.body.slice(prefix.length + cmd.length).trim();

    const validCommands = ["group"];
    if (!validCommands.includes(cmd)) return;

    if (!m.isGroup) {
      return Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ Yo, dumbass, *NAPPIER-XMD* only runs this in groups! Get with it! 😤🏠
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
│❒ *NAPPIER-XMD* ain't got admin juice to run this! Promote me, scrub! 😡🔧
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });
    }

    if (!senderAdmin) {
      return Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ You ain't no admin, fam! Step up or shut up! 😎🔪
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });
    }

    const args = text.split(/\s+/);
    if (args.length < 1) {
      return Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ Yo, braindead, tell *NAPPIER-XMD* what to do! Use *open*/*unmute* or *close*/*mute* [time]! 😆
│❒ Ex: *${prefix}group open* or *${prefix}group close 16:00*
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });
    }

    let groupSetting = args[0].toLowerCase();
    const time = args.slice(1).join(" ");

    // Map aliases
    if (groupSetting === "mute") groupSetting = "close";
    if (groupSetting === "unmute") groupSetting = "open";

    // Handle immediate setting
    if (!time) {
      if (groupSetting === "close") {
        await Matrix.groupSettingUpdate(m.from, "announcement");
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* locked this group down tight! No chatter, fam! 🔒💥
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      } else if (groupSetting === "open") {
        await Matrix.groupSettingUpdate(m.from, "not_announcement");
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* flung the gates open! Talk your shit, fam! 🗣️🔥
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      } else {
        return Matrix.sendMessage(m.from, {
          text: `◈━━━━━━━━━━━━━━━━◈
│❒ What's this trash? *NAPPIER-XMD* only takes *open*/*unmute* or *close*/*mute*, clown! 🤡
│❒ Ex: *${prefix}group open* or *${prefix}group close 16:00*
◈━━━━━━━━━━━━━━━━◈`,
        }, { quoted: m });
      }
    }

    // Validate time format
    if (!/^\d{1,2}:\d{2}\s*$/i.test(time)) {
      return Matrix.sendMessage(m.from, {
        text: `◈━━━━━━━━━━━━━━━━◈
│❒ That time's garbage, fam! Use HH:mm format, like *16:00*! 😣
│❒ Ex: *${prefix}group open 16:00*
◈━━━━━━━━━━━━━━━━◈`,
      }, { quoted: m });
    }

    // Convert time to cron (24-hour)
    const [hour, minute] = moment(time, ["H:mm", "HH:mm"]).format("HH:mm").split(":").map(Number);
    const cronTime = `${minute} ${hour} * * *`;

    console.log(`Scheduling ${groupSetting} at ${cronTime} EAT`);

    // Clear existing task
    if (scheduledTasks[m.from]) {
      scheduledTasks[m.from].stop();
      delete scheduledTasks[m.from];
    }

    // Schedule new task
    scheduledTasks[m.from] = cron.schedule(
      cronTime,
      async () => {
        try {
          console.log(`Executing ${groupSetting} at ${moment().format("HH:mm")} EAT`);
          if (groupSetting === "close") {
            await Matrix.groupSettingUpdate(m.from, "announcement");
            await Matrix.sendMessage(m.from, {
              text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* shut this group down! Quiet time, fam! 🔒💥
◈━━━━━━━━━━━━━━━━◈`,
            });
          } else if (groupSetting === "open") {
            await Matrix.groupSettingUpdate(m.from, "not_announcement");
            await Matrix.sendMessage(m.from, {
              text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* opened the floodgates! Let's get loud, fam! 🗣️🔥
◈━━━━━━━━━━━━━━━━◈`,
            });
          }
        } catch (err) {
          console.error("Scheduled task error:", err);
          await Matrix.sendMessage(m.from, {
            text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* fucked up the schedule, fam! Somethin's busted! 😈
◈━━━━━━━━━━━━━━━━◈`,
          });
        }
      },
      { timezone: "Africa/Nairobi" }
    );

    await Matrix.sendMessage(m.from, {
      text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* set to ${groupSetting === "close" ? "lock" : "open"} *${groupMetadata.subject}* at *${time}* EAT! You're runnin' this, boss! 💪🔥
◈━━━━━━━━━━━━━━━━◈`,
    }, { quoted: m });
  } catch (error) {
    console.error(`❌ Group error: ${error.message}`);
    await Matrix.sendMessage(m.from, {
      text: `◈━━━━━━━━━━━━━━━━◈
│❒ *NAPPIER-XMD* screwed up somewhere, fam! Try that again! 😈
◈━━━━━━━━━━━━━━━━◈`,
    }, { quoted: m });
  }
};

export default groupSetting;