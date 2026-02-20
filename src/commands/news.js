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
  const limit = interaction.options.getInteger('limit') || 5;
  await interaction.deferReply();

  const { data: articles, error } = await supabase
    .from('news')
    .select('id, title, summary, url, image_url, published_at')
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error || !articles) {
    console.error('news error:', error);
    await interaction.editReply('Failed to fetch news.');
    return;
  }

  if (!articles.length) {
    await interaction.editReply('No news articles found.');
    return;
  }

  const embeds = articles.map(a => {
    const embed = new EmbedBuilder()
      .setTitle(a.title)
      .setDescription(a.summary || 'No summary.')
      .setColor(0x00ff7f);

    if (a.url) embed.setURL(a.url);
    if (a.image_url) embed.setThumbnail(a.image_url);

    if (a.published_at) {
      embed.setFooter({ text: `Published: ${new Date(a.published_at).toLocaleString()}` });
    }

    return embed;
  });

  await interaction.editReply({ embeds });
}

module.exports = {
  newsCommand,
  handleNews
};

