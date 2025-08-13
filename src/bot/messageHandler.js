// Hierarquia de permissões
const PERMISSION_LEVELS = ['regular', 'vip', 'sub', 'mod', 'streamer'];

// Função para extrair permissões do usuário a partir das tags IRC
function getUserPermissions(message, user) {
  let tags = {};
  if (message.startsWith('@')) {
    const tagPart = message.split(' ', 1)[0].slice(1);
    tagPart.split(';').forEach((kv) => {
      const [k, v] = kv.split('=');
      tags[k] = v;
    });
  }
  const perms = [];
  if (user.toLowerCase() === twitch.username.toLowerCase()) perms.push('streamer');
  if (tags.badges) {
    if (/broadcaster\//.test(tags.badges)) perms.push('streamer');
    if (/moderator\//.test(tags.badges)) perms.push('mod');
    if (/vip\//.test(tags.badges)) perms.push('vip');
    if (/subscriber\//.test(tags.badges)) perms.push('sub');
  }
  if (perms.length === 0) perms.push('regular');
  return perms;
}

// Função para checar se o usuário tem permissão suficiente para o comando
function hasPermission(userPerms, commandPerms) {
  if (!commandPerms || commandPerms.length === 0) return true;
  // Pega o maior nível do usuário
  const userLevel = Math.max(...userPerms.map(p => PERMISSION_LEVELS.indexOf(p)));
  // Pega o menor nível exigido pelo comando
  const cmdLevel = Math.min(...commandPerms.map(p => PERMISSION_LEVELS.indexOf(p)));
  return userLevel >= cmdLevel;
}

import { twitch } from '../config/env.js';
import { log } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsDir = path.join(__dirname, 'commands');


const defaultCommands = {};
const aliasMap = {};
let commandsLoaded = false;

async function loadCommandsRecursivelyAsync(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await loadCommandsRecursivelyAsync(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const fileUrl = pathToFileURL(fullPath).href;
      const cmd = await import(fileUrl);
      const command = cmd.default || cmd;
      if (command && command.name) {
        const cmdName = command.name.toLowerCase().trim();
        defaultCommands[cmdName] = command;
        if (Array.isArray(command.aliases)) {
          command.aliases.forEach((alias) => {
            aliasMap[alias.toLowerCase().trim()] = cmdName;
          });
        }
      }
  }
  }
}

// Carrega comandos antes de processar mensagens
const commandsPromise = loadCommandsRecursivelyAsync(commandsDir).then(() => {
  commandsLoaded = true;
  log('[DEBUG] Comandos carregados:', Object.keys(defaultCommands));
});

export async function handleMessage(data, ws) {
  const message = data.toString();
  log('[DEBUG IRC]', message);
  const match = message.match(/^:(\w+)!.* PRIVMSG #\w+ :(.+)$/m);

  if (match) {
    if (!commandsLoaded) await commandsPromise;
    const message = data.toString();
    log('[DEBUG IRC]', message);
    const match = message.match(/^:(\w+)!.* PRIVMSG #\w+ :(.+)$/m);
  
    if (match) {
      const [_, user, text] = match;
      const botMention = `@${twitch.username.toLowerCase()}`;
      const msgLower = text.trim().toLowerCase();

      // Se mencionar só o bot
      if (msgLower === botMention) {
        ws.send(`PRIVMSG #${twitch.channel} :Olá, @${user}! Como posso ajudar?`);
        log(`Mencionado por ${user}`);
        return;
      }

      // Se mencionar o bot seguido de comando
      if (msgLower.startsWith(botMention + ' ')) {
        const afterMention = text.trim().slice(botMention.length).trim();
        if (afterMention.length > 0) {
          const [cmdRaw, ...args] = afterMention.split(' ');
          const cmd = cmdRaw.trim().toLowerCase();
          let command = defaultCommands[cmd];
          if (!command && aliasMap[cmd]) {
            command = defaultCommands[aliasMap[cmd]];
          }
          if (command) {
            const userPerms = getUserPermissions(message, user);
            log('[DEBUG] Encontrado comando via menção:', cmd, 'userPerms:', userPerms, 'commandPerms:', command.permissions);
            if (hasPermission(userPerms, command.permissions)) {
              log(`Executando comando via menção: ${cmd} (usuário: ${user})`);
              try {
                await command.execute({ user, args, ws });
                log('[DEBUG] Comando executado com sucesso:', cmd);
              } catch (err) {
                log(`Erro ao executar comando via menção: ${cmd}:`, err);
              }
            } else {
              log('[DEBUG] Permissão insuficiente para comando via menção:', cmd, 'userPerms:', userPerms, 'commandPerms:', command.permissions);
            }
          }
          // Se não existir comando, apenas ignore (não faz nada)
        }
        return;
      }

      // Comando tradicional (prefix: "!")
      if (text.startsWith('!')) {
        const [cmdRaw, ...args] = text.trim().slice(1).split(' ');
        const cmd = cmdRaw.trim().toLowerCase();
        let command = defaultCommands[cmd];
        if (!command && aliasMap[cmd]) {
          command = defaultCommands[aliasMap[cmd]];
        }
        if (command) {
          const userPerms = getUserPermissions(message, user);
          log('[DEBUG] Encontrado comando prefixado:', cmd, 'userPerms:', userPerms, 'commandPerms:', command.permissions);
          if (hasPermission(userPerms, command.permissions)) {
            log(`Executando comando: !${cmd} (usuário: ${user})`);
            try {
              await command.execute({ user, args, ws });
              log('[DEBUG] Comando executado com sucesso:', cmd);
            } catch (err) {
              log(`Erro ao executar comando !${cmd}:`, err);
            }
          } else {
            log('[DEBUG] Permissão insuficiente para comando prefixado:', cmd, 'userPerms:', userPerms, 'commandPerms:', command.permissions);
          }
        }
        // Se não existir comando, apenas ignore (não faz nada)
      }
    }
  }
}
