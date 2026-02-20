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

module.exports = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: process.env.DISCORD_GUILD_ID || null,

  // Firebase (your DB). If you're trying to read the *Void website* DB, you must know its project ID
  // (or have its public API/config + open read rules or an API endpoint). A new Firebase project will NOT contain their data.
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || null,
  // Optional: Firebase Admin Service Account (JSON from Firebase Console -> Service Accounts)
  firebaseServiceAccount: optionalJson('FIREBASE_SERVICE_ACCOUNT'),
  // Optional: used only for diagnostics in /status (to tell you if you're connected to the expected website DB)
  expectedWebsiteFirebaseProjectId: process.env.EXPECTED_WEBSITE_FIREBASE_PROJECT_ID || null,

  // YouTube API (for videos)
  youtubeApiKey: process.env.YOUTUBE_API_KEY || null,
  youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || null
};

