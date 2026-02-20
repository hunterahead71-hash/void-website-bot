const http = require('http');
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} = require('discord.js');
const { discordToken } = require('./config');

const {
  handleProsTotal,
  handleProsList,
  handleProInfo
} = require('./commands/pros');
const {
  handleTeams,
  handleTeamInfo
} = require('./commands/teams');
const { handleMerch } = require('./commands/merch');
const { handleNews } = require('./commands/news');
const { handleVideos } = require('./commands/videos');
const { handlePlacements } = require('./commands/placements');

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

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, c => {
  console.log(`✅ Void Website Bot logged in as ${c.user.tag}`);
  console.log(`📊 Bot is ready in ${c.guilds.cache.size} server(s)`);
});

client.on(Events.Error, error => {
  console.error('❌ Discord client error:', error);
});

client.on(Events.Warn, warning => {
  console.warn('⚠️ Discord warning:', warning);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const startTime = Date.now();
  const commandName = interaction.commandName;

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
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
    const duration = Date.now() - startTime;
    console.log(`✅ Command "${commandName}" executed in ${duration}ms`);
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`❌ Command "${commandName}" failed after ${duration}ms:`, err);
    
    const errorMessage = 'There was an error executing that command. Please try again later.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
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

