const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, firebaseInfo } = require('../firebaseClient');

const uptimeCommand = new SlashCommandBuilder()
  .setName('uptime')
  .setDescription('Show bot uptime and statistics.');

const statusCommand = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Check if bot is connected to website database and show connection status.');

const statsCommand = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Show comprehensive Void eSports statistics.');

const pingCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency and response time.');

// Store bot start time
const botStartTime = Date.now();

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

async function handleUptime(interaction) {
  await interaction.deferReply();

  const uptime = Date.now() - botStartTime;
  const processUptime = process.uptime();

  const embed = new EmbedBuilder()
    .setTitle('⏱️ Bot Uptime')
    .addFields(
      { name: 'Bot Uptime', value: formatUptime(uptime), inline: true },
      { name: 'Process Uptime', value: formatUptime(processUptime * 1000), inline: true },
      { name: 'Started', value: new Date(botStartTime).toLocaleString(), inline: false }
    )
    .setColor(0x00ff00)
    .setTimestamp()
    .setFooter({ text: 'Void Website Bot' });

  await interaction.editReply({ embeds: [embed] });
}

async function handleStatus(interaction) {
  await interaction.deferReply();

  const info = firebaseInfo();
  const statusChecks = {
    discord: '✅ Connected',
    firebase: (info.mode === 'client-website-config' || info.mode.startsWith('admin')) ? '✅ Connected' : `⚠️ ${info.mode}`,
    project: info.projectId || 'N/A',
    dataSource: info.mode === 'client-website-config' ? 'Void website (live)' : info.mode,
    collections: 'Not checked'
  };

  try {
    const db = getFirestoreInstance();
    const collectionsToTest = ['teams', 'products', 'newsArticles', 'placements', 'ambassadors'];
    const results = await Promise.all(
      collectionsToTest.map(async c => {
        try {
          await db.collection(c).limit(1).get();
          return `✅ ${c}`;
        } catch (e) {
          return `❌ ${c}: ${e.message}`;
        }
      })
    );
    statusChecks.collections = results.join('\n');
  } catch (error) {
    statusChecks.collections = `❌ ${error.message}`;
  }

  const embed = new EmbedBuilder()
    .setTitle('🔌 Connection Status')
    .setDescription('Real-time connection to Void website Firebase')
    .addFields(
      { name: 'Discord', value: statusChecks.discord, inline: true },
      { name: 'Firebase', value: statusChecks.firebase, inline: true },
      { name: 'Project', value: statusChecks.project, inline: true },
      { name: 'Data source', value: statusChecks.dataSource, inline: false },
      { name: 'Collections', value: statusChecks.collections, inline: false }
    )
    .setColor(statusChecks.collections.includes('✅') ? 0x00ff00 : 0xff0000)
    .setTimestamp()
    .setFooter({ text: 'Live status check' });

  await interaction.editReply({ embeds: [embed] });
}

async function handleStats(interaction) {
  await interaction.deferReply();

  try {
    const db = getFirestoreInstance();
    
    // Fetch all data
    const [teamsSnapshot, productsSnapshot, newsSnapshot, placementsSnapshot, ambassadorsSnapshot] = await Promise.all([
      db.collection('teams').get(),
      db.collection('products').get(),
      db.collection('newsArticles').get(),
      db.collection('placements').get(),
      db.collection('ambassadors').get()
    ]);

    const teams = teamsSnapshot.docs;
    const products = productsSnapshot.docs;
    const news = newsSnapshot.docs;
    const placements = placementsSnapshot.docs;
    const ambassadors = ambassadorsSnapshot.docs;

    // Count total pros
    let totalPros = 0;
    teams.forEach(teamDoc => {
      const team = teamDoc.data();
      if (team.players && Array.isArray(team.players)) {
        totalPros += team.players.length;
      }
    });
    totalPros += ambassadors.size;

    const embed = new EmbedBuilder()
      .setTitle('📊 Void eSports Statistics')
      .setDescription('Comprehensive statistics from the Void website')
      .addFields(
        { name: 'Teams', value: teams.size.toString(), inline: true },
        { name: 'Total Pros', value: totalPros.toString(), inline: true },
        { name: 'Ambassadors', value: ambassadors.size.toString(), inline: true },
        { name: 'Products', value: products.size.toString(), inline: true },
        { name: 'News Articles', value: news.size.toString(), inline: true },
        { name: 'Placements', value: placements.size.toString(), inline: true }
      )
      .setColor(0x8a2be2)
      .setTimestamp()
      .setFooter({ text: 'Live data from Void Website' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('stats error:', error);
    await interaction.editReply('❌ Failed to fetch statistics. Make sure Firebase is configured correctly.');
  }
}

async function handlePing(interaction) {
  const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
  const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
  const wsPing = interaction.client.ws.ping;

  const embed = new EmbedBuilder()
    .setTitle('🏓 Pong!')
    .addFields(
      { name: 'Roundtrip Latency', value: `${roundtrip}ms`, inline: true },
      { name: 'WebSocket Ping', value: `${wsPing}ms`, inline: true },
      { name: 'Status', value: roundtrip < 100 ? '🟢 Excellent' : roundtrip < 200 ? '🟡 Good' : '🔴 Slow', inline: true }
    )
    .setColor(0x00ff00)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

module.exports = {
  uptimeCommand,
  statusCommand,
  statsCommand,
  pingCommand,
  handleUptime,
  handleStatus,
  handleStats,
  handlePing
};
