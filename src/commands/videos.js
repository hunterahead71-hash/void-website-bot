const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
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
  );

const PER_PAGE = 5;

async function fetchVideosFromFirebase(limit = 15) {
  try {
    const db = getFirestoreInstance();
    
    // Try multiple possible collection names that might store videos
    let videos = [];
    const possibleCollections = ['videos', 'youtubeVideos', 'media', 'content'];
    
    for (const collectionName of possibleCollections) {
      try {
        const snap = await db.collection(collectionName)
          .orderBy('publishedAt', 'desc')
          .orderBy('createdAt', 'desc')
          .orderBy('date', 'desc')
          .limit(limit)
          .get();
        
        if (snap.docs && snap.docs.length > 0) {
          const collectionVideos = snap.docs.map(doc => {
            const data = convertFirestoreData(doc);
            return {
              title: data.title || data.name || 'Untitled Video',
              description: data.description || data.summary || '',
              videoId: data.videoId || data.youtubeId || data.id,
              url: data.url || data.videoUrl || data.link || (data.videoId ? `https://www.youtube.com/watch?v=${data.videoId}` : null),
              thumbnail: data.thumbnail || data.thumbnailUrl || data.image || (data.videoId ? `https://img.youtube.com/vi/${data.videoId}/hqdefault.jpg` : null),
              publishedAt: data.publishedAt || data.date || data.createdAt || new Date().toISOString(),
              platform: data.platform || 'YouTube'
            };
          }).filter(v => v.url || v.videoId); // Only keep entries with valid video data
          
          videos = [...videos, ...collectionVideos];
        }
      } catch (e) {
        // Collection might not exist, continue to next
        console.log(`Collection ${collectionName} not found or error:`, e.message);
      }
    }
    
    // If no videos found in any collection, check if there's a 'newsArticles' collection with videos
    if (videos.length === 0) {
      try {
        const newsSnap = await db.collection('newsArticles')
          .orderBy('date', 'desc')
          .limit(limit)
          .get();
        
        if (newsSnap.docs && newsSnap.docs.length > 0) {
          const newsVideos = newsSnap.docs.map(doc => {
            const data = convertFirestoreData(doc);
            // Check if this news article has a video URL
            const videoUrl = data.youtubeUrl || data.videoUrl || data.videoLink;
            if (videoUrl) {
              let videoId = null;
              if (videoUrl.includes('youtube.com/watch?v=')) {
                videoId = videoUrl.split('v=')[1]?.split('&')[0];
              } else if (videoUrl.includes('youtu.be/')) {
                videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
              }
              
              return {
                title: data.title || 'Video News',
                description: data.description || data.summary || '',
                videoId: videoId,
                url: videoUrl,
                thumbnail: data.image || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null),
                publishedAt: data.date || data.createdAt || new Date().toISOString(),
                platform: 'YouTube'
              };
            }
            return null;
          }).filter(v => v !== null);
          
          videos = [...videos, ...newsVideos];
        }
      } catch (e) {
        console.log('News articles check failed:', e.message);
      }
    }
    
    // Sort by published date (newest first) and remove duplicates
    const uniqueVideos = [];
    const seen = new Set();
    
    videos
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .forEach(video => {
        const key = video.url || video.videoId || video.title;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueVideos.push(video);
        }
      });
    
    return uniqueVideos.slice(0, limit);
  } catch (error) {
    console.error('Error fetching videos from Firebase:', error);
    return [];
  }
}

function buildVideoEmbeds(items) {
  return items.map(v => {
    const embed = new EmbedBuilder()
      .setTitle(v.title.substring(0, 256))
      .setURL(v.url || `https://www.youtube.com/watch?v=${v.videoId}`)
      .setDescription((v.description || 'No description available.').substring(0, 4096))
      .setColor(0xff0000)
      .setTimestamp(v.publishedAt ? new Date(v.publishedAt) : undefined)
      .setFooter({ text: `Void eSports · ${v.platform || 'YouTube'}` });
    
    if (v.thumbnail) {
      setThumbnailIfValid(embed, v.thumbnail);
    } else if (v.videoId) {
      embed.setThumbnail(`https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`);
    }
    
    return embed;
  });
}

async function handleVideos(interaction, page = 0) {
  const limit = Math.min(Math.max(interaction.options?.getInteger?.('limit') || 15, 1), 25);
  
  try {
    await interaction.editReply({ content: '📹 Fetching videos from website...', embeds: [], components: [] });
    
    const items = await fetchVideosFromFirebase(limit);
    
    if (!items.length) {
      await interaction.editReply({
        content: '❌ No videos found in the website database. Make sure videos are added to Firebase collections: `videos`, `youtubeVideos`, or as video links in `newsArticles`.',
        embeds: [],
        components: []
      });
      return;
    }
    
    const totalPages = Math.ceil(items.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = items.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const embeds = buildVideoEmbeds(slice);

    const components = [];
    const pagRow = buildPaginationRow('videos', p, totalPages, String(limit));
    if (pagRow) components.push(pagRow);

    await interaction.editReply({ content: null, embeds, components }).catch(() => {});
  } catch (error) {
    console.error('videos error:', error);
    await interaction.editReply('❌ Failed to fetch videos from website. Check Firebase connection.');
  }
}

/** For pagination button: re-run with same limit from extra. */
async function handleVideosPaginated(interaction, page, extra) {
  const limit = Math.min(Math.max(parseInt(extra, 10) || 15, 1), 25);
  try {
    const items = await fetchVideosFromFirebase(limit);
    if (!items.length) {
      await interaction.update({ content: '❌ No videos found.', embeds: [], components: [] }).catch(() => {});
      return;
    }
    const totalPages = Math.ceil(items.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = items.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const embeds = buildVideoEmbeds(slice);
    const components = [];
    const pagRow = buildPaginationRow('videos', p, totalPages, String(limit));
    if (pagRow) components.push(pagRow);
    await interaction.update({ content: null, embeds, components }).catch(() => {});
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
