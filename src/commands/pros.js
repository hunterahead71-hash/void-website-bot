const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');
const { buildPaginationRow, encodeExtra } = require('../utils/pagination');

const PER_PAGE = 10;

/** True if person is a pro (game includes Fortnite). */
function isPro(person) {
  const g = (person.game || '').toLowerCase().trim();
  return g.includes('fortnite');
}

/** True if person is operations (game or role includes Management). */
function isOperations(person) {
  const g = (person.game || '').toLowerCase().trim();
  const r = (person.role || '').toLowerCase().trim();
  return g.includes('management') || r.includes('management');
}

const prosTotalCommand = new SlashCommandBuilder()
  .setName('pros_total')
  .setDescription('Show total number of pros (players) and teams.');

const prosListCommand = new SlashCommandBuilder()
  .setName('pros_list')
  .setDescription('List pros, optionally filtered by game. Use arrows to scroll pages; select a pro for full profile.')
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Filter by game (e.g. Valorant, CS2)')
      .setRequired(false)
  );

const proInfoCommand = new SlashCommandBuilder()
  .setName('pro_info')
  .setDescription('Get detailed pro info by username. Shows stats, social links, achievements.')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Username as per the pro list')
      .setRequired(true)
  );

const listProsCommand = new SlashCommandBuilder()
  .setName('list_pros')
  .setDescription('List all pros for a specific game. Use arrows to scroll; select a pro for full profile.')
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Game name (e.g. Fortnite, Valorant, CS2)')
      .setRequired(true)
  );

async function findProByName(db, name) {
  const teamsSnapshot = await db.collection('teams').get();
  for (const doc of teamsSnapshot.docs) {
    const team = convertFirestoreData(doc);
    if (team.players && Array.isArray(team.players)) {
      const player = team.players.find(p =>
        p.name && p.name.toLowerCase().includes(name.toLowerCase())
      );
      if (player) return { pro: player, teamName: team.name, source: 'team' };
    }
  }
  const ambassadorsSnapshot = await db.collection('ambassadors').get();
  for (const doc of ambassadorsSnapshot.docs) {
    const ambassador = convertFirestoreData(doc);
    if (ambassador.name && ambassador.name.toLowerCase().includes(name.toLowerCase())) {
      return { pro: ambassador, teamName: 'Ambassador', source: 'ambassador' };
    }
  }
  return null;
}

