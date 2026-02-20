const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../supabaseClient');

const merchCommand = new SlashCommandBuilder()
  .setName('merch')
  .setDescription('Show merch/products from the Void store.')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Filter by category (e.g. apparel, mousepad)')
      .setRequired(false)
  );

async function handleMerch(interaction) {
  const category = interaction.options.getString('category');
  await interaction.deferReply();

  let query = supabase
    .from('products')
    .select('id, name, price, currency, category, description, product_url, image_url')
    .order('created_at', { ascending: false });

  if (category) {
    query = query.ilike('category', category);
  }

  const { data: products, error } = await query;

  if (error || !products) {
    console.error('merch error:', error);
    await interaction.editReply('Failed to fetch merch.');
    return;
  }

  if (!products.length) {
    await interaction.editReply('No merch found for that filter.');
    return;
  }

  const top = products.slice(0, 5);

  const embeds = top.map(p => {
    const embed = new EmbedBuilder()
      .setTitle(p.name)
      .setDescription(p.description || 'No description.')
      .addFields(
        {
          name: 'Price',
          value: `${p.currency || 'USD'} ${p.price?.toString() || 'N/A'}`,
          inline: true
        },
        {
          name: 'Category',
          value: p.category || 'N/A',
          inline: true
        }
      )
      .setColor(0xffa500);

    if (p.product_url) {
      embed.setURL(p.product_url);
    }
    if (p.image_url) {
      embed.setThumbnail(p.image_url);
    }
    return embed;
  });

  await interaction.editReply({ embeds });
}

module.exports = {
  merchCommand,
  handleMerch
};

