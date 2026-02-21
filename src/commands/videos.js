// commands/videos.js - Updated to use YouTube API exactly like the website

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { youtubeApiKey, youtubeChannelId } = require('../config');
const { buildPaginationRow } = require('../utils/pagination');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');

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
  )
  .addBooleanOption(option =>
    option
      .setName('longform')
      .setDescription('Filter for long-form videos (4+ minutes) like the website does')
      .setRequired(false)
  );

const PER_PAGE = 5;
const MIN_LONG_FORM_SECONDS = 240; // 4 minutes like the website

/**
 * Format view count like the website (1.2K, 1.5M)
 */
function formatViewCount(viewCount) {
  const count = parseInt(viewCount);
  if (isNaN(count)) return '0';
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}

/**
 * Format duration from ISO 8601 to readable format (PT1H2M3S → 1:02:03)
 * Exactly like the website's formatDuration function
 */
function formatDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return '0:00';

  const hours = (match[1] || '').replace('H', '');
  const minutes = (match[2] || '').replace('M', '');
  const seconds = (match[3] || '').replace('S', '');

  let formatted = '';
  if (hours) {
    formatted += hours + ':';
    formatted += (minutes || '0').padStart(2, '0') + ':';
  } else {
    formatted += (minutes || '0') + ':';
  }
  formatted += (seconds || '0').padStart(2, '0');

  return formatted;
}

/**
 * Convert duration string to seconds for filtering
 */
function durationToSeconds(duration) {
  const parts = duration.split(':');
  let totalSeconds = 0;
  
  if (parts.length === 3) { // HH:MM:SS
    totalSeconds = (parseInt(parts[0], 10) || 0) * 3600 + 
                   (parseInt(parts[1], 10) || 0) * 60 + 
                   (parseInt(parts[2], 10) || 0);
  } else if (parts.length === 2) { // MM:SS
    totalSeconds = (parseInt(parts[0], 10) || 0) * 60 + 
                   (parseInt(parts[1], 10) || 0);
  }
  
  return totalSeconds;
}

/**
 * Fetch videos from YouTube API exactly like the website does
 */
async function fetchYouTubeVideos(maxResults = 15) {
  // Check if API credentials are configured
  if (!youtubeApiKey || !youtubeChannelId) {
    console.error('❌ YouTube API credentials missing');
    return [];
  }

  const baseUrl = 'https://www.googleapis.com/youtube/v3';
  
  try {
    console.log(`📡 Fetching YouTube videos for channel: ${youtubeChannelId}`);
    
    // Step 1: Determine channel identifier format (exactly like website)
    let identifierParam = '';
    const channelId = youtubeChannelId.trim();
    
    if (channelId.startsWith('@')) {
      identifierParam = `forHandle=${channelId.substring(1)}`;
    } else if (channelId.startsWith('UC')) {
      identifierParam = `id=${channelId}`;
    } else {
      identifierParam = `forHandle=${channelId}`;
    }
    
    // Step 2: Get channel details to find uploads playlist
    const channelResponse = await fetch(
      `${baseUrl}/channels?part=contentDetails&${identifierParam}&key=${youtubeApiKey}`
    );
    
    if (!channelResponse.ok) {
      const errorData = await channelResponse.json();
      console.error('❌ YouTube API Error:', errorData);
      throw new Error(`Failed to fetch channel data: ${channelResponse.statusText}`);
    }
    
    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      console.warn('⚠️ No channel found for:', youtubeChannelId);
      return [];
    }
    
    const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.error('❌ Could not find uploads playlist');
      return [];
    }
    
    // Step 3: Get playlist items (videos)
    const playlistResponse = await fetch(
      `${baseUrl}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${youtubeApiKey}`
    );
    
    if (!playlistResponse.ok) {
      throw new Error('Failed to fetch playlist items');
    }
    
    const playlistData = await playlistResponse.json();
    
    if (!playlistData.items || playlistData.items.length === 0) {
      return [];
    }
    
    // Step 4: Get video IDs for detailed info
    const videoIds = playlistData.items
      .map(item => item.snippet?.resourceId?.videoId)
      .filter(id => id)
      .join(',');
    
    // Step 5: Get video details (duration, statistics)
    const videosResponse = await fetch(
      `${baseUrl}/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${youtubeApiKey}`
    );
    
    if (!videosResponse.ok) {
      throw new Error('Failed to fetch video details');
    }
    
    const videosData = await videosResponse.json();
    
    // Step 6: Format videos exactly like the website
    return videosData.items.map(video => {
      const snippet = video.snippet;
      const thumbnails = snippet.thumbnails;
      
      // Get the best available thumbnail (prioritize maxresdefault like website)
      const thumbnail = thumbnails.maxresdefault?.url || 
                       thumbnails.high?.url || 
                       thumbnails.medium?.url || 
                       `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
      
      const duration = formatDuration(video.contentDetails.duration);
      const views = formatViewCount(video.statistics.viewCount);
      
      return {
        id: video.id,
        title: snippet.title,
        description: snippet.description,
        thumbnail: thumbnail,
        videoId: video.id,
        duration: duration,
        durationSeconds: durationToSeconds(duration),
        views: views,
        viewCount: parseInt(video.statistics.viewCount) || 0,
        publishedAt: snippet.publishedAt,
        channelTitle: snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${video.id}`
      };
    });
    
  } catch (error) {
    console.error('❌ YouTube API Error:', error);
    return [];
  }
}

