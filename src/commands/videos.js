const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { youtubeApiKey, youtubeChannelId } = require('../config');

const videosCommand = new SlashCommandBuilder()
  .setName('videos')
  .setDescription('Show latest Void YouTube videos.')
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
    if (!youtubeApiKey || !youtubeChannelId) {
      await interaction.editReply('❌ YouTube API not configured. Videos cannot be fetched.');
      return;
    }

    // Fetch videos from YouTube API
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${youtubeApiKey}&channelId=${youtubeChannelId}&part=snippet,id&order=date&maxResults=${limit}&type=video`
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      await interaction.editReply('❌ No videos found.');
      return;
    }

    const embeds = data.items.map(item => {
      const snippet = item.snippet;
      const videoId = item.id.videoId;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      const embed = new EmbedBuilder()
        .setTitle(snippet.title)
        .setDescription((snippet.description || 'No description.').substring(0, 4096))
        .setURL(videoUrl)
        .setColor(0xff0000)
        .setTimestamp(snippet.publishedAt ? new Date(snippet.publishedAt) : undefined)
        .setFooter({ text: 'Void eSports YouTube • Live data' });

      if (snippet.thumbnails?.high?.url) {
        embed.setThumbnail(snippet.thumbnails.high.url);
      }

      return embed;
    });

    await interaction.editReply({ embeds });
  } catch (error) {
    console.error('videos error:', error);
    await interaction.editReply('❌ Failed to fetch videos. Make sure YouTube API is configured correctly.');
  }
}

module.exports = {
  videosCommand,
  handleVideos
};
