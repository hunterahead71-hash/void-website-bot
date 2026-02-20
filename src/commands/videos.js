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
  const limit = Math.min(Math.max(interaction.options.getInteger('limit') || 5, 1), 10);
  await interaction.deferReply();

  try {
    const { data: videos, error } = await supabase
      .from('videos')
      .select('id, title, platform, url, thumbnail_url, published_at, description')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('videos error:', error);
      await interaction.editReply('Failed to fetch videos from database.');
      return;
    }

    if (!videos || !videos.length) {
      await interaction.editReply('No videos found.');
      return;
    }

    const embeds = videos.map(v => {
      const embed = new EmbedBuilder()
        .setTitle(v.title)
        .setDescription((v.description || 'No description.').substring(0, 4096))
        .addFields({
          name: 'Platform',
          value: v.platform || 'N/A',
          inline: true
        })
        .setColor(0xff0000)
        .setTimestamp(v.published_at ? new Date(v.published_at) : undefined)
        .setFooter({ text: 'Void eSports Videos' });

      if (v.url) embed.setURL(v.url);
      if (v.thumbnail_url) embed.setThumbnail(v.thumbnail_url);
      return embed;
    });

    await interaction.editReply({ embeds });
  } catch (error) {
    console.error('videos unexpected error:', error);
    await interaction.editReply('An unexpected error occurred while fetching videos.');
  }
}

module.exports = {
  videosCommand,
  handleVideos
};

