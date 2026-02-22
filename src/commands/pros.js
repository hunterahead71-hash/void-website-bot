const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getFirestoreInstance, convertFirestoreData } = require('../firebaseClient');
const { setThumbnailIfValid } = require('../utils/discordEmbeds');
const { buildPaginationRow, encodeExtra } = require('../utils/pagination');

const PER_PAGE = 10;
const CACHE_TTL_MS = 45000; // 45s cache for faster repeated commands

let _teamsAmbassadorsCache = null;
let _teamsAmbassadorsCacheTime = 0;

/** Fetch teams + ambassadors in parallel; use short-lived cache to reduce latency. */
async function getTeamsAndAmbassadors(db) {
  const now = Date.now();
  if (_teamsAmbassadorsCache && now - _teamsAmbassadorsCacheTime < CACHE_TTL_MS) {
    return _teamsAmbassadorsCache;
  }
  const [teamsSnap, ambassadorsSnap] = await Promise.all([
    db.collection('teams').get(),
    db.collection('ambassadors').get()
  ]);
  const teams = (teamsSnap.docs || []).map((d) => convertFirestoreData(d));
  const ambassadors = (ambassadorsSnap.docs || []).map((d) => convertFirestoreData(d));
  _teamsAmbassadorsCache = { teams, ambassadors };
  _teamsAmbassadorsCacheTime = now;
  return _teamsAmbassadorsCache;
}

/** Get all string values from person (any field name) and join for searching. */
function getPersonSearchText(person) {
  if (!person || typeof person !== 'object') return '';
  return Object.values(person)
    .filter((v) => typeof v === 'string')
    .join(' ')
    .toLowerCase();
}

/** True if person is a pro (Fortnite player - has game="Fortnite" AND not Management) */
function isPro(person) {
  // If they have management in role/text, they're not a pro
  const text = getPersonSearchText(person);
  if (text.includes('management') || text.includes('operations') || 
      text.includes('ceo') || text.includes('founder') || text.includes('director')) {
    return false;
  }
  
  // Check if game is explicitly Fortnite
  if (person.game && person.game.toLowerCase() === 'fortnite') return true;
  
  return false;
}

/** True if person is operations/management (role contains Management/Operations OR team is Management team) */
function isOperations(person, teamName = '') {
  const roleLower = (person.role || '').toLowerCase();
  const teamLower = (teamName || '').toLowerCase();
  const text = getPersonSearchText(person);
  
  // Check for management/operations indicators
  return (
    roleLower.includes('management') ||
    roleLower.includes('operations') ||
    roleLower.includes('admin') ||
    roleLower.includes('ceo') ||
    roleLower.includes('founder') ||
    roleLower.includes('director') ||
    roleLower.includes('manager') ||
    roleLower.includes('head of') ||
    teamLower.includes('management') ||
    teamLower.includes('operations') ||
    text.includes('management') ||
    text.includes('operations')
  );
}

const teamsCommand = new SlashCommandBuilder()
  .setName('teams')
  .setDescription('Show Void eSports teams, pros, and operations statistics.');

