const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');

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
    const db = getFirestoreInstance();
    let query = db.collection('products').orderBy('createdAt', 'desc').limit(5);

    const productsSnapshot = await query.get();
    let products = productsSnapshot.docs.map(doc => convertFirestoreData(doc));

    // Filter by category if provided
    if (category) {
      products = products.filter(p => 
        p.category && p.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (!products || products.length === 0) {
      const filterMsg = category ? ` for category "${category}"` : '';
      await interaction.editReply(`❌ No merch found${filterMsg}.`);
      return;
    }

    const embeds = products.map(p => {
      const embed = new EmbedBuilder()
        .setTitle(p.name)
        .setDescription((p.description || 'No description.').substring(0, 4096))
        .addFields(
          {
            name: 'Price',
            value: `$${(p.price || 0).toFixed(2)}`,
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
        .setFooter({ text: 'Void eSports Store • Live data' });

      if (p.link) {
        embed.setURL(p.link);
      }
      if (p.image) {
        embed.setThumbnail(p.image);
      }
      return embed;
    });

    await interaction.editReply({ embeds });
  } catch (error) {
    console.error('merch error:', error);
    await interaction.editReply('❌ Failed to fetch merch. Make sure Firebase is configured correctly.');
  }
}

module.exports = {
  merchCommand,
  handleMerch
};