/**
 * Filter videos exactly like the website does
 * Website: filters for 4+ minutes, falls back to latest if none found
 */
function filterVideosLikeWebsite(videos, longformOnly = true) {
  if (!longformOnly) return videos;
  
  // Filter for long-form videos (4+ minutes)
  const longFormVideos = videos.filter(v => v.durationSeconds >= MIN_LONG_FORM_SECONDS);
  
  // If no long-form videos, return latest videos (website behavior)
  if (longFormVideos.length === 0) {
    console.log('⚠️ No long-form videos found, using latest videos (matching website fallback)');
    return videos.slice(0, 5);
  }
  
  return longFormVideos;
}

function buildVideoEmbed(video, index, total) {
  const embed = new EmbedBuilder()
    .setTitle(video.title.substring(0, 256))
    .setURL(video.url)
    .setDescription(video.description ? video.description.substring(0, 4096) : 'No description available.')
    .setColor(0xff0000) // YouTube red
    .setAuthor({ 
      name: video.channelTitle || 'Void Esports', 
      iconURL: 'https://www.youtube.com/s/desktop/014d6b3c/img/favicon_144x144.png' 
    })
    .setFooter({ 
      text: `${video.views} views • ${video.duration} • Page ${index + 1}/${total}` 
    })
    .setTimestamp(video.publishedAt ? new Date(video.publishedAt) : undefined);
  
  // Add thumbnail
  if (video.thumbnail) {
    embed.setThumbnail(video.thumbnail);
  }
  
  return embed;
}

