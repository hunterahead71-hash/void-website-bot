const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MAX_CUSTOM_ID_LENGTH = 100;
const PREFIX = 'pag:';

function encodeExtra(str) {
  if (!str || str.length === 0) return '';
  return String(str).slice(0, 50).replace(/[:|]/g, '_');
}

function decodeExtra(str) {
  return str ? String(str).replace(/_/g, ' ') : '';
}

/**
 * Build Prev/Next row for pagination.
 * @param {string} cmd - Command name (e.g. list_pros, merch)
 * @param {number} page - Current 0-based page
 * @param {number} totalPages - Total pages
 * @param {string} [extra] - Optional extra data (e.g. game name)
 * @returns {ActionRowBuilder|null}
 */
function buildPaginationRow(cmd, page, totalPages, extra = '') {
  if (totalPages <= 1) return null;
  const extraEnc = encodeExtra(extra);
  const base = `${PREFIX}${cmd}:`;
  const prevId = `${base}${page - 1}:${extraEnc}`.slice(0, MAX_CUSTOM_ID_LENGTH);
  const nextId = `${base}${page + 1}:${extraEnc}`.slice(0, MAX_CUSTOM_ID_LENGTH);

  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(prevId)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(nextId)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
  return row;
}

function parsePaginationCustomId(customId) {
  if (!customId || !customId.startsWith(PREFIX)) return null;
  const parts = customId.slice(PREFIX.length).split(':');
  const cmd = parts[0];
  const page = parseInt(parts[1], 10);
  const extra = decodeExtra(parts[2] || '');
  return { cmd, page, extra };
}

module.exports = {
  buildPaginationRow,
  parsePaginationCustomId,
  PREFIX,
  encodeExtra,
  decodeExtra
};
