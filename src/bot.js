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

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, c => {
  console.log(`Void Website Bot logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    switch (interaction.commandName) {
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
  } catch (err) {
    console.error('Command handler error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'There was an error executing that command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error executing that command.', ephemeral: true });
    }
  }
});

client.login(discordToken);

