const WebSocket = require('ws');

const PORT = process.env.PORT || 8080; // Use a porta do Render ou local
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map(); // Map<roomCode, Set<clients>>

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    // Recebe mensagem JSON
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'JSON inválido' }));
      return;
    }

    if (data.type === 'join') {
      const { roomCode, username } = data;
      ws.roomCode = roomCode;
      ws.username = username;

      if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
      rooms.get(roomCode).add(ws);

      // Notificar clientes da sala atualizada
      broadcastRoomUsers(roomCode);

    } else if (data.type === 'notification') {
      // Enviar notificação para todos da sala, menos o remetente
      const { roomCode, username, message } = data;
      if (!rooms.has(roomCode)) return;
      rooms.get(roomCode).forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'notification',
            from: username,
            message: message,
            timestamp: new Date().toLocaleTimeString()
          }));
        }
      });
    }
  });

  ws.on('close', () => {
    // Remover cliente da sala
    if (ws.roomCode && rooms.has(ws.roomCode)) {
      rooms.get(ws.roomCode).delete(ws);
      broadcastRoomUsers(ws.roomCode);
      if (rooms.get(ws.roomCode).size === 0) rooms.delete(ws.roomCode);
    }
  });

  function broadcastRoomUsers(roomCode) {
    if (!rooms.has(roomCode)) return;
    const users = Array.from(rooms.get(roomCode)).map(client => client.username);
    const message = JSON.stringify({ type: 'users', users });
    rooms.get(roomCode).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
});

console.log(`Servidor WebSocket rodando na porta ${PORT}`);
