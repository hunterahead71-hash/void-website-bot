const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');

const teamsCommand = new SlashCommandBuilder()
  .setName('teams')
  .setDescription('List all teams with basic info.');

const teamInfoCommand = new SlashCommandBuilder()
  .setName('team_info')
  .setDescription('Get detailed roster and info for a specific team.')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Team name (partial match works)')
      .setRequired(true)
  );

async function handleTeams(interaction) {
  try {
    const db = getFirestoreInstance();
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map(doc => convertFirestoreData(doc));

    if (!teams || teams.length === 0) {
      await interaction.editReply('❌ No teams found in the database.');
      return;
    }

    // Sort by name
    teams.sort((a, b) => a.name.localeCompare(b.name));

    const lines = teams.map(t => {
      const game = t.players && t.players.length > 0 ? t.players[0].game || 'Game N/A' : 'Game N/A';
      const playerCount = t.players ? t.players.length : 0;
      return `• **${t.name}** – ${game} – ${playerCount} player${playerCount !== 1 ? 's' : ''}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 Void eSports Teams')
      .setDescription(lines.join('\n'))
      .setColor(0x00bfff)
      .setTimestamp()
      .setFooter({ text: `Total: ${teams.length} teams • Live data from Void Website` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('teams error:', error);
    await interaction.editReply('❌ Failed to fetch teams. Make sure Firebase is configured correctly.');
  }
}

async function handleTeamInfo(interaction) {
  const name = interaction.options.getString('name');
  try {
    const db = getFirestoreInstance();
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map(doc => convertFirestoreData(doc));

    // Find team (case-insensitive partial match)
    const team = teams.find(t => 
      t.name && t.name.toLowerCase().includes(name.toLowerCase())
    );

    if (!team) {
      await interaction.editReply(`❌ Team **${name}** not found. Try using \`/teams\` to see all available teams.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(team.name)
      .setDescription(team.description || 'No description provided.')
      .setColor(0x00bfff)
      .setTimestamp()
      .setFooter({ text: 'Live data from Void Website' });

    // Add achievements if available
    if (team.achievements && Array.isArray(team.achievements) && team.achievements.length) {
      const achievementsText = team.achievements.slice(0, 10).join('\n');
      embed.addFields({
        name: 'Achievements',
        value: achievementsText.length > 1024 ? achievementsText.substring(0, 1021) + '...' : achievementsText
      });
    }

    // Add roster
    if (team.players && Array.isArray(team.players) && team.players.length) {
      const rosterLines = team.players
        .map(p => `• **${p.name}** – ${p.role || 'Role N/A'} (${p.game || 'Game N/A'})`)
        .join('\n');
      
      embed.addFields({ 
        name: `Roster (${team.players.length})`, 
        value: rosterLines.length > 1024 ? rosterLines.substring(0, 1021) + '...' : rosterLines 
      });

      // Determine primary game from players
      const games = [...new Set(team.players.map(p => p.game).filter(Boolean))];
      if (games.length > 0) {
        embed.addFields({ name: 'Games', value: games.join(', '), inline: true });
      }
    } else {
      embed.addFields({ name: 'Roster', value: 'No players found for this team.' });
    }

    setThumbnailIfValid(embed, team.image);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('team_info error:', error);
    await interaction.editReply('❌ Failed to fetch team information. Make sure Firebase is configured correctly.');
  }
}

module.exports = {
  teamsCommand,
  teamInfoCommand,
  handleTeams,
  handleTeamInfo
};
