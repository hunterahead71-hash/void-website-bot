const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');

const newsCommand = new SlashCommandBuilder()
  .setName('news')
  .setDescription('Show latest Void news articles.')
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('How many articles (1-10)')
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(false)
  );

async function handleNews(interaction) {
  const limit = Math.min(Math.max(interaction.options.getInteger('limit') || 5, 1), 10);
  await interaction.deferReply();

  try {
    const db = getFirestoreInstance();
    const newsSnapshot = await db.collection('newsArticles')
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    const articles = newsSnapshot.docs.map(doc => convertFirestoreData(doc));

    if (!articles || articles.length === 0) {
      await interaction.editReply('❌ No news articles found.');
      return;
    }

    const embeds = articles.map(a => {
      const embed = new EmbedBuilder()
        .setTitle(a.title)
        .setDescription((a.description || 'No summary.').substring(0, 4096))
        .setColor(0x00ff7f)
        .setTimestamp(a.date ? new Date(a.date) : undefined)
        .setFooter({ text: 'Void eSports News • Live data' });

      if (a.category) {
        embed.addFields({ name: 'Category', value: a.category, inline: true });
      }
      if (a.isEvent && a.eventDate) {
        embed.addFields({ name: 'Event Date', value: new Date(a.eventDate).toLocaleDateString(), inline: true });
      }

      if (a.image) {
        embed.setThumbnail(a.image);
      }

      return embed;
    });

    await interaction.editReply({ embeds });
  } catch (error) {
    console.error('news error:', error);
    await interaction.editReply('❌ Failed to fetch news. Make sure Firebase is configured correctly.');
  }
}

module.exports = {
  newsCommand,
  handleNews
};
