import { twitch } from '../../../config/env.js';

export default {
  name: 'ping',
  description: 'Responde com Pong!',
  aliases: ['pong', 'latency', 'test'],
  execute({ ws }) {
    ws.send(`PRIVMSG #${twitch.channel} :Pong!`);
  },
};
