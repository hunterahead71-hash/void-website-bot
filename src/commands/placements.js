const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');
const { buildPaginationRow, encodeExtra } = require('../utils/pagination');

const placementsCommand = new SlashCommandBuilder()
  .setName('placements')
  .setDescription('Show recent tournament placements. Use arrows to scroll pages.')
  .addIntegerOption(option =>
    option
      .setName('limit')
      .setDescription('How many to load (1–30)')
      .setMinValue(1)
      .setMaxValue(30)
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Filter by game')
      .setRequired(false)
  );

const PER_PAGE = 5;

async function buildPlacementsPage(interaction, page, limit = 20, gameFilter = null) {
  const db = getFirestoreInstance();
  const snap = await db.collection('placements').orderBy('createdAt', 'desc').limit(limit).get();
  let placements = (snap.docs || []).map(doc => convertFirestoreData(doc));
  if (gameFilter) {
    placements = placements.filter(p =>
      p.game && p.game.toLowerCase().includes(gameFilter.toLowerCase())
    );
  }
  if (!placements.length) {
    return { content: gameFilter ? `❌ No placements for **${gameFilter}**.` : '❌ No placements found.', embeds: [], components: [] };
  }
  const totalPages = Math.ceil(placements.length / PER_PAGE);
  const p = Math.max(0, Math.min(page, totalPages - 1));
  const slice = placements.slice(p * PER_PAGE, (p + 1) * PER_PAGE);

  const embeds = slice.map(pl => {
    const proNames = (pl.players && Array.isArray(pl.players) && pl.players.length)
      ? pl.players.join(', ')
      : (pl.proName || pl.playerName || pl.pro || 'N/A');
    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${pl.tournament} — ${pl.position}`)
      .addFields(
        { name: 'Pro', value: proNames, inline: true },
        { name: 'Team', value: pl.team || 'N/A', inline: true },
        { name: 'Game', value: pl.game || 'N/A', inline: true }
      )
      .setColor(0x1e90ff)
      .setTimestamp(pl.createdAt ? new Date(pl.createdAt) : undefined)
      .setFooter({ text: 'Void eSports Placements · Live from website' });
    if (pl.prize) embed.addFields({ name: 'Prize', value: pl.prize, inline: true });
    setThumbnailIfValid(embed, pl.logo);
    return embed;
  });

  const components = [];
  const extra = gameFilter ? `${limit}:${gameFilter}` : String(limit);
  const pagRow = buildPaginationRow('placements', p, totalPages, extra.slice(0, 50));
  if (pagRow) components.push(pagRow);
  return { embeds, components };
}

function parsePlacementsExtra(extra) {
  if (!extra) return { limit: 20, game: null };
  const idx = extra.indexOf(':');
  if (idx === -1) return { limit: parseInt(extra, 10) || 20, game: null };
  return { limit: parseInt(extra.slice(0, idx), 10) || 20, game: extra.slice(idx + 1) };
}

async function handlePlacements(interaction, page = 0, extraEncoded = null) {
  let limit = 20;
  let game = null;
  if (extraEncoded != null) {
    const parsed = parsePlacementsExtra(extraEncoded);
    limit = parsed.limit;
    game = parsed.game;
  } else if (interaction.options) {
    limit = Math.min(Math.max(interaction.options.getInteger('limit') || 20, 1), 30);
    game = interaction.options.getString('game');
  }
  try {
    const payload = await buildPlacementsPage(interaction, page, limit, game);
    if (payload.content) {
      await interaction.editReply(payload).catch(() => {});
      return;
    }
    await interaction.editReply(payload).catch(() => {});
  } catch (error) {
    console.error('placements error:', error);
    await interaction.editReply('❌ Failed to fetch placements.').catch(() => {});
  }
}

async function handlePlacementsPaginated(interaction, page, extra) {
  try {
    const { limit, game } = parsePlacementsExtra(extra || '');
    const payload = await buildPlacementsPage(interaction, page, limit, game);
    await interaction.update(payload).catch(() => {});
  } catch (error) {
    await interaction.update({ content: '❌ Error.', embeds: [], components: [] }).catch(() => {});
  }
}

module.exports = {
  placementsCommand,
  handlePlacements,
  handlePlacementsPaginated
};