function buildProEmbed(foundPro, teamName, source, typeLabel = null) {
  const typeValue = typeLabel || (source === 'team' ? 'Team Player' : 'Ambassador');
  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${foundPro.name}`)
    .setDescription((foundPro.description || foundPro.bio || 'No bio available.').substring(0, 4096))
    .addFields(
      { name: 'Team', value: teamName, inline: true },
      { name: 'Game', value: foundPro.game || 'N/A', inline: true },
      { name: 'Role', value: foundPro.role || 'N/A', inline: true },
      { name: 'Type', value: typeValue, inline: true }
    )
    .setColor(0x8a2be2)
    .setTimestamp()
    .setFooter({ text: 'Live from Void Website' });

  if (foundPro.achievements && Array.isArray(foundPro.achievements) && foundPro.achievements.length) {
    const achievementsText = foundPro.achievements.slice(0, 10).join('\n');
    embed.addFields({
      name: '🏆 Achievements',
      value: achievementsText.length > 1024 ? achievementsText.substring(0, 1021) + '...' : achievementsText
    });
  }
  if (foundPro.stats && Array.isArray(foundPro.stats) && foundPro.stats.length) {
    const statLines = foundPro.stats
      .slice(0, 10)
      .map(s => `${s.label || 'Stat'}: ${s.value || 'N/A'}`)
      .join('\n');
    if (statLines.length > 0) {
      embed.addFields({
        name: '📊 Key Stats',
        value: statLines.length > 1024 ? statLines.substring(0, 1021) + '...' : statLines
      });
    }
  }
  const socials = [];
  const socialLinks = foundPro.socialLinks || {};
  if (socialLinks.twitter) socials.push(`[Twitter](${socialLinks.twitter})`);
  if (socialLinks.twitch) socials.push(`[Twitch](${socialLinks.twitch})`);
  if (socialLinks.youtube) socials.push(`[YouTube](${socialLinks.youtube})`);
  if (socialLinks.instagram) socials.push(`[Instagram](${socialLinks.instagram})`);
  if (socialLinks.tiktok) socials.push(`[TikTok](${socialLinks.tiktok})`);
  if (socials.length) embed.addFields({ name: '🔗 Socials', value: socials.join(' • ') });
  setThumbnailIfValid(embed, foundPro.image);
  return embed;
}

async function handleProsTotal(interaction) {
  try {
    const db = getFirestoreInstance();
    const allPros = await collectAllPros(db, null);
    const allOps = await collectAllOps(db);
    const teamsSnapshot = await db.collection('teams').get();
    const teams = teamsSnapshot.docs.map(doc => convertFirestoreData(doc));

    const embed = new EmbedBuilder()
      .setTitle('📊 Void eSports — Pros & Teams')
      .setDescription(
        `**Pros (Fortnite players):** ${allPros.length}\n**Operations (Management):** ${allOps.length}\n**Teams:** ${teams.length}`
      )
      .setColor(0x8a2be2)
      .setTimestamp()
      .setFooter({ text: 'Live from Void Website' });
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('pros_total error:', error);
    await interaction.editReply('❌ Failed to fetch pros data.');
  }
}

async function collectAllPros(db, gameFilter) {
  const allPros = [];
  const teamsSnap = await db.collection('teams').get();
  teamsSnap.docs.forEach(doc => {
    const team = convertFirestoreData(doc);
    if (team.players && Array.isArray(team.players)) {
      team.players.forEach(player => {
        if (!isPro(player)) return;
        if (!gameFilter || (player.game && player.game.toLowerCase().includes(gameFilter.toLowerCase()))) {
          allPros.push({ ...player, teamName: team.name, source: 'team' });
        }
      });
    }
  });
  const ambassadorsSnapshot = await db.collection('ambassadors').get();
  ambassadorsSnapshot.docs.forEach(doc => {
    const ambassador = convertFirestoreData(doc);
    if (!isPro(ambassador)) return;
    if (!gameFilter || (ambassador.game && ambassador.game.toLowerCase().includes(gameFilter.toLowerCase()))) {
      allPros.push({
        name: ambassador.name,
        role: ambassador.role,
        game: ambassador.game,
        image: ambassador.image,
        achievements: ambassador.achievements,
        socialLinks: ambassador.socialLinks,
        teamName: 'Ambassador',
        source: 'ambassador'
      });
    }
  });
  return allPros.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

async function collectAllOps(db) {
  const allOps = [];
  const teamsSnap = await db.collection('teams').get();
  teamsSnap.docs.forEach(doc => {
    const team = convertFirestoreData(doc);
    if (team.players && Array.isArray(team.players)) {
      team.players.forEach(player => {
        if (!isOperations(player)) return;
        allOps.push({ ...player, teamName: team.name, source: 'team' });
      });
    }
  });
  const ambassadorsSnapshot = await db.collection('ambassadors').get();
  ambassadorsSnapshot.docs.forEach(doc => {
    const ambassador = convertFirestoreData(doc);
    if (!isOperations(ambassador)) return;
    allOps.push({
      name: ambassador.name,
      role: ambassador.role,
      game: ambassador.game,
      image: ambassador.image,
      achievements: ambassador.achievements,
      socialLinks: ambassador.socialLinks,
      teamName: 'Ambassador',
      source: 'ambassador'
    });
  });
  return allOps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

const opsInfoCommand = new SlashCommandBuilder()
  .setName('ops_info')
  .setDescription('List operations/management team. Use arrows to scroll; select for full profile.');

async function handleProsList(interaction, page = 0, extraGame = null) {
  const gameFilter = extraGame !== null ? extraGame : (interaction.options && interaction.options.getString ? interaction.options.getString('game') : null);
  try {
    const db = getFirestoreInstance();
    const allPros = await collectAllPros(db, gameFilter);
    if (allPros.length === 0) {
      const msg = gameFilter ? `No pros found for **${gameFilter}**.` : 'No pros found.';
      return interaction.editReply({ content: `❌ ${msg}`, embeds: [], components: [] }).catch(() => {});
    }
    const totalPages = Math.ceil(allPros.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = allPros.slice(p * PER_PAGE, (p + 1) * PER_PAGE);

    const lines = slice.map(pro =>
      `• **${pro.name}** — ${pro.role || '—'} · ${pro.game || '—'} · ${pro.teamName || '—'}`
    );
    const embed = new EmbedBuilder()
      .setTitle(gameFilter ? `👥 Pros — ${gameFilter}` : '👥 All Pros')
      .setDescription(lines.join('\n'))
      .setColor(0x8a2be2)
      .setFooter({ text: `Page ${p + 1}/${totalPages} · ${allPros.length} total · Select below for full profile` })
      .setTimestamp();

    const components = [];
    const pagRow = buildPaginationRow('pros_list', p, totalPages, gameFilter || '');
    if (pagRow) components.push(pagRow);
    const selectOptions = slice.slice(0, 25).map(pro => ({
      label: (pro.name || 'Unknown').substring(0, 100),
      value: (pro.name || '').substring(0, 100),
      description: `${pro.role || '—'} · ${pro.teamName || '—'}`
    }));
    if (selectOptions.length) {
      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`pro_sel:pros_list:${p}:${encodeExtra(gameFilter || '')}`)
            .setPlaceholder('View full profile…')
            .addOptions(selectOptions)
        )
      );
    }
    const payload = { embeds: [embed], components };
    if (interaction.isButton?.()) await interaction.update(payload).catch(() => {});
    else await interaction.editReply(payload).catch(() => {});
  } catch (error) {
    console.error('pros_list error:', error);
    const errPayload = { content: '❌ Failed to fetch pros list.', embeds: [], components: [] };
    if (interaction.isButton?.()) await interaction.update(errPayload).catch(() => {});
    else await interaction.editReply(errPayload).catch(() => {});
  }
}

async function handleProInfo(interaction) {
  const name = interaction.options.getString('name');
  try {
    const db = getFirestoreInstance();
    const result = await findProByName(db, name);
    if (!result) {
      await interaction.editReply(`❌ No pro matching **${name}**. Try \`/pros_list\` or \`/list_pros\` to see names.`);
      return;
    }
    const embed = buildProEmbed(result.pro, result.teamName, result.source);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('pro_info error:', error);
    await interaction.editReply('❌ Failed to fetch pro info.');
  }
}

