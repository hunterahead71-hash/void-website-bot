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

// Pros Commands (now includes /teams)
const {
  handleTeams, // This is now /teams
  handleProsList,
  handleProInfo,
  handleOpsInfo,
  teamsCommand, // This is now /teams
  prosListCommand,
  proInfoCommand,
  opsInfoCommand
} = require('./commands/pros');

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
const { helpCommand, handleHelp, handleHelpCategory } = require('./commands/help');

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

// Socials Command
const { 
  socialsCommand, 
  handleSocials
} = require('./commands/socials');

// Latest Video Command
const { 
  latestVideoCommand, 
  handleLatestVideo, 
  handleRefreshLatest 
} = require('./commands/latestVideo');

// Moderation Commands
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
    // Teams & Pros Commands
    teamsCommand, // This is now /teams
    prosListCommand,
    proInfoCommand,
    opsInfoCommand,
    
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
    
    // Socials Command
    socialsCommand,
    
    // Latest Video Command
    latestVideoCommand,
    
    // Moderation Commands
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
      await rest.put(
        Routes.applicationGuildCommands(discordClientId, discordGuildId),
        { body: commands }
      );
      console.log(`✅ Successfully registered ${commands.length} guild commands to server ${discordGuildId}`);
    } else {
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
      // Help category buttons
      if (id.startsWith('help_')) {
        if (id === 'help_all') {
          const { handleHelp } = require('./commands/help');
          return await handleHelp(interaction);
        } else {
          const category = id.replace('help_', '');
          return await handleHelpCategory(interaction, category);
        }
      }
      
      // Existing pagination buttons
      if (id.startsWith('pag:')) {
        const parsed = parsePaginationCustomId(id);
        if (!parsed) {
          await interaction.reply({ content: '❌ Invalid button.', ephemeral: true });
          return;
        }
        
        const { cmd, page, extra } = parsed;
        
        // Ensure page is a valid number
        if (isNaN(page)) {
          await interaction.reply({ content: '❌ Invalid page number.', ephemeral: true });
          return;
        }
        
        if (cmd === 'pros_list') return await handleProsListPaginated(interaction, page, extra);
        if (cmd === 'ops_info') return await handleOpsInfoPaginated(interaction, page);
        if (cmd === 'merch') return await handleMerchPaginated(interaction, page, extra);
        if (cmd === 'news') return await handleNewsPaginated(interaction, page, extra);
        if (cmd === 'placements') return await handlePlacementsPaginated(interaction, page, extra);
        if (cmd === 'videos') return await handleVideosPaginated(interaction, page, extra);
        
        // Unknown command
        await interaction.reply({ content: '❌ Unknown command.', ephemeral: true });
        return;
      }
      
      // Back buttons
      if (id.startsWith('back:')) {
        const parts = id.slice(5).split(':');
        if (parts.length < 2) {
          await interaction.reply({ content: '❌ Invalid back button.', ephemeral: true });
          return;
        }
        
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const extra = parts.length > 2 ? parts.slice(2).join(':').replace(/_/g, ' ') : '';
        
        if (cmd === 'pros_list') return await handleProsListPaginated(interaction, page, extra);
        if (cmd === 'ops_info') return await handleOpsInfoPaginated(interaction, page);
        
        await interaction.reply({ content: '❌ Unknown back button.', ephemeral: true });
        return;
      }
      
      // Latest video refresh
      if (id === 'refresh_latest_youtube') {
        return await handleRefreshLatest(interaction);
      }
      
      // Share button
      if (id === 'share_youtube_latest') {
        await interaction.reply({ 
          content: '🔗 Share this video with friends!', 
          ephemeral: true 
        });
        return;
      }
      
      // Video pagination
      if (id.startsWith('videos_page_')) {
        const parts = id.split('_');
        if (parts.length < 5) {
          await interaction.reply({ content: '❌ Invalid video button.', ephemeral: true });
          return;
        }
        
        const page = parseInt(parts[2], 10);
        const limit = parts[3];
        const longformOnly = parts[4];
        
        if (isNaN(page)) {
          await interaction.reply({ content: '❌ Invalid page number.', ephemeral: true });
          return;
        }
        
        return await handleVideosPaginated(interaction, page, limit, longformOnly);
      }
      
      // Moderation confirmations - let them pass through to be handled by the command functions
      if (id.startsWith('confirm_kick_') || 
          id.startsWith('confirm_ban_') || 
          id.startsWith('confirm_timeout_') || 
          id === 'cancel_mod_action') {
        return; // These are handled in the moderation command files
      }
      
      // View warnings
      if (id.startsWith('warnings_view_')) {
        const parts = id.split('_');
        if (parts.length < 3) {
          await interaction.reply({ content: '❌ Invalid warnings button.', ephemeral: true });
          return;
        }
        
        const userId = parts[2];
        return await handleViewWarnings(interaction, userId);
      }
      
      // If we get here, it's an unhandled button
      console.log(`Unhandled button: ${id}`);
      await interaction.reply({ 
        content: '❌ This button is not working right now.', 
        ephemeral: true 
      }).catch(() => {});
      
    } catch (err) {
      console.error('❌ Button handler error:', err);
      
      // Try to reply if possible
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: '❌ Something went wrong processing that button.', 
            ephemeral: true 
          });
        } else {
          await interaction.followUp({ 
            content: '❌ Something went wrong.', 
            ephemeral: true 
          });
        }
      } catch (e) {
        console.error('Could not send error message:', e);
      }
    }
    return;
  }

  // ==================== SELECT MENU HANDLERS ====================
  if (interaction.isStringSelectMenu()) {
    const id = interaction.customId || '';
    
    try {
      if (id.startsWith('pro_sel:')) {
        const parts = id.slice(8).split(':');
        if (parts.length < 3) {
          await interaction.reply({ content: '❌ Invalid select menu.', ephemeral: true });
          return;
        }
        
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const extra = parts.length > 2 ? parts.slice(2).join(':').replace(/_/g, ' ') : '';
        const proName = interaction.values?.[0];
        
        if (proName) {
          await replyWithProDetail(interaction, proName, { cmd, page, extra });
        } else {
          await interaction.reply({ content: '❌ No pro selected.', ephemeral: true });
        }
      } else if (id.startsWith('ops_sel:')) {
        const parts = id.slice(8).split(':');
        if (parts.length < 2) {
          await interaction.reply({ content: '❌ Invalid select menu.', ephemeral: true });
          return;
        }
        
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const opName = interaction.values?.[0];
        
        if (opName) {
          await replyWithOpsDetail(interaction, opName, { cmd, page, extra: '' });
        } else {
          await interaction.reply({ content: '❌ No member selected.', ephemeral: true });
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
      // Teams & Pros Commands
      case 'teams': // This is the renamed pros_total
        await handleTeams(interaction);
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
      
      // Socials Command
      case 'socials':
        await handleSocials(interaction);
        break;
      
      // Latest Video Command
      case 'latest-video':
        await handleLatestVideo(interaction);
        break;
      
      // Moderation Commands
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

// Graceful shutdown
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
