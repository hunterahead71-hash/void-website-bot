const http = require('http');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes
} = require('discord.js');
const { discordToken, discordClientId, discordGuildId } = require('./config');

// Pros Commands
const {
  handleProsTotal,
  handleProsList,
  handleProInfo,
  handleOpsInfo,
  prosTotalCommand,
  prosListCommand,
  proInfoCommand,
  opsInfoCommand
} = require('./commands/pros');

// Teams Commands
const {
  handleTeams,
  handleTeamInfo,
  teamsCommand,
  teamInfoCommand
} = require('./commands/teams');

// Other Existing Commands
const { handleMerch, merchCommand } = require('./commands/merch');
const { handleNews, newsCommand } = require('./commands/news');
const { handleVideos, videosCommand } = require('./commands/videos');
const { handlePlacements, placementsCommand } = require('./commands/placements');

// Advanced Commands
const {
  handleUptime,
  handleStatus,
  handleStats,
  handlePing,
  handleAdvancedStats,
  uptimeCommand,
  statusCommand,
  statsCommand,
  pingCommand,
  advancedStatsCommand
} = require('./commands/advanced');

// Help Command
const { helpCommand, handleHelp } = require('./commands/help');

// Live Commands
const {
  gamesCommand,
  latestCommand,
  topPlacementsCommand,
  randomProCommand,
  handleGames,
  handleLatest,
  handleTopPlacements,
  handleRandomPro
} = require('./commands/liveCommands');

// NEW: Socials Command
const { 
  socialsCommand, 
  handleSocials, 
  handleSocialsPaginated,
  handleCopyAllLinks,
  handleCopySingleLink,
  handleInviteBot 
} = require('./commands/socials');

// NEW: Latest Video Command
const { 
  latestVideoCommand, 
  handleLatestVideo, 
  handleRefreshLatest 
} = require('./commands/latestVideo');

// NEW: Moderation Commands
const { 
  kickCommand, 
  banCommand, 
  timeoutCommand, 
  warnCommand, 
  clearCommand,
  handleKick, 
  handleBan, 
  handleTimeout, 
  handleWarn, 
  handleClear,
  handleViewWarnings 
} = require('./commands/moderation');

// Utilities
const { parsePaginationCustomId } = require('./utils/pagination');
const {
  handleProsListPaginated,
  handleOpsInfoPaginated,
  replyWithProDetail,
  replyWithOpsDetail
} = require('./commands/pros');
const { handleMerchPaginated } = require('./commands/merch');
const { handleTeamsPaginated } = require('./commands/teams');
const { handleNewsPaginated } = require('./commands/news');
const { handlePlacementsPaginated } = require('./commands/placements');
const { handleVideosPaginated } = require('./commands/videos');

// Create HTTP server for Render health checks
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      bot: client.user?.tag || 'starting',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`✅ Health check server listening on port ${PORT}`);
});

