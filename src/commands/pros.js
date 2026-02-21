const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');

const prosTotalCommand = new SlashCommandBuilder()
  .setName('pros_total')
  .setDescription('Show total number of pros (players) and teams.');

const prosListCommand = new SlashCommandBuilder()
  .setName('pros_list')
  .setDescription('List pros, optionally filtered by game.')
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Filter by game (e.g. Valorant, CS2)')
      .setRequired(false)
  );

const proInfoCommand = new SlashCommandBuilder()
  .setName('pro_info')
  .setDescription('Get detailed pro info by username (e.g. Void Sails). Shows stats, social links, achievements.')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Username as per the pro list (e.g. Void Sails)')
      .setRequired(true)
  );

const listProsCommand = new SlashCommandBuilder()
  .setName('list_pros')
  .setDescription('List all pros for a specific game only (e.g. Fortnite).')
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Game name (e.g. Fortnite, Valorant, CS2)')
      .setRequired(true)
  );

async function handleProsTotal(interaction) {
  try {
    const db = getFirestoreInstance();
    
    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map(doc => convertFirestoreData(doc));
    
    // Count total pros across all teams
    let totalPros = 0;
    teams.forEach(team => {
      if (team.players && Array.isArray(team.players)) {
        totalPros += team.players.length;
      }
    });

    // Also check ambassadors collection
    const ambassadorsSnapshot = await db.collection('ambassadors').get();
    const ambassadorsCount = ambassadorsSnapshot.size;

    const totalAllPros = totalPros + ambassadorsCount;

    const embed = new EmbedBuilder()
      .setTitle('📊 Void eSports Statistics')
      .setDescription(`**Total Pros:** ${totalAllPros}\n**From Teams:** ${totalPros}\n**Ambassadors:** ${ambassadorsCount}\n**Total Teams:** ${teams.length}`)
      .setColor(0x8a2be2)
      .setTimestamp()
      .setFooter({ text: 'Live data from Void Website' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('pros_total error:', error);
    await interaction.editReply('❌ Failed to fetch pros data. Make sure Firebase is configured correctly.');
  }
}

async function handleProsList(interaction) {
  const gameFilter = interaction.options.getString('game');
  try {
    const db = getFirestoreInstance();
    const allPros = [];

    // Get pros from teams
    const teamsSnapshot = await db.collection('teams').get();
    teamsSnapshot.docs.forEach(doc => {
      const team = convertFirestoreData(doc);
      if (team.players && Array.isArray(team.players)) {
        team.players.forEach(player => {
          if (!gameFilter || !player.game || player.game.toLowerCase().includes(gameFilter.toLowerCase())) {
            allPros.push({
              ...player,
              teamName: team.name,
              source: 'team'
            });
          }
        });
      }
    });

    // Get ambassadors
    const ambassadorsSnapshot = await db.collection('ambassadors').get();
    ambassadorsSnapshot.docs.forEach(doc => {
      const ambassador = convertFirestoreData(doc);
      if (!gameFilter || !ambassador.game || ambassador.game.toLowerCase().includes(gameFilter.toLowerCase())) {
        allPros.push({
          name: ambassador.name,
          role: ambassador.role,
          game: ambassador.game,
          image: ambassador.image,
          achievements: ambassador.achievements,
          socialLinks: ambassador.socialLinks,
          teamName: 'Ambassador',
          source: 'ambassador'
        });
      }
    });

    if (allPros.length === 0) {
      const filterMsg = gameFilter ? ` for game "${gameFilter}"` : '';
      await interaction.editReply(`❌ No pros found${filterMsg}.`);
      return;
    }

    // Sort and limit
    const sortedPros = allPros
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 25);

    const lines = sortedPros.map(p => {
      const role = p.role || 'Role N/A';
      const game = p.game || 'Game N/A';
      return `• **${p.name}** (${role}) – ${game} – ${p.teamName || 'No team'}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`👥 Void Pros List${gameFilter ? ` - ${gameFilter}` : ''}`)
      .setDescription(lines.join('\n'))
      .setColor(0x8a2be2)
      .setFooter({ 
        text: `Showing ${sortedPros.length} of ${allPros.length} pros${sortedPros.length === 25 ? ' (limited to 25)' : ''}` 
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('pros_list error:', error);
    await interaction.editReply('❌ Failed to fetch pros list. Make sure Firebase is configured correctly.');
  }
}

async function handleProInfo(interaction) {
  const name = interaction.options.getString('name');
  try {
    const db = getFirestoreInstance();
    let foundPro = null;
    let teamName = 'No team';
    let source = 'unknown';

    // Search in teams
    const teamsSnapshot = await db.collection('teams').get();
    for (const doc of teamsSnapshot.docs) {
      const team = convertFirestoreData(doc);
      if (team.players && Array.isArray(team.players)) {
        const player = team.players.find(p => 
          p.name && p.name.toLowerCase().includes(name.toLowerCase())
        );
        if (player) {
          foundPro = player;
          teamName = team.name;
          source = 'team';
          break;
        }
      }
    }

    // If not found, search ambassadors
    if (!foundPro) {
      const ambassadorsSnapshot = await db.collection('ambassadors').get();
      for (const doc of ambassadorsSnapshot.docs) {
        const ambassador = convertFirestoreData(doc);
        if (ambassador.name && ambassador.name.toLowerCase().includes(name.toLowerCase())) {
          foundPro = ambassador;
          teamName = 'Ambassador';
          source = 'ambassador';
          break;
        }
      }
    }

    if (!foundPro) {
      await interaction.editReply(`❌ Could not find a pro matching **${name}**. Try using \`/pros_list\` to see all available pros.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(foundPro.name)
      .setDescription(foundPro.description || foundPro.bio || 'No bio available.')
      .addFields(
        { name: 'Team', value: teamName, inline: true },
        { name: 'Game', value: foundPro.game || 'N/A', inline: true },
        { name: 'Role', value: foundPro.role || 'N/A', inline: true },
        { name: 'Type', value: source === 'team' ? 'Team Player' : 'Ambassador', inline: true }
      )
      .setColor(0x8a2be2)
      .setTimestamp()
      .setFooter({ text: 'Live data from Void Website' });

    if (foundPro.achievements && Array.isArray(foundPro.achievements) && foundPro.achievements.length) {
      const achievementsText = foundPro.achievements.slice(0, 10).join('\n');
      embed.addFields({
        name: 'Achievements',
        value: achievementsText.length > 1024 ? achievementsText.substring(0, 1021) + '...' : achievementsText
      });
    }

    if (foundPro.stats && Array.isArray(foundPro.stats) && foundPro.stats.length) {
      const statLines = foundPro.stats
        .slice(0, 10)
        .map(s => `${s.label || 'Stat'}: ${s.value || 'N/A'}`)
        .join('\n');
      if (statLines.length > 0) {
        embed.addFields({ 
          name: 'Key Stats', 
          value: statLines.length > 1024 ? statLines.substring(0, 1021) + '...' : statLines 
        });
      }
    }

    const socials = [];
    const socialLinks = foundPro.socialLinks || {};
    if (socialLinks.twitter) socials.push(`[Twitter](${socialLinks.twitter})`);
    if (socialLinks.twitch) socials.push(`[Twitch](${socialLinks.twitch})`);
    if (socialLinks.youtube) socials.push(`[YouTube](${socialLinks.youtube})`);
    if (socialLinks.instagram) socials.push(`[Instagram](${socialLinks.instagram})`);
    if (socialLinks.tiktok) socials.push(`[TikTok](${socialLinks.tiktok})`);

    if (socials.length) {
      embed.addFields({ name: 'Socials', value: socials.join(' • ') });
    }

    setThumbnailIfValid(embed, foundPro.image);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('pro_info error:', error);
    await interaction.editReply('❌ Failed to fetch pro information. Make sure Firebase is configured correctly.');
  }
}

async function handleListPros(interaction) {
  const gameFilter = interaction.options.getString('game');
  try {
    const db = getFirestoreInstance();
    const allPros = [];
    const teamsSnapshot = await db.collection('teams').get();
    teamsSnapshot.docs.forEach(doc => {
      const team = convertFirestoreData(doc);
      if (team.players && Array.isArray(team.players)) {
        team.players.forEach(player => {
          if (player.game && player.game.toLowerCase().includes(gameFilter.toLowerCase())) {
            allPros.push({ ...player, teamName: team.name, source: 'team' });
          }
        });
      }
    });
    const ambassadorsSnapshot = await db.collection('ambassadors').get();
    ambassadorsSnapshot.docs.forEach(doc => {
      const ambassador = convertFirestoreData(doc);
      if (ambassador.game && ambassador.game.toLowerCase().includes(gameFilter.toLowerCase())) {
        allPros.push({
          name: ambassador.name,
          role: ambassador.role,
          game: ambassador.game,
          teamName: 'Ambassador',
          source: 'ambassador'
        });
      }
    });
    if (allPros.length === 0) {
      await interaction.editReply(`❌ No pros found for **${gameFilter}**.`);
      return;
    }
    const sortedPros = allPros.sort((a, b) => (a.name || '').localeCompare(b.name || '')).slice(0, 25);
    const lines = sortedPros.map(p => `• **${p.name}** (${p.role || '—'}) – ${p.teamName || '—'}`);
    const embed = new EmbedBuilder()
      .setTitle(`👥 ${gameFilter} Pros`)
      .setDescription(lines.join('\n'))
      .setColor(0x8a2be2)
      .setFooter({ text: `Showing ${sortedPros.length} of ${allPros.length}` })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('list_pros error:', error);
    await interaction.editReply('❌ Failed to fetch pros list.');
  }
}

module.exports = {
  prosTotalCommand,
  prosListCommand,
  proInfoCommand,
  listProsCommand,
  handleProsTotal,
  handleProsList,
  handleProInfo,
  handleListPros
};
