// server.js - VERSÃO COM LOBBY DE SALAS

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter"); // ADAPTADOR!

const app = express();
const server = http.createServer(app);

// --- CONFIGURAÇÃO DO REDIS E ADAPTADOR ---
const redisClient = createClient({ url: process.env.REDIS_URL });
const pubClient = redisClient.duplicate();
const subClient = pubClient.duplicate();

const io = new Server(server, {
    adapter: createAdapter(pubClient, subClient) // Usando o adaptador
});

(async () => {
    try {
        await Promise.all([pubClient.connect(), subClient.connect()]);
        console.log('Clientes Pub/Sub do Redis conectados.');
    } catch (err) {
        console.error('Erro ao conectar clientes Pub/Sub do Redis:', err);
    }
})();

app.use(express.static(path.join(__dirname, 'public')));

const ROOMS_KEY = 'lol_draft_rooms'; // Chave no Redis para nossa lista de salas

// Função para transmitir a lista de salas atualizada para todos
async function broadcastRoomList() {
    const roomsJSON = await pubClient.hGetAll(ROOMS_KEY);
    const rooms = Object.values(roomsJSON).map(JSON.parse);
    io.emit('room-list-update', rooms);
}

io.on('connection', (socket) => {
    console.log('Novo jogador conectado:', socket.id);

    socket.on('get-room-list', () => {
        broadcastRoomList();
    });

    socket.on('create-room', async ({ roomName, side }) => {
        const roomId = `room_${Math.random().toString(36).substr(2, 9)}`;
        const room = {
            id: roomId,
            name: roomName,
            players: { [side]: socket.id },
            gameState: { /* ... estado inicial do jogo ... */ }
        };
        await pubClient.hSet(ROOMS_KEY, roomId, JSON.stringify(room));
        socket.join(roomId);
        socket.emit('room-created', room); 
        broadcastRoomList();
    });

    socket.on('join-room', async ({ roomId, side }) => {
        const roomJSON = await pubClient.hGet(ROOMS_KEY, roomId);
        if (!roomJSON) return; // Sala não existe mais

        const room = JSON.parse(roomJSON);
        if (room.players[side]) return; // Lado já ocupado

        room.players[side] = socket.id;
        
        // Se a sala está cheia, o jogo começa
        if (room.players.blue && room.players.red) {
            await pubClient.hDel(ROOMS_KEY, roomId); // Remove da lista de salas abertas
            
            // Inicia o estado do jogo
            room.gameState = {
                blueTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
                redTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
                blueScore: 0, redScore: 0, turn: 0,
                pickedChampions: [],
                draftOrder: ['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red']
            };
            
            await pubClient.set(`game:${roomId}`, JSON.stringify(room));
            
            socket.join(roomId);
            io.to(roomId).emit('game-start', room);
            
        } else { // Se ainda falta um jogador
             await pubClient.hSet(ROOMS_KEY, roomId, JSON.stringify(room));
             socket.join(roomId);
        }
        broadcastRoomList();
    });
    
    // As outras lógicas (champion-pick, etc.) agora precisam do contexto do jogo
    // ... vamos simplificar por agora e adicionar em seguida se necessário.
});

server.listen(process.env.PORT || 3000, () => {
    console.log(`Servidor rodando na porta ${process.env.PORT || 3000}`);
});