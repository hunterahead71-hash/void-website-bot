const dotenv = require('dotenv');
dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: process.env.DISCORD_GUILD_ID || null,
  // Firebase config (same as website)
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'transcend-application-bot',
  firebaseApiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDqaPyYEv7PE34Njb1w8VFXdeU8UulCXmw',
  firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || 'transcend-application-bot.firebaseapp.com',
  // Optional: Firebase Admin Service Account (for server-side access)
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) : null,
  // YouTube API (for videos)
  youtubeApiKey: process.env.YOUTUBE_API_KEY || null,
  youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || null
};

