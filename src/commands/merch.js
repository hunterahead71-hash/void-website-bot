const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');
const { buildPaginationRow } = require('../utils/pagination');

const merchCommand = new SlashCommandBuilder()
  .setName('merch')
  .setDescription('Show Void store merch. Use arrows to scroll pages.')
  .addStringOption(option =>
    option
      .setName('category')
      .setDescription('Filter by category (e.g. apparel, mousepad)')
      .setRequired(false)
  );

const PER_PAGE = 6;

async function buildMerchPage(interaction, page, category) {
  const db = getFirestoreInstance();
  const snap = await db.collection('products').orderBy('createdAt', 'desc').limit(100).get();
  let products = (snap.docs || []).map(doc => convertFirestoreData(doc));
  if (category) {
    products = products.filter(p =>
      p.category && p.category.toLowerCase().includes(category.toLowerCase())
    );
  }
  if (!products.length) {
    return { content: category ? `❌ No merch for **${category}**.` : '❌ No merch found.', embeds: [], components: [] };
  }
  const totalPages = Math.ceil(products.length / PER_PAGE);
  const p = Math.max(0, Math.min(page, totalPages - 1));
  const slice = products.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
  const embeds = slice.map(prod => {
    const name = (prod.name || 'Unnamed').substring(0, 256);
    const price = typeof prod.price === 'number'
      ? `$${prod.price.toFixed(2)}`
      : (prod.price != null ? `$${Number(prod.price).toFixed(2)}` : '—');
    const embed = new EmbedBuilder()
      .setTitle(`🛒 ${name}`)
      .setDescription(`${price}${prod.category ? ` · ${prod.category}` : ''}${prod.description ? `\n\n${(prod.description || '').substring(0, 500)}` : ''}`)
      .setColor(0xffa500)
      .setFooter({ text: `Page ${p + 1}/${totalPages} · Void eSports Store` })
      .setTimestamp();
    setThumbnailIfValid(embed, prod.image || prod.imageUrl);
    if (prod.product_url && (prod.product_url.startsWith('http://') || prod.product_url.startsWith('https://'))) {
      embed.setURL(prod.product_url);
    }
    return embed;
  });
  const components = [];
  const pagRow = buildPaginationRow('merch', p, totalPages, category || '');
  if (pagRow) components.push(pagRow);
  return { embeds, components };
}

async function handleMerch(interaction, page = 0, extraCategory = null) {
  const category = extraCategory !== null ? extraCategory : (interaction.options?.getString?.('category') || null);
  try {
    const payload = await buildMerchPage(interaction, page, category);
    if (payload.content) {
      await interaction.editReply(payload).catch(() => {});
      return;
    }
    await interaction.editReply(payload).catch(() => {});
  } catch (error) {
    console.error('merch error:', error);
    await interaction.editReply({ content: '❌ Failed to fetch merch.', embeds: [], components: [] }).catch(() => {});
  }
}

async function handleMerchPaginated(interaction, page, extra) {
  try {
    const payload = await buildMerchPage(interaction, page, extra || null);
    await interaction.update(payload).catch(() => {});
  } catch (error) {
    console.error('merch pagination error:', error);
    await interaction.update({ content: '❌ Error.', embeds: [], components: [] }).catch(() => {});
  }
}

module.exports = {
  merchCommand,
  handleMerch,
  handleMerchPaginated
};
