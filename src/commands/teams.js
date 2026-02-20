const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../supabaseClient');

const teamsCommand = new SlashCommandBuilder()
  .setName('teams')
  .setDescription('List all teams with basic info.');

const teamInfoCommand = new SlashCommandBuilder()
  .setName('team_info')
  .setDescription('Get detailed roster and info for a specific team.')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Team name')
      .setRequired(true)
  );

async function handleTeams(interaction) {
  await interaction.deferReply();

  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, game, region')
      .order('name', { ascending: true });

    if (error) {
      console.error('teams error:', error);
      await interaction.editReply('Failed to fetch teams from database.');
      return;
    }

    if (!teams || !teams.length) {
      await interaction.editReply('No teams found in the database.');
      return;
    }

    const lines = teams.map(t => {
      const region = t.region || 'Region N/A';
      const game = t.game || 'Game N/A';
      return `• **${t.name}** – ${game} – ${region}`;
    });

    await interaction.editReply(lines.join('\n'));
  } catch (error) {
    console.error('teams unexpected error:', error);
    await interaction.editReply('An unexpected error occurred while fetching teams.');
  }
}

async function handleTeamInfo(interaction) {
  const name = interaction.options.getString('name');
  await interaction.deferReply();

  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, game, region, description, logo_url')
      .ilike('name', `%${name}%`)
      .limit(1);

    if (error) {
      console.error('team_info error:', error);
      await interaction.editReply('Failed to fetch team information from database.');
      return;
    }

    if (!teams || !teams.length) {
      await interaction.editReply(`Team **${name}** not found. Try using `/teams` to see all available teams.`);
      return;
    }

    const team = teams[0];

    const { data: pros, error: prosError } = await supabase
      .from('pros')
      .select('name, role, game')
      .eq('team_id', team.id)
      .order('role', { ascending: true });

    if (prosError) {
      console.error('team_info pros error:', prosError);
    }

    const embed = new EmbedBuilder()
      .setTitle(team.name)
      .setDescription(team.description || 'No description provided.')
      .addFields(
        { name: 'Game', value: team.game || 'N/A', inline: true },
        { name: 'Region', value: team.region || 'N/A', inline: true }
      )
      .setColor(0x00bfff)
      .setTimestamp()
      .setFooter({ text: 'Void eSports' });

    if (team.logo_url) {
      embed.setThumbnail(team.logo_url);
    }

    if (pros && pros.length) {
      const rosterLines = pros
        .map(p => `• **${p.name}** – ${p.role || 'Role N/A'} (${p.game || 'Game N/A'})`)
        .join('\n');
      embed.addFields({ 
        name: `Roster (${pros.length})`, 
        value: rosterLines.length > 1024 ? rosterLines.substring(0, 1021) + '...' : rosterLines 
      });
    } else {
      embed.addFields({ name: 'Roster', value: 'No players found for this team.' });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('team_info unexpected error:', error);
    await interaction.editReply('An unexpected error occurred while fetching team information.');
  }
}

module.exports = {
  teamsCommand,
  teamInfoCommand,
  handleTeams,
  handleTeamInfo
};

