const { REST, Routes } = require('discord.js');
const { discordToken, discordClientId, discordGuildId } = require('./config');

const {
  prosTotalCommand,
  prosListCommand,
  proInfoCommand
} = require('./commands/pros');
const {
  teamsCommand,
  teamInfoCommand
} = require('./commands/teams');
const { merchCommand } = require('./commands/merch');
const { newsCommand } = require('./commands/news');
const { videosCommand } = require('./commands/videos');
const { placementsCommand } = require('./commands/placements');

const commands = [
  prosTotalCommand,
  prosListCommand,
  proInfoCommand,
  teamsCommand,
  teamInfoCommand,
  merchCommand,
  newsCommand,
  videosCommand,
  placementsCommand
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(discordToken);

  try {
    console.log('Started refreshing application (/) commands...');

    if (discordGuildId) {
      await rest.put(
        Routes.applicationGuildCommands(discordClientId, discordGuildId),
        { body: commands }
      );
      console.log('Successfully reloaded guild (dev) application (/) commands.');
    } else {
      await rest.put(
        Routes.applicationCommands(discordClientId),
        { body: commands }
      );
      console.log('Successfully reloaded global application (/) commands.');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

registerCommands();