/** Called when user selects a pro from list_pros or pros_list select menu. */
async function replyWithProDetail(interaction, proName, backPayload) {
  try {
    const db = getFirestoreInstance();
    const result = await findProByName(db, proName);
    if (!result) {
      await interaction.update({ content: `❌ Pro **${proName}** not found.`, embeds: [], components: [] }).catch(() => {});
      return;
    }
    const embed = buildProEmbed(result.pro, result.teamName, result.source);
    const { ButtonBuilder, ButtonStyle } = require('discord.js');
    const backId = `back:${backPayload.cmd}:${backPayload.page}:${encodeExtra(backPayload.extra || '')}`.slice(0, 100);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(backId).setLabel('◀ Back to list').setStyle(ButtonStyle.Secondary)
    );
    await interaction.update({ content: null, embeds: [embed], components: [row] }).catch(() => {});
  } catch (error) {
    console.error('replyWithProDetail error:', error);
    await interaction.update({ content: '❌ Failed to load profile.', embeds: [], components: [] }).catch(() => {});
  }
}

/** Called when user selects an op from ops_info select menu. */
async function replyWithOpsDetail(interaction, opName, backPayload) {
  try {
    const db = getFirestoreInstance();
    const result = await findProByName(db, opName);
    if (!result) {
      await interaction.update({ content: `❌ **${opName}** not found.`, embeds: [], components: [] }).catch(() => {});
      return;
    }
    const embed = buildProEmbed(result.pro, result.teamName, result.source, 'Operations');
    const { ButtonBuilder, ButtonStyle } = require('discord.js');
    const backId = `back:${backPayload.cmd}:${backPayload.page}:${encodeExtra(backPayload.extra || '')}`.slice(0, 100);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(backId).setLabel('◀ Back to list').setStyle(ButtonStyle.Secondary)
    );
    await interaction.update({ content: null, embeds: [embed], components: [row] }).catch(() => {});
  } catch (error) {
    console.error('replyWithOpsDetail error:', error);
    await interaction.update({ content: '❌ Failed to load profile.', embeds: [], components: [] }).catch(() => {});
  }
}

