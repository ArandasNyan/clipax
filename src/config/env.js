import dotenv from 'dotenv';
dotenv.config();

export const twitch = {
  username: process.env.TWITCH_USERNAME,
  oauthToken: process.env.TWITCH_OAUTH_TOKEN,
  channel: process.env.TWITCH_CHANNEL,
};
