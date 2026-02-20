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

  try {
    let query = supabase
      .from('products')
      .select('id, name, price, currency, category, description, product_url, image_url')
      .order('created_at', { ascending: false })
      .limit(5);

    if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('merch error:', error);
      await interaction.editReply('Failed to fetch merch from database.');
      return;
    }

    if (!products || !products.length) {
      const filterMsg = category ? ` for category "${category}"` : '';
      await interaction.editReply(`No merch found${filterMsg}.`);
      return;
    }

    const embeds = products.map(p => {
      const embed = new EmbedBuilder()
        .setTitle(p.name)
        .setDescription((p.description || 'No description.').substring(0, 4096))
        .addFields(
          {
            name: 'Price',
            value: `${p.currency || 'USD'} $${(p.price || 0).toFixed(2)}`,
            inline: true
          },
          {
            name: 'Category',
            value: p.category || 'N/A',
            inline: true
          }
        )
        .setColor(0xffa500)
        .setTimestamp()
        .setFooter({ text: 'Void eSports Store' });

      if (p.product_url) {
        embed.setURL(p.product_url);
      }
      if (p.image_url) {
        embed.setThumbnail(p.image_url);
      }
      return embed;
    });

    await interaction.editReply({ embeds });
  } catch (error) {
    console.error('merch unexpected error:', error);
    await interaction.editReply('An unexpected error occurred while fetching merch.');
  }
}

module.exports = {
  merchCommand,
  handleMerch
};

