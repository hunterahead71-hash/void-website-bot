const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MAX_CUSTOM_ID_LENGTH = 100;
const PREFIX = 'pag:';

function encodeExtra(str) {
  if (!str || str.length === 0) return '';
  // Replace special characters and limit length
  return String(str)
    .slice(0, 30) // Shorter to leave room for other parts
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
}

function decodeExtra(str) {
  return str ? String(str).replace(/_/g, ' ') : '';
}

/**
 * Build Prev/Next row for pagination.
 * @param {string} cmd - Command name (e.g. pros_list, merch)
 * @param {number} page - Current 0-based page
 * @param {number} totalPages - Total pages
 * @param {string} [extra] - Optional extra data (e.g. game name)
 * @returns {ActionRowBuilder|null}
 */
function buildPaginationRow(cmd, page, totalPages, extra = '') {
  if (totalPages <= 1) return null;
  
  const extraEnc = encodeExtra(extra);
  
  // Ensure we don't exceed Discord's limit
  const basePrev = `${PREFIX}${cmd}:${page - 1}:${extraEnc}`;
  const baseNext = `${PREFIX}${cmd}:${page + 1}:${extraEnc}`;
  
  const prevId = basePrev.length > MAX_CUSTOM_ID_LENGTH 
    ? basePrev.substring(0, MAX_CUSTOM_ID_LENGTH) 
    : basePrev;
    
  const nextId = baseNext.length > MAX_CUSTOM_ID_LENGTH 
    ? baseNext.substring(0, MAX_CUSTOM_ID_LENGTH) 
    : baseNext;

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
  
  const withoutPrefix = customId.slice(PREFIX.length);
  const parts = withoutPrefix.split(':');
  
  // Handle malformed IDs gracefully
  if (parts.length < 2) return null;
  
  const cmd = parts[0];
  const page = parseInt(parts[1], 10);
  const extra = parts.length > 2 ? decodeExtra(parts.slice(2).join(':')) : '';
  
  // Validate page is a number
  if (isNaN(page)) return null;
  
  return { cmd, page, extra };
}

module.exports = {
  buildPaginationRow,
  parsePaginationCustomId,
  PREFIX,
  encodeExtra,
  decodeExtra
};
