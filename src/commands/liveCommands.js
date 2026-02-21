const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');

const gamesCommand = new SlashCommandBuilder()
  .setName('games')
  .setDescription('List all games that have pros or placements (live from site).');

const latestCommand = new SlashCommandBuilder()
  .setName('latest')
  .setDescription('Show the single latest news article from the website.');

const topPlacementsCommand = new SlashCommandBuilder()
  .setName('top_placements')
  .setDescription('Top 3 most recent tournament placements (live).');

const randomProCommand = new SlashCommandBuilder()
  .setName('random_pro')
  .setDescription('Pick a random pro from the full roster (live from site).');

async function handleGames(interaction) {
  try {
    const db = getFirestoreInstance();
    const [teamsSnap, placementsSnap, ambassadorsSnap] = await Promise.all([
      db.collection('teams').get(),
      db.collection('placements').get(),
      db.collection('ambassadors').get()
    ]);
    const games = new Set();
    (teamsSnap.docs || []).forEach(doc => {
      const t = convertFirestoreData(doc);
      if (t.players && Array.isArray(t.players)) {
        t.players.forEach(p => { if (p.game) games.add(p.game); });
      }
    });
    (placementsSnap.docs || []).forEach(doc => {
      const p = convertFirestoreData(doc);
      if (p.game) games.add(p.game);
    });
    (ambassadorsSnap.docs || []).forEach(doc => {
      const a = convertFirestoreData(doc);
      if (a.game) games.add(a.game);
    });
    const list = [...games].sort((a, b) => a.localeCompare(b));
    const embed = new EmbedBuilder()
      .setTitle('🎮 Games (live from website)')
      .setDescription(list.length ? list.map(g => `• **${g}**`).join('\n') : 'No games found.')
      .setColor(0x1e90ff)
      .setTimestamp()
      .setFooter({ text: `${list.length} game(s)` });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('games error:', error);
    await interaction.editReply('❌ Failed to fetch games.');
  }
}

async function handleLatest(interaction) {
  try {
    const db = getFirestoreInstance();
    const snap = await db.collection('newsArticles').orderBy('date', 'desc').limit(1).get();
    const articles = (snap.docs || []).map(doc => convertFirestoreData(doc));
    if (!articles.length) {
      await interaction.editReply('❌ No news articles found.');
      return;
    }
    const a = articles[0];
    const embed = new EmbedBuilder()
      .setTitle(a.title)
      .setDescription((a.description || 'No summary.').substring(0, 4096))
      .setColor(0x00ff7f)
      .setTimestamp(a.date ? new Date(a.date) : undefined)
      .setFooter({ text: 'Latest from Void eSports News' });
    setThumbnailIfValid(embed, a.image);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('latest error:', error);
    await interaction.editReply('❌ Failed to fetch latest news.');
  }
}

async function handleTopPlacements(interaction) {
  try {
    const db = getFirestoreInstance();
    const snap = await db.collection('placements').orderBy('createdAt', 'desc').limit(3).get();
    const placements = (snap.docs || []).map(doc => convertFirestoreData(doc));
    if (!placements.length) {
      await interaction.editReply('❌ No placements found.');
      return;
    }
    const lines = placements.map((p, i) => {
      const proNames = (p.players && Array.isArray(p.players) && p.players.length) ? p.players.join(', ') : (p.proName || p.playerName || 'N/A');
      return `${i + 1}. **${p.tournament}** — ${p.position}\n   Pro: ${proNames} • Team: ${p.team || 'N/A'}${p.prize ? ` • ${p.prize}` : ''}`;
    });
    const embed = new EmbedBuilder()
      .setTitle('🏆 Top 3 Recent Placements')
      .setDescription(lines.join('\n\n'))
      .setColor(0x1e90ff)
      .setTimestamp()
      .setFooter({ text: 'Live from Void website' });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('top_placements error:', error);
    await interaction.editReply('❌ Failed to fetch placements.');
  }
}

async function handleRandomPro(interaction) {
  try {
    const db = getFirestoreInstance();
    const allPros = [];
    const teamsSnap = await db.collection('teams').get();
    (teamsSnap.docs || []).forEach(doc => {
      const team = convertFirestoreData(doc);
      if (team.players && Array.isArray(team.players)) {
        team.players.forEach(p => allPros.push({ ...p, teamName: team.name, source: 'team' }));
      }
    });
    const ambSnap = await db.collection('ambassadors').get();
    (ambSnap.docs || []).forEach(doc => {
      const a = convertFirestoreData(doc);
      allPros.push({ name: a.name, role: a.role, game: a.game, teamName: 'Ambassador', source: 'ambassador', socialLinks: a.socialLinks, achievements: a.achievements });
    });
    if (!allPros.length) {
      await interaction.editReply('❌ No pros in the database.');
      return;
    }
    const pro = allPros[Math.floor(Math.random() * allPros.length)];
    const embed = new EmbedBuilder()
      .setTitle(`🎲 Random Pro: ${pro.name}`)
      .addFields(
        { name: 'Game', value: pro.game || 'N/A', inline: true },
        { name: 'Role', value: pro.role || 'N/A', inline: true },
        { name: 'Team', value: pro.teamName || 'N/A', inline: true }
      )
      .setColor(0x8a2be2)
      .setTimestamp()
      .setFooter({ text: 'Live from Void website' });
    if (pro.achievements && pro.achievements.length) {
      embed.addFields({ name: 'Achievements', value: pro.achievements.slice(0, 5).join('\n') });
    }
    const links = pro.socialLinks || {};
    const socials = [links.twitter, links.twitch, links.youtube, links.instagram].filter(Boolean).map(u => `[Link](${u})`);
    if (socials.length) embed.addFields({ name: 'Socials', value: socials.join(' • ') });
    setThumbnailIfValid(embed, pro.image);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('random_pro error:', error);
    await interaction.editReply('❌ Failed to pick random pro.');
  }
}

module.exports = {
  gamesCommand,
  latestCommand,
  topPlacementsCommand,
  randomProCommand,
  handleGames,
  handleLatest,
  handleTopPlacements,
  handleRandomPro
};
