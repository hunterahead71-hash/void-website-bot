const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRawFirestore, collection, addDoc, Timestamp } = require('../firebaseClient');

const addProCommand = new SlashCommandBuilder()
  .setName('add_pro')
  .setDescription('Add a pro/ambassador to the website (writes to Firebase). Requires write access.')
  .addStringOption(o => o.setName('name').setDescription('Display name').setRequired(true))
  .addStringOption(o => o.setName('game').setDescription('Game (e.g. Fortnite)').setRequired(true))
  .addStringOption(o => o.setName('role').setDescription('Role').setRequired(false))
  .addStringOption(o => o.setName('twitter').setDescription('Twitter URL').setRequired(false))
  .addStringOption(o => o.setName('twitch').setDescription('Twitch URL').setRequired(false));

const addMerchCommand = new SlashCommandBuilder()
  .setName('add_merch')
  .setDescription('Add a merch/product to the website (writes to Firebase). Requires write access.')
  .addStringOption(o => o.setName('name').setDescription('Product name').setRequired(true))
  .addNumberOption(o => o.setName('price').setDescription('Price (number)').setRequired(true))
  .addStringOption(o => o.setName('category').setDescription('Category').setRequired(false))
  .addStringOption(o => o.setName('link').setDescription('Store link').setRequired(false));

async function handleAddPro(interaction) {
  try {
    const db = getRawFirestore();
    if (!db) {
      await interaction.editReply('❌ Firebase not available.');
      return;
    }
    const name = interaction.options.getString('name');
    const game = interaction.options.getString('game');
    const role = interaction.options.getString('role') || 'Pro';
    const socialLinks = {};
    const twitter = interaction.options.getString('twitter');
    const twitch = interaction.options.getString('twitch');
    if (twitter) socialLinks.twitter = twitter;
    if (twitch) socialLinks.twitch = twitch;

    await addDoc(collection(db, 'ambassadors'), {
      name,
      game,
      role,
      image: '',
      achievements: [],
      socialLinks,
      createdAt: Timestamp.now()
    });
    const embed = new EmbedBuilder()
      .setTitle('✅ Pro added')
      .setDescription(`**${name}** (${game}) was added to ambassadors.`)
      .setColor(0x00ff00)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('add_pro error:', error);
    const msg = error.code === 7 || (error.message && error.message.includes('permission'))
      ? '❌ Permission denied. Firebase rules may not allow writes from the bot. Ask the website owner to grant write access.'
      : `❌ Failed: ${error.message}`;
    await interaction.editReply(msg);
  }
}

async function handleAddMerch(interaction) {
  try {
    const db = getRawFirestore();
    if (!db) {
      await interaction.editReply('❌ Firebase not available.');
      return;
    }
    const name = interaction.options.getString('name');
    const price = Number(interaction.options.getNumber('price'));
    const category = interaction.options.getString('category') || 'Merch';
    const link = interaction.options.getString('link') || '';

    await addDoc(collection(db, 'products'), {
      name,
      price,
      category,
      description: '',
      image: '',
      link,
      createdAt: Timestamp.now()
    });
    const embed = new EmbedBuilder()
      .setTitle('✅ Merch added')
      .setDescription(`**${name}** — $${price.toFixed(2)} (${category}) was added to the store.`)
      .setColor(0x00ff00)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('add_merch error:', error);
    const msg = error.code === 7 || (error.message && error.message.includes('permission'))
      ? '❌ Permission denied. Firebase rules may not allow writes from the bot. Ask the website owner to grant write access.'
      : `❌ Failed: ${error.message}`;
    await interaction.editReply(msg);
  }
}

module.exports = {
  addProCommand,
  addMerchCommand,
  handleAddPro,
  handleAddMerch
};
