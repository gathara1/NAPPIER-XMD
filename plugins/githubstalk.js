import axios from "axios";
import config from "../config.cjs";

const githubStalk = async (m, Matrix) => {
  try {
    const prefix = config.Prefix || config.PREFIX || ".";
    const cmd = m.body?.startsWith(prefix) ? m.body.slice(prefix.length).split(" ")[0].toLowerCase() : "";
    const text = m.body.slice(prefix.length + cmd.length).trim();
    const args = text.split(" ");

    if (!["githubstalk", "ghstalk"].includes(cmd)) return;

    if (!args[0]) {
      return Matrix.sendMessage(m.from, {
        text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ Yo, dumbass, gimme a *GitHub username* to stalk! Don't waste *NAPPIER-XMD*'s time! 😤💾
│❒ Ex: *${prefix}ghstalk octocat*
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
      }, { quoted: m });
    }

    const username = args[0].replace("@", "");
    await Matrix.sendMessage(m.from, { react: { text: "⏳", key: m.key } });

    // GitHub API headers (optional token for higher rate limits)
    const headers = {
      Accept: "application/vnd.github.v3+json",
      ...(config.GITHUB_TOKEN ? { Authorization: `token ${config.GITHUB_TOKEN}` } : {}),
    };

    // Fetch user data
    const githubResponse = await axios.get(`https://api.github.com/users/${username}`, { headers });
    const userData = githubResponse.data;

    if (githubResponse.status !== 200 || !userData.login) {
      await Matrix.sendMessage(m.from, { react: { text: "❌", key: m.key } });
      return Matrix.sendMessage(m.from, {
        text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ *NAPPIER-XMD* can't find that GitHub user, fam! Check the username, clown! 🤡
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
      }, { quoted: m });
    }

    // Construct user profile response
    let responseMessage = `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ *NAPPIER-XMD* GitHub Stalk 🖥️
│❒ 👤 *Username*: @${userData.login}
│❒ 📛 *Name*: ${userData.name || "N/A"}
│❒ 📝 *Bio*: ${userData.bio || "N/A"}
│❒ 🌍 *Location*: ${userData.location || "N/A"}
│❒ 💼 *Company*: ${userData.company || "N/A"}
│❒ 🌐 *Blog*: ${userData.blog || "N/A"}
│❒ 📧 *Email*: ${userData.email || "N/A"}
│❒ 📊 *Public Repos*: ${userData.public_repos || 0}
│❒ 📜 *Public Gists*: ${userData.public_gists || 0}
│❒ 👥 *Followers*: ${userData.followers || 0}
│❒ ➡️ *Following*: ${userData.following || 0}
│❒ 🕒 *Created*: ${new Date(userData.created_at).toLocaleDateString()}
│❒ 🔗 *Profile*: ${userData.html_url}`;

    // Fetch top 5 starred repos
    const githubReposResponse = await axios.get(`https://api.github.com/users/${username}/repos?per_page=5&sort=stars&direction=desc`, { headers });
    const reposData = githubReposResponse.data;

    if (reposData.length > 0) {
      const reposList = reposData.map((repo) => {
        return `│❒ 📂 *${repo.name}*
│❒   🔗 ${repo.html_url}
│❒   📝 ${repo.description || "No description"}
│❒   ⭐ *Stars*: ${repo.stargazers_count || 0}
│❒   🍴 *Forks*: ${repo.forks_count || 0}`;
      });
      responseMessage += `\n\n│❒ 📚 *Top Starred Repos*\n${reposList.join("\n")}`;
    } else {
      responseMessage += `\n\n│❒ 📚 *Top Starred Repos*: None found, fam! 😣`;
    }

    responseMessage += `\n◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`;

    // Send with avatar
    await Matrix.sendMessage(m.from, {
      image: { url: userData.avatar_url },
      caption: responseMessage,
    }, { quoted: m });

    await Matrix.sendMessage(m.from, { react: { text: "✅", key: m.key } });
  } catch (error) {
    console.error(`❌ GitHubStalk error: ${error.message}`);
    await Matrix.sendMessage(m.from, { react: { text: "❌", key: m.key } });
    await Matrix.sendMessage(m.from, {
      text: `◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈
│❒ *NAPPIER-XMD* fucked up stalkin' that user, fam! Try again or check the name! 😈
◈┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅◈`,
    }, { quoted: m });
  }
};

export default githubStalk;