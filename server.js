const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
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

            broadcastRoomUsers(roomCode);
        } else if (data.type === 'notification') {
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

// Se quiser servir arquivos estáticos (opcional)
app.use(express.static('public'));

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
