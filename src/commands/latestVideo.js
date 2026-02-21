const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { youtubeApiKey, youtubeChannelId } = require('../config');

const latestVideoCommand = new SlashCommandBuilder()
  .setName('latest-video')
  .setDescription('Get the latest YouTube video from Void Esports');

// Format view count (same as website)
function formatViewCount(viewCount) {
  const count = parseInt(viewCount);
  if (isNaN(count)) return '0';
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}

// Format duration from ISO 8601 to readable format
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

// Get latest YouTube video using environment variables
async function getLatestYouTubeVideo() {
  // Check if API credentials are configured
  if (!youtubeApiKey || !youtubeChannelId) {
    console.error('❌ YouTube API credentials missing in environment variables');
    return null;
  }

  const baseUrl = 'https://www.googleapis.com/youtube/v3';
  
  try {
    console.log(`📡 Fetching latest YouTube video for channel: ${youtubeChannelId}`);
    
    // Determine channel identifier format
    let identifierParam = '';
    const channelId = youtubeChannelId.trim();
    
    if (channelId.startsWith('@')) {
      identifierParam = `forHandle=${channelId.substring(1)}`;
    } else if (channelId.startsWith('UC')) {
      identifierParam = `id=${channelId}`;
    } else {
      identifierParam = `forHandle=${channelId}`;
    }
    
    // Get channel details to find uploads playlist
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
      return null;
    }
    
    const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      console.error('❌ Could not find uploads playlist');
      return null;
    }
    
    // Get latest video from playlist
    const playlistResponse = await fetch(
      `${baseUrl}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${youtubeApiKey}`
    );
    
    if (!playlistResponse.ok) {
      throw new Error('Failed to fetch playlist items');
    }
    
    const playlistData = await playlistResponse.json();
    
    if (!playlistData.items || playlistData.items.length === 0) {
      return null;
    }
    
    const videoId = playlistData.items[0].snippet.resourceId.videoId;
    
    // Get video details
    const videoResponse = await fetch(
      `${baseUrl}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${youtubeApiKey}`
    );
    
    if (!videoResponse.ok) {
      throw new Error('Failed to fetch video details');
    }
    
    const videoData = await videoResponse.json();
    
    if (!videoData.items || videoData.items.length === 0) {
      return null;
    }
    
    const video = videoData.items[0];
    const snippet = video.snippet;
    const thumbnails = snippet.thumbnails;
    
    // Get the best available thumbnail
    const thumbnail = thumbnails.maxresdefault?.url || 
                     thumbnails.high?.url || 
                     thumbnails.medium?.url || 
                     `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
    
    return {
      title: snippet.title,
      description: snippet.description,
      thumbnail: thumbnail,
      videoId: video.id,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      duration: formatDuration(video.contentDetails.duration),
      views: formatViewCount(video.statistics.viewCount),
      likeCount: video.statistics.likeCount ? formatViewCount(video.statistics.likeCount) : 'N/A',
      commentCount: video.statistics.commentCount ? formatViewCount(video.statistics.commentCount) : 'N/A',
      publishedAt: snippet.publishedAt,
      channelTitle: snippet.channelTitle,
      channelId: snippet.channelId
    };
    
  } catch (error) {
    console.error('❌ YouTube API Error:', error);
    return null;
  }
}

async function handleLatestVideo(interaction) {
  await interaction.editReply({ 
    content: '🔍 Fetching latest YouTube video from Void Esports...', 
    embeds: [], 
    components: [] 
  });
  
  try {
    // Check if YouTube API is configured
    if (!youtubeApiKey || !youtubeChannelId) {
      await interaction.editReply({
        content: '❌ YouTube API not configured. Please set **YOUTUBE_API_KEY** and **YOUTUBE_CHANNEL_ID** in Render environment variables.',
        embeds: [],
        components: []
      });
      return;
    }
    
    const videoData = await getLatestYouTubeVideo();
    
    if (!videoData) {
      await interaction.editReply({
        content: '❌ Could not fetch the latest YouTube video. The channel may have no videos or the API key may be invalid.',
        embeds: [],
        components: []
      });
      return;
    }
    
    // Create embed for the video
    const embed = new EmbedBuilder()
      .setTitle(videoData.title.substring(0, 256))
      .setDescription(videoData.description ? videoData.description.substring(0, 4096) : 'No description available.')
      .setColor(0xFF0000) // YouTube red
      .setAuthor({ 
        name: videoData.channelTitle || 'Void Esports', 
        iconURL: 'https://cdn.discordapp.com/emojis/1448065395922702480.webp?size=128',
        url: `https://www.youtube.com/channel/${videoData.channelId}`
      })
      .setURL(videoData.url)
      .setImage(videoData.thumbnail)
      .setThumbnail('https://www.youtube.com/s/desktop/014d6b3c/img/favicon_144x144.png')
      .setTimestamp(videoData.publishedAt ? new Date(videoData.publishedAt) : undefined)
      .setFooter({ 
        text: `YouTube · ${videoData.views} views · ${videoData.duration}`,
        iconURL: 'https://cdn.discordapp.com/emojis/1448065395922702480.webp?size=128'
      });
    
    // Add statistics fields
    embed.addFields(
      { name: '👁️ Views', value: videoData.views, inline: true },
      { name: '⏱️ Duration', value: videoData.duration, inline: true },
      { name: '👍 Likes', value: videoData.likeCount, inline: true },
      { name: '💬 Comments', value: videoData.commentCount, inline: true },
      { name: '📅 Uploaded', value: `<t:${Math.floor(new Date(videoData.publishedAt).getTime() / 1000)}:R>`, inline: true }
    );
    
    // Create action buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel(' Watch on YouTube')
          .setStyle(ButtonStyle.Link)
          .setURL(videoData.url)
          .setEmoji('📺'),
        new ButtonBuilder()
          .setLabel(' Refresh')
          .setStyle(ButtonStyle.Primary)
          .setCustomId('refresh_latest_youtube')
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setLabel(' Share')
          .setStyle(ButtonStyle.Secondary)
          .setCustomId('share_youtube_latest')
          .setEmoji('📤')
      );
    
    // Add channel button as second row
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel(' Visit Channel')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://youtube.com/channel/${videoData.channelId}`)
          .setEmoji('📺'),
        new ButtonBuilder()
          .setLabel(' Subscribe')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://www.youtube.com/channel/${videoData.channelId}?sub_confirmation=1`)
          .setEmoji('🔔')
      );
    
    await interaction.editReply({ 
      content: null, 
      embeds: [embed], 
      components: [row, row2] 
    });
    
  } catch (error) {
    console.error('❌ Latest video error:', error);
    await interaction.editReply({ 
      content: '❌ Failed to fetch latest video. Please try again later.',
      embeds: [], 
      components: [] 
    });
  }
}

async function handleRefreshLatest(interaction) {
  await interaction.update({ 
    content: '🔄 Refreshing latest YouTube video...', 
    embeds: [], 
    components: [] 
  });
  
  // Re-run handleLatestVideo with the same interaction
  await handleLatestVideo(interaction);
}

module.exports = {
  latestVideoCommand,
  handleLatestVideo,
  handleRefreshLatest
};
