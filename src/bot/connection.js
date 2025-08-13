import WebSocket from 'ws';
import { twitch } from '../config/env.js';
import { log, error } from '../utils/logger.js';

const TWITCH_IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';

export function connect(onMessage, onOpen) {
  const ws = new WebSocket(TWITCH_IRC_URL);

  ws.on('open', () => {
    ws.send('CAP REQ :twitch.tv/tags'); // Solicita tags IRC
    ws.send(`PASS ${twitch.oauthToken}`);
    ws.send(`NICK ${twitch.username}`);
    ws.send(`JOIN #${twitch.channel}`);
    log(`Conectado ao canal #${twitch.channel} como ${twitch.username}`);
    if (onOpen) onOpen(ws);
  });

  ws.on('message', async (data) => {
    await onMessage(data, ws);
  });

  ws.on('close', () => {
    error('Desconectado do servidor IRC da Twitch. Tentando reconectar em 5s...');
    setTimeout(() => connect(onMessage, onOpen), 5000);
  });

  ws.on('error', (err) => {
    error('Erro na conexão:', err);
  });

  return ws;
}
