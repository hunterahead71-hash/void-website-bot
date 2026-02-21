const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');
const { buildPaginationRow } = require('../utils/pagination');
const { isOperations } = require('./pros');

const teamsCommand = new SlashCommandBuilder()
  .setName('teams')
  .setDescription('List all teams. Use arrows to scroll pages.');

const teamInfoCommand = new SlashCommandBuilder()
  .setName('team_info')
  .setDescription('Get detailed roster and info for a specific team.')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Team name (partial match works)')
      .setRequired(true)
  );

const PER_PAGE = 10;

async function buildTeamsPage(interaction, page) {
  const db = getFirestoreInstance();
  const teamsSnapshot = await db.collection('teams').get();
  const teams = teamsSnapshot.docs.map(doc => convertFirestoreData(doc)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (!teams.length) {
    return { content: '❌ No teams found.', embeds: [], components: [] };
  }
  const totalPages = Math.ceil(teams.length / PER_PAGE);
  const p = Math.max(0, Math.min(page, totalPages - 1));
  const slice = teams.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
  const lines = slice.map(t => {
    const game = t.players?.length ? (t.players[0].game || '—') : '—';
    const count = t.players ? t.players.length : 0;
    const opsCount = t.players ? t.players.filter(p => isOperations(p, t.name)).length : 0;
    const prosCount = count - opsCount;
    return `• **${t.name}** — ${game} · ${prosCount} pro${prosCount !== 1 ? 's' : ''} · ${opsCount} ops`;
  });
  const embed = new EmbedBuilder()
    .setTitle('🏆 Void eSports Teams')
    .setDescription(lines.join('\n'))
    .setColor(0x00bfff)
    .setFooter({ text: `Page ${p + 1}/${totalPages} · ${teams.length} teams · Live from website` })
    .setTimestamp();
  const components = [];
  const pagRow = buildPaginationRow('teams', p, totalPages, '');
  if (pagRow) components.push(pagRow);
  return { embeds: [embed], components };
}

async function handleTeams(interaction, page = 0) {
  try {
    const payload = await buildTeamsPage(interaction, page);
    if (payload.content) {
      await interaction.editReply(payload).catch(() => {});
      return;
    }
    await interaction.editReply(payload).catch(() => {});
  } catch (error) {
    console.error('teams error:', error);
    await interaction.editReply('❌ Failed to fetch teams.').catch(() => {});
  }
}

async function handleTeamsPaginated(interaction, page) {
  try {
    const payload = await buildTeamsPage(interaction, page);
    await interaction.update(payload).catch(() => {});
  } catch (error) {
    await interaction.update({ content: '❌ Error.', embeds: [], components: [] }).catch(() => {});
  }
}

async function handleTeamInfo(interaction) {
  const name = interaction.options.getString('name');
  try {
    const db = getFirestoreInstance();
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map(doc => convertFirestoreData(doc));
    const team = teams.find(t => t.name && t.name.toLowerCase().includes(name.toLowerCase()));
    if (!team) {
      await interaction.editReply(`❌ Team **${name}** not found. Use \`/teams\` to list all.`);
      return;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${team.name}`)
      .setDescription((team.description || 'No description.').substring(0, 4096))
      .setColor(0x00bfff)
      .setTimestamp()
      .setFooter({ text: 'Live from Void Website' });
    
    if (team.achievements?.length) {
      embed.addFields({
        name: '🏆 Achievements',
        value: team.achievements.slice(0, 10).join('\n').substring(0, 1024)
      });
    }
    
    if (team.players?.length) {
      // Separate pros and ops
      const pros = team.players.filter(p => !isOperations(p, team.name));
      const ops = team.players.filter(p => isOperations(p, team.name));
      
      // Show pros roster
      if (pros.length > 0) {
        const prosRoster = pros.map(p => `• **${p.name}** — ${p.role || 'Pro Player'} (${p.game || 'Fortnite'})`).join('\n');
        embed.addFields({ 
          name: `Pros (${pros.length})`, 
          value: prosRoster.length > 1024 ? prosRoster.substring(0, 1021) + '...' : prosRoster 
        });
      }
      
      // Show ops roster
      if (ops.length > 0) {
        const opsRoster = ops.map(p => `• **${p.name}** — ${p.role || 'Management'}`).join('\n');
        embed.addFields({ 
          name: `Operations (${ops.length})`, 
          value: opsRoster.length > 1024 ? opsRoster.substring(0, 1021) + '...' : opsRoster 
        });
      }
      
      // Show games
      const games = [...new Set(team.players.map(p => p.game).filter(Boolean))];
      if (games.length) embed.addFields({ name: 'Games', value: games.join(', '), inline: true });
    } else {
      embed.addFields({ name: 'Roster', value: 'No players listed.' });
    }
    
    setThumbnailIfValid(embed, team.image || team.logo);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('team_info error:', error);
    await interaction.editReply('❌ Failed to fetch team info.');
  }
}

module.exports = {
  teamsCommand,
  teamInfoCommand,
  handleTeams,
  handleTeamsPaginated,
  handleTeamInfo
};
