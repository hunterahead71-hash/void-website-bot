const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../supabaseClient');

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
    const { data: articles, error } = await supabase
      .from('news')
      .select('id, title, summary, url, image_url, published_at')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('news error:', error);
      await interaction.editReply('Failed to fetch news from database.');
      return;
    }

    if (!articles || !articles.length) {
      await interaction.editReply('No news articles found.');
      return;
    }

    const embeds = articles.map(a => {
      const embed = new EmbedBuilder()
        .setTitle(a.title)
        .setDescription((a.summary || 'No summary.').substring(0, 4096))
        .setColor(0x00ff7f)
        .setTimestamp(a.published_at ? new Date(a.published_at) : undefined)
        .setFooter({ text: 'Void eSports News' });

      if (a.url) embed.setURL(a.url);
      if (a.image_url) embed.setThumbnail(a.image_url);

      return embed;
    });

    await interaction.editReply({ embeds });
  } catch (error) {
    console.error('news unexpected error:', error);
    await interaction.editReply('An unexpected error occurred while fetching news.');
  }
}

module.exports = {
  newsCommand,
  handleNews
};

