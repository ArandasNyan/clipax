import { connect } from './bot/connection.js';
import { handleMessage } from './bot/messageHandler.js';
import { twitch } from './config/env.js';
import { error } from './utils/logger.js';

if (!twitch.username || !twitch.oauthToken || !twitch.channel) {
  error('Configure TWITCH_USERNAME, TWITCH_OAUTH_TOKEN e TWITCH_CHANNEL no .env');
  process.exit(1);
}

connect(handleMessage);