async function handleVideos(interaction, page = 0) {
  const limit = Math.min(Math.max(interaction.options?.getInteger?.('limit') || 15, 1), 25);
  const longformOnly = interaction.options?.getBoolean?.('longform') ?? true; // Default to website behavior
  
  await interaction.editReply({ content: '📹 Fetching YouTube videos...', embeds: [], components: [] });
  
  try {
    // Check if YouTube API is configured
    if (!youtubeApiKey || !youtubeChannelId) {
      await interaction.editReply({
        content: '❌ YouTube API not configured. Set **YOUTUBE_API_KEY** and **YOUTUBE_CHANNEL_ID** in Render environment variables.\n\nYou can get these from:\n- API Key: https://console.cloud.google.com/apis/credentials\n- Channel ID: Your YouTube channel URL (e.g., @VoidEsports or UCxxxxx)',
        embeds: [],
        components: []
      });
      return;
    }
    
    // Fetch videos from YouTube API (exactly like website)
    const allVideos = await fetchYouTubeVideos(limit);
    
    if (!allVideos.length) {
      await interaction.editReply({
        content: '❌ No videos found. Check your YouTube API key and channel ID.\n\n' +
                'Current config:\n' +
                `- API Key: ${youtubeApiKey ? '✅ Set' : '❌ Missing'}\n` +
                `- Channel ID: ${youtubeChannelId || '❌ Missing'}\n\n` +
                'Channel ID should be like: `@VoidEsports` or `UCxxxxxxxxxxxxxxxxxxxxxx`',
        embeds: [],
        components: []
      });
      return;
    }
    
    // Filter videos using website's logic (long-form filtering with fallback)
    const filteredVideos = filterVideosLikeWebsite(allVideos, longformOnly);
    
    if (!filteredVideos.length) {
      await interaction.editReply({ content: '❌ No videos match the filter.', embeds: [], components: [] });
      return;
    }
    
    // Pagination
    const totalPages = Math.ceil(filteredVideos.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = filteredVideos.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    
    // Create embeds for this page
    const embeds = slice.map((video, i) => 
      buildVideoEmbed(video, p * PER_PAGE + i, filteredVideos.length)
    );
    
    // Add pagination buttons
    const components = [];
    if (totalPages > 1) {
      const row = new ActionRowBuilder();
      
      if (p > 0) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`videos_page_${p - 1}_${limit}_${longformOnly}`)
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Primary)
        );
      }
      
      if (p < totalPages - 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`videos_page_${p + 1}_${limit}_${longformOnly}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Primary)
        );
      }
      
      if (row.components.length > 0) {
        components.push(row);
      }
    }
    
    // Add filter info to response
    const filterInfo = longformOnly ? 
      `🎥 Showing **long-form videos** (4+ minutes) • ${filteredVideos.length} total` :
      `🎥 Showing **all videos** • ${filteredVideos.length} total`;
    
    await interaction.editReply({ 
      content: filterInfo,
      embeds, 
      components 
    });
    
  } catch (error) {
    console.error('❌ Videos command error:', error);
    await interaction.editReply({ 
      content: '❌ Failed to fetch YouTube videos. Check the API key and channel ID in Render environment variables.',
      embeds: [], 
      components: [] 
    });
  }
}

async function handleVideosPaginated(interaction, page, limit, longformOnly) {
  try {
    const allVideos = await fetchYouTubeVideos(parseInt(limit) || 15);
    const filteredVideos = filterVideosLikeWebsite(allVideos, longformOnly === 'true');
    
    const totalPages = Math.ceil(filteredVideos.length / PER_PAGE);
    const p = Math.max(0, Math.min(parseInt(page), totalPages - 1));
    const slice = filteredVideos.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    
    const embeds = slice.map((video, i) => 
      buildVideoEmbed(video, p * PER_PAGE + i, filteredVideos.length)
    );
    
    const components = [];
    if (totalPages > 1) {
      const row = new ActionRowBuilder();
      
      if (p > 0) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`videos_page_${p - 1}_${limit}_${longformOnly}`)
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Primary)
        );
      }
      
      if (p < totalPages - 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`videos_page_${p + 1}_${limit}_${longformOnly}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Primary)
        );
      }
      
      if (row.components.length > 0) {
        components.push(row);
      }
    }
    
    const filterInfo = longformOnly === 'true' ? 
      `🎥 Showing **long-form videos** (4+ minutes) • ${filteredVideos.length} total` :
      `🎥 Showing **all videos** • ${filteredVideos.length} total`;
    
    await interaction.update({ 
      content: filterInfo,
      embeds, 
      components 
    });
    
  } catch (error) {
    console.error('❌ Pagination error:', error);
    await interaction.update({ 
      content: '❌ Error loading page.', 
      embeds: [], 
      components: [] 
    });
  }
}

module.exports = {
  videosCommand,
  handleVideos,
  handleVideosPaginated
};
