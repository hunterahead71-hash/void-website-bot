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

  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, pros(count)');

  if (error || !teams) {
    console.error('pros_total error:', error);
    await interaction.editReply('Failed to fetch pros data.');
    return;
  }

  let totalPros = 0;
  for (const t of teams) {
    if (Array.isArray(t.pros)) {
      totalPros += t.pros.length;
    } else if (typeof t.pros === 'object' && t.pros.count != null) {
      totalPros += t.pros.count;
    }
  }

  await interaction.editReply(
    `We currently have **${totalPros}** pros across **${teams.length}** teams in the database.`
  );
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
    .ilike('name', name)
    .limit(1);

  if (error || !pros || !pros.length) {
    console.error('pro_info error:', error);
    await interaction.editReply(`Could not find a pro named **${name}**.`);
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
    .setColor(0x8a2be2);

  if (p.achievements && Array.isArray(p.achievements) && p.achievements.length) {
    embed.addFields({
      name: 'Achievements',
      value: p.achievements.slice(0, 10).join('\n')
    });
  }

  if (p.stats && Array.isArray(p.stats) && p.stats.length) {
    const statLines = p.stats
      .slice(0, 10)
      .map(s => `${s.label}: ${s.value}`)
      .join('\n');
    embed.addFields({ name: 'Key Stats', value: statLines });
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
}

module.exports = {
  prosTotalCommand,
  prosListCommand,
  proInfoCommand,
  handleProsTotal,
  handleProsList,
  handleProInfo
};

