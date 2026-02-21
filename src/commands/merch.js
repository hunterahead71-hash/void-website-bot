const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');

const merchCommand = new SlashCommandBuilder()
  .setName('merch')
  .setDescription('Show current merch names and prices from the Void store.')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Filter by category (e.g. apparel, mousepad)')
      .setRequired(false)
  );

async function handleMerch(interaction) {
  const category = interaction.options.getString('category');
  try {
    const db = getFirestoreInstance();
    const productsSnapshot = await db.collection('products').orderBy('createdAt', 'desc').limit(20).get();
    let products = (productsSnapshot.docs || []).map(doc => convertFirestoreData(doc));

    if (category) {
      products = products.filter(p =>
        p.category && p.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (!products.length) {
      const filterMsg = category ? ` for category "${category}"` : '';
      await interaction.editReply(`❌ No merch found${filterMsg}.`);
      return;
    }

    const lines = products.map(p => {
      const price = typeof p.price === 'number' ? `$${p.price.toFixed(2)}` : (p.price != null ? `$${Number(p.price).toFixed(2)}` : '—');
      const cat = (p.category || '—').substring(0, 20);
      return `**${(p.name || 'Unnamed').substring(0, 40)}**\n└ ${price}  •  ${cat}`;
    });
    const description = lines.join('\n\n').substring(0, 4090) + (lines.join('').length > 4090 ? '…' : '');

    const embed = new EmbedBuilder()
      .setTitle('🛒 Void eSports Store')
      .setDescription(description)
      .setColor(0xffa500)
      .setTimestamp()
      .setFooter({ text: `${products.length} item(s) • Live from website` });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('merch error:', error);
    await interaction.editReply('❌ Failed to fetch merch. Make sure Firebase is configured correctly.');
  }
}

module.exports = {
  merchCommand,
  handleMerch
};
