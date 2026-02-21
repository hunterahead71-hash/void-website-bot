const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');

const placementsCommand = new SlashCommandBuilder()
  .setName('placements')
  .setDescription('Show recent tournament placements.')
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('How many placements (1-10)')
      .setMinValue(1)
      .setMaxValue(10)
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Filter by game')
      .setRequired(false)
  );

async function handlePlacements(interaction) {
  const limit = Math.min(Math.max(interaction.options.getInteger('limit') || 5, 1), 10);
  const game = interaction.options.getString('game');
  try {
    const db = getFirestoreInstance();
    let query = db.collection('placements')
      .orderBy('createdAt', 'desc')
      .limit(limit);

    const placementsSnapshot = await query.get();
    let placements = placementsSnapshot.docs.map(doc => convertFirestoreData(doc));

    // Filter by game if provided
    if (game) {
      placements = placements.filter(p => 
        p.game && p.game.toLowerCase().includes(game.toLowerCase())
      );
    }

    if (!placements || placements.length === 0) {
      const filterMsg = game ? ` for game "${game}"` : '';
      await interaction.editReply(`❌ No placements found${filterMsg}.`);
      return;
    }

    const embeds = placements.map(p => {
      const embed = new EmbedBuilder()
        .setTitle(`${p.tournament} – ${p.position}`)
        .addFields(
          { name: 'Team', value: p.team || 'N/A', inline: true },
          { name: 'Game', value: p.game || 'N/A', inline: true }
        )
        .setColor(0x1e90ff)
        .setTimestamp(p.createdAt ? new Date(p.createdAt) : undefined)
        .setFooter({ text: 'Void eSports Placements • Live data' });

      if (p.prize) {
        embed.addFields({ name: 'Prize', value: p.prize, inline: true });
      }

      if (p.players && Array.isArray(p.players) && p.players.length) {
        embed.addFields({ 
          name: 'Players', 
          value: p.players.slice(0, 5).join(', ') + (p.players.length > 5 ? '...' : '')
        });
      }

      setThumbnailIfValid(embed, p.logo);
      return embed;
    });

    await interaction.editReply({ embeds });
  } catch (error) {
    console.error('placements error:', error);
    await interaction.editReply('❌ Failed to fetch placements. Make sure Firebase is configured correctly.');
  }
}

module.exports = {
  placementsCommand,
  handlePlacements
};