async function handleOpsInfo(interaction, page = 0) {
  try {
    const db = getFirestoreInstance();
    const allOps = await collectAllOps(db);
    if (allOps.length === 0) {
      return interaction.editReply({ content: '❌ No operations/management team members found.', embeds: [], components: [] }).catch(() => {});
    }
    const totalPages = Math.ceil(allOps.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = allOps.slice(p * PER_PAGE, (p + 1) * PER_PAGE);

    const lines = slice.map(op =>
      `• **${op.name}** — ${op.role || '—'} · ${op.game || '—'} · ${op.teamName || '—'}`
    );
    const embed = new EmbedBuilder()
      .setTitle('👥 Operations / Management')
      .setDescription(lines.join('\n'))
      .setColor(0x8a2be2)
      .setFooter({ text: `Page ${p + 1}/${totalPages} · ${allOps.length} total · Select below for full profile` })
      .setTimestamp();

    const components = [];
    const pagRow = buildPaginationRow('ops_info', p, totalPages, '');
    if (pagRow) components.push(pagRow);
    const selectOptions = slice.slice(0, 25).map(op => ({
      label: (op.name || 'Unknown').substring(0, 100),
      value: (op.name || '').substring(0, 100),
      description: `${op.role || '—'} · ${op.teamName || '—'}`
    }));
    if (selectOptions.length) {
      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`ops_sel:ops_info:${p}:`)
            .setPlaceholder('View full profile…')
            .addOptions(selectOptions)
        )
      );
    }
    const payload = { embeds: [embed], components };
    if (interaction.isButton?.()) await interaction.update(payload).catch(() => {});
    else await interaction.editReply(payload).catch(() => {});
  } catch (error) {
    console.error('ops_info error:', error);
    const errPayload = { content: '❌ Failed to fetch ops list.', embeds: [], components: [] };
    if (interaction.isButton?.()) await interaction.update(errPayload).catch(() => {});
    else await interaction.editReply(errPayload).catch(() => {});
  }
}

async function handleListPros(interaction, page = 0, extraGame = null) {
  const gameFilter = extraGame !== null ? extraGame : (interaction.options && interaction.options.getString ? interaction.options.getString('game') : null);
  if (!gameFilter) {
    return interaction.editReply({ content: '❌ Please provide a game name.', embeds: [], components: [] }).catch(() => {});
  }
  try {
    const db = getFirestoreInstance();
    const allPros = await collectAllPros(db, gameFilter);
    if (allPros.length === 0) {
      return interaction.editReply({ content: `❌ No pros found for **${gameFilter}**.`, embeds: [], components: [] }).catch(() => {});
    }
    const totalPages = Math.ceil(allPros.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const slice = allPros.slice(p * PER_PAGE, (p + 1) * PER_PAGE);

    const lines = slice.map(pro =>
      `• **${pro.name}** — ${pro.role || '—'} · ${pro.teamName || '—'}`
    );
    const embed = new EmbedBuilder()
      .setTitle(`👥 ${gameFilter} Pros`)
      .setDescription(lines.join('\n'))
      .setColor(0x8a2be2)
      .setFooter({ text: `Page ${p + 1}/${totalPages} · ${allPros.length} total · Select below for full profile` })
      .setTimestamp();

    const components = [];
    const pagRow = buildPaginationRow('list_pros', p, totalPages, gameFilter);
    if (pagRow) components.push(pagRow);
    const selectOptions = slice.slice(0, 25).map(pro => ({
      label: (pro.name || 'Unknown').substring(0, 100),
      value: (pro.name || '').substring(0, 100),
      description: `${pro.role || '—'} · ${pro.teamName || '—'}`
    }));
    if (selectOptions.length) {
      components.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`pro_sel:list_pros:${p}:${encodeExtra(gameFilter)}`)
            .setPlaceholder('View full profile…')
            .addOptions(selectOptions)
        )
      );
    }
    const payload = { embeds: [embed], components };
    if (interaction.isButton?.()) await interaction.update(payload).catch(() => {});
    else await interaction.editReply(payload).catch(() => {});
  } catch (error) {
    console.error('list_pros error:', error);
    const errPayload = { content: '❌ Failed to fetch pros list.', embeds: [], components: [] };
    if (interaction.isButton?.()) await interaction.update(errPayload).catch(() => {});
    else await interaction.editReply(errPayload).catch(() => {});
  }
}

module.exports = {
  isPro,
  isOperations,
  collectAllPros,
  collectAllOps,
  prosTotalCommand,
  prosListCommand,
  proInfoCommand,
  listProsCommand,
  opsInfoCommand,
  handleProsTotal,
  handleProsList,
  handleProInfo,
  handleListPros,
  handleOpsInfo,
  replyWithProDetail,
  replyWithOpsDetail,
  handleListProsPaginated: (i, page, extra) => handleListPros(i, page, extra),
  handleProsListPaginated: (i, page, extra) => handleProsList(i, page, extra),
  handleOpsInfoPaginated: (i, page) => handleOpsInfo(i, page)
};
