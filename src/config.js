const dotenv = require('dotenv');
dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalJson(name) {
  const raw = process.env[name];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Don't crash the bot; surface clear diagnostics in logs and /status.
    console.error(`❌ Failed to parse ${name} as JSON. If you pasted a service account, ensure it is valid JSON on ONE line.`);
    console.error(e);
    return null;
  }
}

// Real Void website Firebase config (same as the live site – no service account needed for read)
const defaultFirebaseConfig = {
  apiKey: 'AIzaSyDqaPyYEv7PE34Njb1w8VFXdeU8UulCXmw',
  authDomain: 'transcend-application-bot.firebaseapp.com',
  databaseURL: 'https://transcend-application-bot-default-rtdb.firebaseio.com/',
  projectId: 'transcend-application-bot',
  storageBucket: 'transcend-application-bot.firebasestorage.app',
  messagingSenderId: '748353091728',
  appId: '1:748353091728:web:af973e8bec34c81f2e8015'
};

function getFirebaseConfig() {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY) {
    return {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
      databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '748353091728',
      appId: process.env.FIREBASE_APP_ID || '1:748353091728:web:af973e8bec34c81f2e8015'
    };
  }
  return defaultFirebaseConfig;
}

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: process.env.DISCORD_GUILD_ID || null,
  /** Role ID that can use /advanced_stats. Set in Render as ADMIN_ROLE_ID. */
  adminRoleId: process.env.ADMIN_ROLE_ID || null,

  firebaseConfig: getFirebaseConfig(),
  firebaseServiceAccount: optionalJson('FIREBASE_SERVICE_ACCOUNT'),

  youtubeApiKey: process.env.YOUTUBE_API_KEY || null,
  youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || null
};

