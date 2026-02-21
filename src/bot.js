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

const {
  handleProsTotal,
  handleProsList,
  handleProInfo,
  // handleListPros removed
  handleOpsInfo,
  prosTotalCommand,
  prosListCommand,
  proInfoCommand,
  // listProsCommand removed
  opsInfoCommand
} = require('./commands/pros');
const {
  handleTeams,
  handleTeamInfo,
  teamsCommand,
  teamInfoCommand
} = require('./commands/teams');
const { handleMerch, merchCommand } = require('./commands/merch');
const { handleNews, newsCommand } = require('./commands/news');
const { handleVideos, videosCommand } = require('./commands/videos');
const { handlePlacements, placementsCommand } = require('./commands/placements');
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
const { helpCommand, handleHelp } = require('./commands/help');
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
  console.log(`Health check server listening on port ${PORT}`);
});

// Command registration function
async function registerCommands() {
  const commands = [
    prosTotalCommand,
    prosListCommand,
    proInfoCommand,
    // listProsCommand removed
    opsInfoCommand,
    teamsCommand,
    teamInfoCommand,
    merchCommand,
    newsCommand,
    videosCommand,
    placementsCommand,
    uptimeCommand,
    statusCommand,
    statsCommand,
    pingCommand,
    advancedStatsCommand,
    helpCommand,
    gamesCommand,
    latestCommand,
    topPlacementsCommand,
    randomProCommand
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
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
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

  // Button: pagination or back
  if (interaction.isButton()) {
    const id = interaction.customId || '';
    try {
      if (id.startsWith('pag:')) {
        const { cmd, page, extra } = parsePaginationCustomId(id);
        // handleListProsPaginated removed
        if (cmd === 'pros_list') return await handleProsListPaginated(interaction, page, extra);
        if (cmd === 'ops_info') return await handleOpsInfoPaginated(interaction, page);
        if (cmd === 'merch') return await handleMerchPaginated(interaction, page, extra);
        if (cmd === 'teams') return await handleTeamsPaginated(interaction, page, extra);
        if (cmd === 'news') return await handleNewsPaginated(interaction, page, extra);
        if (cmd === 'placements') return await handlePlacementsPaginated(interaction, page, extra);
        if (cmd === 'videos') return await handleVideosPaginated(interaction, page, extra);
      }
      if (id.startsWith('back:')) {
        const parts = id.slice(5).split(':');
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const extra = (parts[2] || '').replace(/_/g, ' ');
        // handleListProsPaginated removed
        if (cmd === 'pros_list') return await handleProsListPaginated(interaction, page, extra);
        if (cmd === 'ops_info') return await handleOpsInfoPaginated(interaction, page);
      }
    } catch (err) {
      console.error('Button handler error:', err);
      await interaction.update({ content: '❌ Something went wrong.', embeds: [], components: [] }).catch(() => {});
    }
    return;
  }

  // Select menu: pro or ops detail from list
  if (interaction.isStringSelectMenu()) {
    const id = interaction.customId || '';
    if (id.startsWith('pro_sel:')) {
      try {
        const parts = id.slice(8).split(':');
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const extra = (parts[2] || '').replace(/_/g, ' ');
        const proName = interaction.values?.[0];
        if (proName) {
          await replyWithProDetail(interaction, proName, { cmd, page, extra });
        }
      } catch (err) {
        console.error('Select menu error:', err);
        await interaction.update({ content: '❌ Failed to load profile.', embeds: [], components: [] }).catch(() => {});
      }
    } else if (id.startsWith('ops_sel:')) {
      try {
        const parts = id.slice(8).split(':');
        const cmd = parts[0];
        const page = parseInt(parts[1], 10) || 0;
        const opName = interaction.values?.[0];
        if (opName) {
          await replyWithOpsDetail(interaction, opName, { cmd, page, extra: '' });
        }
      } catch (err) {
        console.error('Ops select menu error:', err);
        await interaction.update({ content: '❌ Failed to load profile.', embeds: [], components: [] }).catch(() => {});
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const commandName = interaction.commandName;
  await interaction.deferReply().catch(() => {});

  try {
    switch (commandName) {
      case 'pros_total':
        await handleProsTotal(interaction);
        break;
      case 'pros_list':
        await handleProsList(interaction);
        break;
      case 'pro_info':
        await handleProInfo(interaction);
        break;
      // case 'list_pros' removed
      case 'ops_info':
        await handleOpsInfo(interaction);
        break;
      case 'teams':
        await handleTeams(interaction);
        break;
      case 'team_info':
        await handleTeamInfo(interaction);
        break;
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
      default:
        await interaction.editReply({ content: 'Unknown command.' }).catch(() => interaction.reply({ content: 'Unknown command.', flags: 64 }).catch(() => {}));
    }
    const duration = Date.now() - startTime;
    console.log(`✅ Command "${commandName}" executed in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Command "${commandName}" failed after ${duration}ms:`, err);
    
    const errorMessage = 'There was an error executing that command. Please try again later.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: errorMessage, flags: 64 }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMessage, flags: 64 }).catch(() => {});
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  client.destroy();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  client.destroy();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

client.login(discordToken).catch(error => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});
