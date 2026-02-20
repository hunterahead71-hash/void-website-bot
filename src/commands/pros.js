const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../supabaseClient');

const prosTotalCommand = new SlashCommandBuilder()
  .setName('pros_total')
  .setDescription('Show total number of pros (players) and teams.');

const prosListCommand = new SlashCommandBuilder()
  .setName('pros_list')
  .setDescription('List pros, optionally filtered by game.')
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Filter by game (e.g. Valorant)')
      .setRequired(false)
  );

const proInfoCommand = new SlashCommandBuilder()
  .setName('pro_info')
  .setDescription('Get detailed information about a specific pro.')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Exact in-game name / alias')
      .setRequired(true)
  );

async function handleProsTotal(interaction) {
  await interaction.deferReply();

  try {
    // Fetch teams count
    const { count: teamsCount, error: teamsError } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    // Fetch pros count
    const { count: prosCount, error: prosError } = await supabase
      .from('pros')
      .select('*', { count: 'exact', head: true });

    if (teamsError || prosError) {
      console.error('pros_total error:', { teamsError, prosError });
      await interaction.editReply('Failed to fetch pros data from database.');
      return;
    }

    const totalPros = prosCount || 0;
    const totalTeams = teamsCount || 0;

    await interaction.editReply(
      `We currently have **${totalPros}** pros across **${totalTeams}** teams in the database.`
    );
  } catch (error) {
    console.error('pros_total unexpected error:', error);
    await interaction.editReply('An unexpected error occurred while fetching pros data.');
  }
}

async function handleProsList(interaction) {
  const gameFilter = interaction.options.getString('game');
  await interaction.deferReply();

  let query = supabase
    .from('pros')
    .select('id, name, role, game, team:teams(name)');

  if (gameFilter) {
    query = query.ilike('game', gameFilter);
  }

  const { data: pros, error } = await query.order('name', { ascending: true });

  if (error || !pros) {
    console.error('pros_list error:', error);
    await interaction.editReply('Failed to fetch pros list.');
    return;
  }

  if (!pros.length) {
    await interaction.editReply('No pros found for that filter.');
    return;
  }

  const lines = pros.slice(0, 25).map(p => {
    const teamName = p.team?.name || 'No team';
    return `• **${p.name}** (${p.role || 'Role N/A'}) – ${p.game || 'Game N/A'} – Team: ${teamName}`;
  });

  await interaction.editReply(lines.join('\n'));
}

async function handleProInfo(interaction) {
  const name = interaction.options.getString('name');
  await interaction.deferReply();

  try {
    const { data: pros, error } = await supabase
      .from('pros')
      .select(
        `
          id,
          name,
          role,
          game,
          bio,
          stats,
          achievements,
          image_url,
          twitter,
          twitch,
          youtube,
          instagram,
          team:teams(name)
        `
      )
      .ilike('name', `%${name}%`)
      .limit(1);

    if (error) {
      console.error('pro_info error:', error);
      await interaction.editReply('Failed to fetch pro information from database.');
      return;
    }

    if (!pros || !pros.length) {
      await interaction.editReply(`Could not find a pro matching **${name}**. Try using `/pros_list` to see all available pros.`);
      return;
    }

    const p = pros[0];
    const teamName = p.team?.name || 'No team';

    const embed = new EmbedBuilder()
      .setTitle(p.name)
      .setDescription(p.bio || 'No bio available.')
      .addFields(
        { name: 'Team', value: teamName, inline: true },
        { name: 'Game', value: p.game || 'N/A', inline: true },
        { name: 'Role', value: p.role || 'N/A', inline: true }
      )
      .setColor(0x8a2be2)
      .setTimestamp()
      .setFooter({ text: 'Void eSports' });

    if (p.achievements && Array.isArray(p.achievements) && p.achievements.length) {
      const achievementsText = p.achievements.slice(0, 10).join('\n');
      embed.addFields({
        name: 'Achievements',
        value: achievementsText.length > 1024 
          ? achievementsText.substring(0, 1021) + '...' 
          : achievementsText
      });
    }

    if (p.stats && Array.isArray(p.stats) && p.stats.length) {
      const statLines = p.stats
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
    if (p.twitter) socials.push(`[Twitter](${p.twitter})`);
    if (p.twitch) socials.push(`[Twitch](${p.twitch})`);
    if (p.youtube) socials.push(`[YouTube](${p.youtube})`);
    if (p.instagram) socials.push(`[Instagram](${p.instagram})`);

    if (socials.length) {
      embed.addFields({ name: 'Socials', value: socials.join(' • ') });
    }

    if (p.image_url) {
      embed.setThumbnail(p.image_url);
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('pro_info unexpected error:', error);
    await interaction.editReply('An unexpected error occurred while fetching pro information.');
  }
}

module.exports = {
  prosTotalCommand,
  prosListCommand,
  proInfoCommand,
  handleProsTotal,
  handleProsList,
  handleProInfo
};

