const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../supabaseClient');

const videosCommand = new SlashCommandBuilder()
  .setName('videos')
  .setDescription('Show latest Void YouTube/Twitch videos or VODs.')
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('How many videos (1-10)')
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(false)
  );

async function handleVideos(interaction) {
  const limit = interaction.options.getInteger('limit') || 5;
  await interaction.deferReply();

  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, title, platform, url, thumbnail_url, published_at, description')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error || !videos) {
    console.error('videos error:', error);
    await interaction.editReply('Failed to fetch videos.');
    return;
  }

  if (!videos.length) {
    await interaction.editReply('No videos found.');
    return;
  }

  const embeds = videos.map(v => {
    const embed = new EmbedBuilder()
      .setTitle(v.title)
      .setDescription(v.description || 'No description.')
      .addFields({
        name: 'Platform',
        value: v.platform || 'N/A',
        inline: true
      })
      .setColor(0xff0000);

    if (v.url) embed.setURL(v.url);
    if (v.thumbnail_url) embed.setThumbnail(v.thumbnail_url);
    if (v.published_at) {
      embed.setFooter({ text: `Published: ${new Date(v.published_at).toLocaleString()}` });
    }
    return embed;
  });

  await interaction.editReply({ embeds });
}

module.exports = {
  videosCommand,
  handleVideos
};

