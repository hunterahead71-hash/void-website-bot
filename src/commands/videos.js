const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { youtubeApiKey, youtubeChannelId } = require('../config');
const { buildPaginationRow } = require('../utils/pagination');

const videosCommand = new SlashCommandBuilder()
  .setName('videos')
  .setDescription('Show latest Void YouTube videos (same as on the website).')
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('How many videos to fetch (1–25)')
      .setMinValue(1)
      .setMaxValue(25)
      .setRequired(false)
  );

const PER_PAGE = 5;

async function fetchYouTubeVideos(maxResults = 10) {
  if (!youtubeApiKey || !youtubeChannelId) return [];
  let channelId = youtubeChannelId.trim();
  let identifierParam = '';
  if (channelId.startsWith('@')) {
    identifierParam = `forHandle=${encodeURIComponent(channelId.slice(1))}`;
  } else if (channelId.startsWith('UC')) {
    identifierParam = `id=${channelId}`;
  } else {
    identifierParam = `forHandle=${encodeURIComponent(channelId)}`;
  }
  const channelRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${identifierParam}&key=${youtubeApiKey}`
  );
  if (!channelRes.ok) return [];
  const channelData = await channelRes.json();
  const uploadsId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) return [];
  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=${Math.min(maxResults, 50)}&key=${youtubeApiKey}`
  );
  if (!playlistRes.ok) return [];
  const playlistData = await playlistRes.json();
  if (!playlistData.items?.length) return [];
  return playlistData.items
    .filter(item => item.snippet?.resourceId?.videoId)
    .map(item => {
      const s = item.snippet;
      return {
        title: s.title || 'Untitled',
        description: (s.description || '').substring(0, 500),
        videoId: s.resourceId.videoId,
        url: `https://www.youtube.com/watch?v=${s.resourceId.videoId}`,
        thumbnail: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || `https://img.youtube.com/vi/${s.resourceId.videoId}/hqdefault.jpg`,
        publishedAt: s.publishedAt
      };
    });
}

function buildVideoEmbeds(items) {
  return items.map(v => {
    const embed = new EmbedBuilder()
      .setTitle(v.title)
      .setURL(v.url)
      .setDescription((v.description || 'No description.').substring(0, 4096))
      .setColor(0xff0000)
      .setThumbnail(v.thumbnail)
      .setTimestamp(v.publishedAt ? new Date(v.publishedAt) : undefined)
      .setFooter({ text: 'Void eSports · YouTube' });
    return embed;
  });
}

async function handleVideos(interaction, page = 0) {
  const limit = Math.min(Math.max(interaction.options?.getInteger?.('limit') || 15, 1), 25);
  try {
    const items = await fetchYouTubeVideos(limit);
    if (!items.length) {
      await interaction.editReply(
        '❌ No videos found. Set **YOUTUBE_API_KEY** and **YOUTUBE_CHANNEL_ID** in Render (same as the website) to show channel videos.'
      );
      return;
    }
    const totalPages = Math.ceil(items.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = items.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const embeds = buildVideoEmbeds(slice);

    const components = [];
    const pagRow = buildPaginationRow('videos', p, totalPages, String(limit));
    if (pagRow) components.push(pagRow);

    await interaction.editReply({ embeds, components }).catch(() => {});
  } catch (error) {
    console.error('videos error:', error);
    await interaction.editReply('❌ Failed to fetch videos. Check YouTube API config in Render.');
  }
}

/** For pagination button: re-run with same limit from extra. */
async function handleVideosPaginated(interaction, page, extra) {
  const limit = Math.min(Math.max(parseInt(extra, 10) || 15, 1), 25);
  try {
    const items = await fetchYouTubeVideos(limit);
    if (!items.length) {
      await interaction.update({ content: '❌ No videos.', embeds: [], components: [] }).catch(() => {});
      return;
    }
    const totalPages = Math.ceil(items.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = items.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const embeds = buildVideoEmbeds(slice);
    const components = [];
    const pagRow = buildPaginationRow('videos', p, totalPages, String(limit));
    if (pagRow) components.push(pagRow);
    await interaction.update({ embeds, components }).catch(() => {});
  } catch (error) {
    console.error('videos pagination error:', error);
    await interaction.update({ content: '❌ Error loading page.', embeds: [], components: [] }).catch(() => {});
  }
}

module.exports = {
  videosCommand,
  handleVideos,
  handleVideosPaginated
};