const prosListCommand = new SlashCommandBuilder()
  .setName('pros_list')
  .setDescription('List all Fortnite pros. Use arrows to scroll pages; select a pro for full profile.')
  .addStringOption(option =>
    option
      .setName('game')
      .setDescription('Filter by game (e.g. Fortnite, Valorant)')
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

const opsInfoCommand = new SlashCommandBuilder()
  .setName('ops_info')
  .setDescription('List operations/management team. Use arrows to scroll; select for full profile.');

async function findProByName(db, name) {
  const { teams, ambassadors } = await getTeamsAndAmbassadors(db);
  
  // Search in teams players
  for (const team of teams) {
    if (team.players && Array.isArray(team.players)) {
      const player = team.players.find(p =>
        p.name && p.name.toLowerCase().includes(name.toLowerCase())
      );
      if (player) return { pro: player, teamName: team.name, source: 'team' };
    }
  }
  
  // Search in ambassadors
  for (const ambassador of ambassadors) {
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
      { name: '🏢 Team', value: teamName, inline: true },
      { name: '🎯 Game', value: foundPro.game || 'Fortnite', inline: true },
      { name: '📋 Role', value: foundPro.role || 'Pro Player', inline: true }
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

async function handleTeams(interaction) {
  try {
    const db = getFirestoreInstance();
    const { teams, ambassadors } = await getTeamsAndAmbassadors(db);
    const allPros = collectAllProsFromData(teams, ambassadors, 'fortnite');
    const allOps = collectAllOpsFromData(teams, ambassadors);

    // Count pros per team
    const teamBreakdown = [];
    teams.forEach(team => {
      if (team.players && Array.isArray(team.players)) {
        const teamPros = team.players.filter(p => isPro(p) && !isOperations(p, team.name));
        const teamOps = team.players.filter(p => isOperations(p, team.name));
        if (teamPros.length > 0 || teamOps.length > 0) {
          teamBreakdown.push({
            name: team.name,
            pros: teamPros.length,
            ops: teamOps.length
          });
        }
      }
    });

    // Add ambassadors
    const ambassadorPros = ambassadors.filter(a => isPro(a) && !isOperations(a));
    if (ambassadorPros.length > 0) {
      teamBreakdown.push({
        name: 'Ambassadors',
        pros: ambassadorPros.length,
        ops: 0
      });
    }

    // Sort teams by name
    teamBreakdown.sort((a, b) => a.name.localeCompare(b.name));

    // Create team breakdown text
    const teamList = teamBreakdown.map(t => 
      `• **${t.name}** — ${t.pros} pro${t.pros !== 1 ? 's' : ''}${t.ops > 0 ? `, ${t.ops} op${t.ops !== 1 ? 's' : ''}` : ''}`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('📊 Void eSports — Team Statistics')
      .setDescription('**Live counts from the Void website**')
      .addFields(
        { 
          name: '📈 Overview', 
          value: `**Total Teams:** ${teams.length}\n**Total Pros:** ${allPros.length}\n**Total Operations:** ${allOps.length}`, 
          inline: false 
        },
        { 
          name: '📋 Team Breakdown', 
          value: teamList || 'No teams with players found', 
          inline: false 
        }
      )
      .setColor(0x8a2be2)
      .setTimestamp()
      .setFooter({ text: 'Live from Void Website · /pros_list to see all pros' });
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('teams error:', error);
    await interaction.editReply('❌ Failed to fetch teams data.');
  }
}

function collectAllProsFromData(teams, ambassadors, gameFilter) {
  const allPros = [];
  const seen = new Set(); // Track by name to avoid duplicates
  
  // Collect from teams
  (teams || []).forEach((team) => {
    if (team.players && Array.isArray(team.players)) {
      team.players.forEach((player) => {
        const p = player && typeof player === 'object' ? { ...player } : player;
        if (!isPro(p)) return;
        if (isOperations(p, team.name)) return;
        
        // Create unique key
        const key = `${p.name}-${team.name}`;
        if (seen.has(key)) return;
        seen.add(key);
        
        if (!gameFilter || (p.game && p.game.toLowerCase().includes(gameFilter.toLowerCase()))) {
          allPros.push({ 
            ...p, 
            teamName: team.name, 
            source: 'team',
            game: p.game || 'Fortnite'
          });
        }
      });
    }
  });
  
  // Collect from ambassadors
  (ambassadors || []).forEach((ambassador) => {
    if (!isPro(ambassador)) return;
    if (isOperations(ambassador)) return;
    
    const key = `${ambassador.name}-ambassador`;
    if (seen.has(key)) return;
    seen.add(key);
    
    if (!gameFilter || (ambassador.game && ambassador.game.toLowerCase().includes(gameFilter.toLowerCase()))) {
      allPros.push({
        name: ambassador.name,
        role: ambassador.role,
        game: ambassador.game || 'Fortnite',
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

function collectAllOpsFromData(teams, ambassadors) {
  const allOps = [];
  const seen = new Set();
  
  // Collect from teams
  (teams || []).forEach((team) => {
    if (team.players && Array.isArray(team.players)) {
      team.players.forEach((player) => {
        const p = player && typeof player === 'object' ? { ...player } : player;
        if (!isOperations(p, team.name)) return;
        
        const key = `${p.name}-${team.name}`;
        if (seen.has(key)) return;
        seen.add(key);
        
        allOps.push({ ...p, teamName: team.name, source: 'team' });
      });
    }
  });
  
  // Collect from ambassadors
  (ambassadors || []).forEach((ambassador) => {
    if (!isOperations(ambassador)) return;
    
    const key = `${ambassador.name}-ambassador`;
    if (seen.has(key)) return;
    seen.add(key);
    
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

async function collectAllPros(db, gameFilter) {
  const { teams, ambassadors } = await getTeamsAndAmbassadors(db);
  return collectAllProsFromData(teams, ambassadors, gameFilter);
}

async function collectAllOps(db) {
  const { teams, ambassadors } = await getTeamsAndAmbassadors(db);
  return collectAllOpsFromData(teams, ambassadors);
}

async function handleProsList(interaction, page = 0, extraGame = null) {
  // Ensure page is a valid number
  page = parseInt(page) || 0;
  if (page < 0) page = 0;
  
  const gameFilter = extraGame !== null ? extraGame : (interaction.options && interaction.options.getString ? interaction.options.getString('game') : 'fortnite');
  
  try {
    const db = getFirestoreInstance();
    const allPros = await collectAllPros(db, gameFilter);
    
    if (allPros.length === 0) {
      const msg = gameFilter ? `No pros found for **${gameFilter}**.` : 'No pros found.';
      
      // Check if we can update or need to reply
      if (interaction.isButton?.()) {
        await interaction.update({ content: `❌ ${msg}`, embeds: [], components: [] }).catch(() => {});
      } else {
        await interaction.editReply({ content: `❌ ${msg}`, embeds: [], components: [] }).catch(() => {});
      }
      return;
    }
    
    const totalPages = Math.ceil(allPros.length / PER_PAGE);
    // Ensure page is within bounds
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const start = p * PER_PAGE;
    const end = Math.min(start + PER_PAGE, allPros.length);
    const slice = allPros.slice(start, end);

    // Create a beautiful embed
    const embed = new EmbedBuilder()
      .setTitle(gameFilter ? `👥 Fortnite Pros` : '👥 All Pros')
      .setDescription(`**Total Pros:** ${allPros.length}\n**Showing:** ${start + 1}-${end} of ${allPros.length}`)
      .setColor(0x8a2be2)
      .setFooter({ 
        text: `Page ${p + 1}/${totalPages} · Select a pro below for full profile`,
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    // Add each pro as a field (3 per row for better layout)
    slice.forEach((pro, index) => {
      const fieldName = `${start + index + 1}. ${pro.name}`;
      const fieldValue = `**Team:** ${pro.teamName || '—'} • **Role:** ${pro.role || 'Pro Player'}`;
      embed.addFields({ name: fieldName, value: fieldValue, inline: true });
    });

    // Build components
    const components = [];
    
    // Add pagination buttons
    const pagRow = buildPaginationRow('pros_list', p, totalPages, gameFilter || '');
    if (pagRow) components.push(pagRow);
    
    // Add select menu for profiles (max 25 options)
    if (slice.length > 0) {
      const selectOptions = slice.slice(0, 25).map(pro => ({
        label: (pro.name || 'Unknown').substring(0, 100),
        value: (pro.name || '').substring(0, 100),
        description: `${pro.role || 'Pro'} · ${pro.teamName || '—'}`.substring(0, 100)
      }));
      
      if (selectOptions.length) {
        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`pro_sel:pros_list:${p}:${encodeExtra(gameFilter || '')}`)
            .setPlaceholder('🔍 View full profile...')
            .addOptions(selectOptions)
        );
        components.push(selectRow);
      }
    }
    
    const payload = { embeds: [embed], components };
    
    // Check if this is a button interaction (update) or command (editReply)
    if (interaction.isButton?.()) {
      try {
        await interaction.update(payload);
      } catch (updateError) {
        console.error('Failed to update button interaction:', updateError);
        // If update fails, try to send a new message
        try {
          await interaction.followUp(payload);
        } catch (followUpError) {
          console.error('Failed to send followup:', followUpError);
        }
      }
    } else {
      await interaction.editReply(payload).catch(() => {});
    }
  } catch (error) {
    console.error('pros_list error:', error);
    const errPayload = { content: '❌ Failed to fetch pros list.', embeds: [], components: [] };
    
    if (interaction.isButton?.()) {
      try {
        await interaction.update(errPayload);
      } catch {
        try {
          await interaction.followUp(errPayload);
        } catch {}
      }
    } else {
      await interaction.editReply(errPayload).catch(() => {});
    }
  }
}

async function handleProInfo(interaction) {
  const name = interaction.options.getString('name');
  
  try {
    const db = getFirestoreInstance();
    const result = await findProByName(db, name);
    
    if (!result) {
      await interaction.editReply(`❌ No pro matching **${name}**. Try \`/pros_list\` to see all pros.`);
      return;
    }
    
    const embed = buildProEmbed(result.pro, result.teamName, result.source);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('pro_info error:', error);
    await interaction.editReply('❌ Failed to fetch pro info.');
  }
}

async function replyWithProDetail(interaction, proName, backPayload) {
  try {
    const db = getFirestoreInstance();
    const result = await findProByName(db, proName);
    
    if (!result) {
      await interaction.update({ 
        content: `❌ Pro **${proName}** not found.`, 
        embeds: [], 
        components: [] 
      }).catch(() => {});
      return;
    }
    
    const embed = buildProEmbed(result.pro, result.teamName, result.source);
    
    // Ensure backPayload has valid values
    const cmd = backPayload.cmd || 'pros_list';
    const page = parseInt(backPayload.page) || 0;
    const extra = backPayload.extra || '';
    
    const backId = `back:${cmd}:${page}:${encodeExtra(extra)}`;
    // Truncate if too long
    const finalBackId = backId.length > 100 ? backId.substring(0, 100) : backId;
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(finalBackId)
        .setLabel('◀ Back to list')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    
    await interaction.update({ 
      content: null, 
      embeds: [embed], 
      components: [row] 
    }).catch(() => {});
  } catch (error) {
    console.error('replyWithProDetail error:', error);
    await interaction.update({ 
      content: '❌ Failed to load profile.', 
      embeds: [], 
      components: [] 
    }).catch(() => {});
  }
}

async function replyWithOpsDetail(interaction, opName, backPayload) {
  try {
    const db = getFirestoreInstance();
    const result = await findProByName(db, opName);
    
    if (!result) {
      await interaction.update({ 
        content: `❌ **${opName}** not found.`, 
        embeds: [], 
        components: [] 
      }).catch(() => {});
      return;
    }
    
    const embed = buildProEmbed(result.pro, result.teamName, result.source, 'Operations');
    
    // Ensure backPayload has valid values
    const cmd = backPayload.cmd || 'ops_info';
    const page = parseInt(backPayload.page) || 0;
    const extra = backPayload.extra || '';
    
    const backId = `back:${cmd}:${page}:${encodeExtra(extra)}`;
    // Truncate if too long
    const finalBackId = backId.length > 100 ? backId.substring(0, 100) : backId;
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(finalBackId)
        .setLabel('◀ Back to list')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    
    await interaction.update({ 
      content: null, 
      embeds: [embed], 
      components: [row] 
    }).catch(() => {});
  } catch (error) {
    console.error('replyWithOpsDetail error:', error);
    await interaction.update({ 
      content: '❌ Failed to load profile.', 
      embeds: [], 
      components: [] 
    }).catch(() => {});
  }
}

async function handleOpsInfo(interaction, page = 0) {
  // Ensure page is a valid number
  page = parseInt(page) || 0;
  if (page < 0) page = 0;
  
  try {
    const db = getFirestoreInstance();
    const allOps = await collectAllOps(db);
    
    if (allOps.length === 0) {
      const payload = { content: '❌ No operations/management team members found.', embeds: [], components: [] };
      
      if (interaction.isButton?.()) {
        await interaction.update(payload).catch(() => {});
      } else {
        await interaction.editReply(payload).catch(() => {});
      }
      return;
    }
    
    const totalPages = Math.ceil(allOps.length / PER_PAGE);
    const p = Math.max(0, Math.min(page, totalPages - 1));
    const start = p * PER_PAGE;
    const end = Math.min(start + PER_PAGE, allOps.length);
    const slice = allOps.slice(start, end);

    const embed = new EmbedBuilder()
      .setTitle('👥 Operations & Management')
      .setDescription(`**Total Members:** ${allOps.length}\n**Showing:** ${start + 1}-${end} of ${allOps.length}`)
      .setColor(0x8a2be2)
      .setFooter({ 
        text: `Page ${p + 1}/${totalPages} · Select below for full profile`,
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTimestamp();

    slice.forEach((op, index) => {
      const fieldName = `${start + index + 1}. ${op.name}`;
      const fieldValue = `**Team:** ${op.teamName || '—'} • **Role:** ${op.role || '—'}`;
      embed.addFields({ name: fieldName, value: fieldValue, inline: true });
    });

    const components = [];
    
    const pagRow = buildPaginationRow('ops_info', p, totalPages, '');
    if (pagRow) components.push(pagRow);
    
    if (slice.length > 0) {
      const selectOptions = slice.slice(0, 25).map(op => ({
        label: (op.name || 'Unknown').substring(0, 100),
        value: (op.name || '').substring(0, 100),
        description: `${op.role || '—'} · ${op.teamName || '—'}`.substring(0, 100)
      }));
      
      if (selectOptions.length) {
        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`ops_sel:ops_info:${p}:`)
            .setPlaceholder('🔍 View full profile...')
            .addOptions(selectOptions)
        );
        components.push(selectRow);
      }
    }
    
    const payload = { embeds: [embed], components };
    
    if (interaction.isButton?.()) {
      try {
        await interaction.update(payload);
      } catch (updateError) {
        console.error('Failed to update button interaction:', updateError);
        try {
          await interaction.followUp(payload);
        } catch (followUpError) {
          console.error('Failed to send followup:', followUpError);
        }
      }
    } else {
      await interaction.editReply(payload).catch(() => {});
    }
  } catch (error) {
    console.error('ops_info error:', error);
    const errPayload = { content: '❌ Failed to fetch ops list.', embeds: [], components: [] };
    
    if (interaction.isButton?.()) {
      try {
        await interaction.update(errPayload);
      } catch {
        try {
          await interaction.followUp(errPayload);
        } catch {}
      }
    } else {
      await interaction.editReply(errPayload).catch(() => {});
    }
  }
}

module.exports = {
  isPro,
  isOperations,
  collectAllPros,
  collectAllOps,
  teamsCommand,
  prosListCommand,
  proInfoCommand,
  opsInfoCommand,
  handleTeams,
  handleProsList,
  handleProInfo,
  handleOpsInfo,
  replyWithProDetail,
  replyWithOpsDetail,
  handleProsListPaginated: (i, page, extra) => handleProsList(i, page, extra),
  handleOpsInfoPaginated: (i, page) => handleOpsInfo(i, page)
};
