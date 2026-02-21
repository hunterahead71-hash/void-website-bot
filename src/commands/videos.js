const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');

const videosCommand = new SlashCommandBuilder()
  .setName('videos')
  .setDescription('Show videos posted on the Void website (live from site).')
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
  try {
    const db = getFirestoreInstance();
    let snap = await db.collection('videos').limit(50).get().catch(() => null);
    if (!snap || !snap.docs || snap.docs.length === 0) {
      await interaction.editReply('❌ No videos found on the website. Add videos in the site admin to see them here.');
      return;
    }
    const items = snap.docs.map(doc => convertFirestoreData(doc));
    const dateKey = items[0].date ? 'date' : items[0].publishedAt ? 'publishedAt' : 'createdAt';
    items.sort((a, b) => {
      const da = a[dateKey] ? new Date(a[dateKey]).getTime() : 0;
      const db_ = b[dateKey] ? new Date(b[dateKey]).getTime() : 0;
      return db_ - da;
    });
    await sendVideoEmbeds(interaction, items.slice(0, limit));
  } catch (error) {
    console.error('videos error:', error);
    await interaction.editReply('❌ Failed to fetch videos from the website.');
  }
}

function sendVideoEmbeds(interaction, items) {
  const embeds = items.map(v => {
    const url = v.url || v.youtubeUrl || v.link || null;
    const embed = new EmbedBuilder()
      .setTitle(v.title || 'Untitled Video')
      .setDescription((v.description || 'No description.').substring(0, 4096))
      .setColor(0xff0000)
      .setFooter({ text: 'Void eSports • Videos from website' });

    if (url) {
      embed.setURL(url);
    }
    const date = v.date || v.publishedAt || v.createdAt;
    if (date) {
      embed.setTimestamp(new Date(date));
    }
    const thumb = v.thumbnail || v.thumbnailUrl || v.image;
    setThumbnailIfValid(embed, thumb);
    return embed;
  });

  interaction.editReply({ embeds });
}

module.exports = {
  videosCommand,
  handleVideos
};