// Command registration function
async function registerCommands() {
  const commands = [
    // Pros Commands
    prosTotalCommand,
    prosListCommand,
    proInfoCommand,
    opsInfoCommand,
    
    // Teams Commands
    teamsCommand,
    teamInfoCommand,
    
    // Content Commands
    merchCommand,
    newsCommand,
    videosCommand,
    placementsCommand,
    
    // Advanced Commands
    uptimeCommand,
    statusCommand,
    statsCommand,
    pingCommand,
    advancedStatsCommand,
    
    // Utility Commands
    helpCommand,
    gamesCommand,
    latestCommand,
    topPlacementsCommand,
    randomProCommand,
    
    // NEW: Socials Command
    socialsCommand,
    
    // NEW: Latest Video Command
    latestVideoCommand,
    
    // NEW: Moderation Commands
    kickCommand,
    banCommand,
    timeoutCommand,
    warnCommand,
    clearCommand
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(discordToken);

  try {
    console.log('🔄 Started refreshing application (/) commands...');

    if (discordGuildId) {
      // Register to specific guild (instant updates)
      await rest.put(
        Routes.applicationGuildCommands(discordClientId, discordGuildId),
        { body: commands }
      );
      console.log(`✅ Successfully registered ${commands.length} guild commands to server ${discordGuildId}`);
    } else {
      // Register globally (can take up to 1 hour)
      await rest.put(
        Routes.applicationCommands(discordClientId),
        { body: commands }
      );
      console.log(`✅ Successfully registered ${commands.length} global commands (may take up to 1 hour to appear)`);
    }
    
    console.log('📝 Registered commands:', commands.map(c => c.name).join(', '));
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    if (error.code === 50001) {
      console.error('⚠️ Missing Access - Make sure the bot has been invited with "applications.commands" scope');
    }
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.once(Events.ClientReady, async c => {
  console.log(`✅ Void Website Bot logged in as ${c.user.tag}`);
  console.log(`📊 Bot is ready in ${c.guilds.cache.size} server(s)`);
  console.log(`📋 Total commands: ${c.application.commands.cache.size}`);
  
  // Register slash commands automatically
  await registerCommands();
});

client.on(Events.Error, error => {
  console.error('❌ Discord client error:', error);
});

client.on(Events.Warn, warning => {
  console.warn('⚠️ Discord warning:', warning);
});

client.on(Events.InteractionCreate, async interaction => {
  const startTime = Date.now();

  // ==================== BUTTON HANDLERS ====================
  if (interaction.isButton()) {
    const id = interaction.customId || '';
    
    try {
      // Existing pagination buttons
      if (id.startsWith('pag:')) {
        const { cmd, page, extra } = parsePaginationCustomId(id);
        if (cmd === 'pros_list') return await handleProsListPaginated(interaction, page, extra);
        if (cmd === 'ops_info') return await handleOpsInfoPaginated(interaction, page);
        if (cmd === 'merch') return await handleMerchPaginated(interaction, page, extra);
        if (cmd === 'teams') return await handleTeamsPaginated(interaction, page, extra);
        if (cmd === 'news') return await handleNewsPaginated(interaction, page, extra);
        if (cmd === 'placements') return await handlePlacementsPaginated(interaction, page, extra);
        if (cmd === 'videos') return await handleVideosPaginated(interaction, page, extra);
      }
      
      // Back buttons
      if (id.startsWith('back:')) {
        const parts = id.slice(5).split(':');
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const extra = (parts[2] || '').replace(/_/g, ' ');
        if (cmd === 'pros_list') return await handleProsListPaginated(interaction, page, extra);
        if (cmd === 'ops_info') return await handleOpsInfoPaginated(interaction, page);
      }
      
      // NEW: Socials pagination
      if (id.startsWith('socials_prev_') || id.startsWith('socials_next_')) {
        const direction = id.includes('prev') ? 'prev' : 'next';
        return await handleSocialsPaginated(interaction, direction);
      }
      
      // NEW: Socials copy all links
      if (id === 'socials_copy_all') {
        return await handleCopyAllLinks(interaction);
      }
      
      // NEW: Socials invite bot
      if (id === 'socials_invite_bot') {
        return await handleInviteBot(interaction);
      }
      
      // NEW: Socials copy single link
      if (id.startsWith('socials_copy_')) {
        const platform = id.replace('socials_copy_', '');
        return await handleCopySingleLink(interaction, platform);
      }
      
      // NEW: Latest video refresh
      if (id.startsWith('refresh_latest_')) {
        const platform = id.split('_')[2];
        return await handleRefreshLatest(interaction, platform);
      }
      
      // NEW: Share button (just ephemeral response)
      if (id.startsWith('share_')) {
        await interaction.reply({ 
          content: '🔗 Share this content with friends!', 
          ephemeral: true 
        });
        return;
      }
      
      // NEW: Video pagination
      if (id.startsWith('videos_page_')) {
        const parts = id.split('_');
        const page = parseInt(parts[2], 10);
        const limit = parts[3];
        const longformOnly = parts[4];
        return await handleVideosPaginated(interaction, page, limit, longformOnly);
      }
      
      // NEW: Moderation confirmations (these are handled within the command functions)
      if (id.startsWith('confirm_kick_') || 
          id.startsWith('confirm_ban_') || 
          id.startsWith('confirm_timeout_') || 
          id === 'cancel_mod_action') {
        // These are handled in the moderation command functions
        // We don't process them here to avoid conflicts
        return;
      }
      
      // NEW: View warnings
      if (id.startsWith('warnings_view_')) {
        const userId = id.split('_')[2];
        return await handleViewWarnings(interaction, userId);
      }
      
      // NEW: DM warning
      if (id.startsWith('dm_warning_')) {
        // This would need implementation - for now just acknowledge
        await interaction.reply({ 
          content: '📨 Warning DM feature coming soon!', 
          ephemeral: true 
        });
        return;
      }
      
    } catch (err) {
      console.error('❌ Button handler error:', err);
      await interaction.reply({ 
        content: '❌ Something went wrong processing that button.', 
        ephemeral: true 
      }).catch(() => {});
    }
    return;
  }

  // ==================== SELECT MENU HANDLERS ====================
  if (interaction.isStringSelectMenu()) {
    const id = interaction.customId || '';
    
    try {
      // Pro selection menu
      if (id.startsWith('pro_sel:')) {
        const parts = id.slice(8).split(':');
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const extra = (parts[2] || '').replace(/_/g, ' ');
        const proName = interaction.values?.[0];
        if (proName) {
          await replyWithProDetail(interaction, proName, { cmd, page, extra });
        }
      } 
      // Ops selection menu
      else if (id.startsWith('ops_sel:')) {
        const parts = id.slice(8).split(':');
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const opName = interaction.values?.[0];
        if (opName) {
          await replyWithOpsDetail(interaction, opName, { cmd, page, extra: '' });
        }
      }
    } catch (err) {
      console.error('❌ Select menu error:', err);
      await interaction.reply({ 
        content: '❌ Failed to load profile.', 
        ephemeral: true 
      }).catch(() => {});
    }
    return;
  }

  // ==================== SLASH COMMAND HANDLERS ====================
  if (!interaction.isChatInputCommand()) return;

  const commandName = interaction.commandName;
  await interaction.deferReply().catch(() => {});

  try {
    switch (commandName) {
      // Pros Commands
      case 'pros_total':
        await handleProsTotal(interaction);
        break;
      case 'pros_list':
        await handleProsList(interaction);
        break;
      case 'pro_info':
        await handleProInfo(interaction);
        break;
      case 'ops_info':
        await handleOpsInfo(interaction);
        break;
      
      // Teams Commands
      case 'teams':
        await handleTeams(interaction);
        break;
      case 'team_info':
        await handleTeamInfo(interaction);
        break;
      
      // Content Commands
      case 'merch':
        await handleMerch(interaction);
        break;
      case 'news':
        await handleNews(interaction);
        break;
      case 'videos':
        await handleVideos(interaction);
        break;
      case 'placements':
        await handlePlacements(interaction);
        break;
      
      // Advanced Commands
      case 'uptime':
        await handleUptime(interaction);
        break;
      case 'status':
        await handleStatus(interaction);
        break;
      case 'stats':
        await handleStats(interaction);
        break;
      case 'ping':
        await handlePing(interaction);
        break;
      case 'advanced_stats':
        await handleAdvancedStats(interaction);
        break;
      
      // Utility Commands
      case 'help':
        await handleHelp(interaction);
        break;
      case 'games':
        await handleGames(interaction);
        break;
      case 'latest':
        await handleLatest(interaction);
        break;
      case 'top_placements':
        await handleTopPlacements(interaction);
        break;
      case 'random_pro':
        await handleRandomPro(interaction);
        break;
      
      // NEW: Socials Command
      case 'socials':
        await handleSocials(interaction);
        break;
      
      // NEW: Latest Video Command
      case 'latest-video':
        await handleLatestVideo(interaction);
        break;
      
      // NEW: Moderation Commands
      case 'kick':
        await handleKick(interaction);
        break;
      case 'ban':
        await handleBan(interaction);
        break;
      case 'timeout':
        await handleTimeout(interaction);
        break;
      case 'warn':
        await handleWarn(interaction);
        break;
      case 'clear':
        await handleClear(interaction);
        break;
      
      default:
        await interaction.editReply({ content: '❌ Unknown command.' }).catch(() => {});
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Command "${commandName}" executed in ${duration}ms`);
    
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Command "${commandName}" failed after ${duration}ms:`, err);
    
    const errorMessage = '❌ There was an error executing that command. Please try again later.';
    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: errorMessage, flags: 64 }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => {});
    }
  }
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, shutting down gracefully...');
  client.destroy();
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, shutting down gracefully...');
  client.destroy();
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

// Login to Discord
client.login(discordToken).catch(error => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});
