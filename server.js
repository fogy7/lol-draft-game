// server.js - VERSÃO FINAL COM LOBBY E LÓGICA DE JOGO

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const app = express();
const server = http.createServer(app);

// --- CONFIGURAÇÃO DO REDIS E ADAPTADOR ---
const redisClient = createClient({ url: process.env.REDIS_URL });
const pubClient = redisClient.duplicate();
const subClient = pubClient.duplicate();

const io = new Server(server, {
    adapter: createAdapter(pubClient, subClient)
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

const ROOMS_KEY = 'lol_draft_rooms';
const GAME_PREFIX = 'game:';

async function broadcastRoomList() {
    const roomsJSON = await pubClient.hGetAll(ROOMS_KEY);
    const rooms = Object.values(roomsJSON).map(JSON.parse).filter(room => room.players && (!room.players.blue || !room.players.red));
    io.emit('room-list-update', rooms);
}

io.on('connection', (socket) => {
    console.log('Novo jogador conectado:', socket.id);

    socket.on('get-room-list', broadcastRoomList);

    socket.on('create-room', async ({ roomName, side }) => {
        const roomId = `room_${Math.random().toString(36).substr(2, 9)}`;
        const room = {
            id: roomId,
            name: roomName,
            players: { [socket.id]: { side } },
        };
        await pubClient.hSet(ROOMS_KEY, roomId, JSON.stringify(room));
        socket.join(roomId);
        socket.emit('room-created', room);
        broadcastRoomList();
    });

    socket.on('join-room', async ({ roomId, side }) => {
        const roomJSON = await pubClient.hGet(ROOMS_KEY, roomId);
        if (!roomJSON) return;

        const room = JSON.parse(roomJSON);
        const playerIds = Object.keys(room.players);
        if (playerIds.length >= 2 || Object.values(room.players).some(p => p.side === side)) return;

        room.players[socket.id] = { side };
        
        if (playerIds.length === 1) { // Agora a sala está cheia
            await pubClient.hDel(ROOMS_KEY, roomId);
            
            room.gameState = {
                blueTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
                redTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
                blueScore: 0, redScore: 0, turn: 0,
                pickedChampions: [],
                draftOrder: ['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red']
            };
            
            await pubClient.set(`${GAME_PREFIX}${roomId}`, JSON.stringify(room));
            socket.join(roomId);
            io.to(roomId).emit('game-start', room);
        }
        broadcastRoomList();
    });

    socket.on('champion-pick', async ({ roomId, champion, role }) => {
        const gameJSON = await pubClient.get(`${GAME_PREFIX}${roomId}`);
        if (!gameJSON) return;
        const room = JSON.parse(gameJSON);

        const playerSide = room.players[socket.id]?.side;
        if (!playerSide) return;

        const { gameState } = room;
        const currentTurnColor = gameState.draftOrder[gameState.turn];
        const currentTeam = playerSide === 'blue' ? gameState.blueTeam : gameState.redTeam;
        
        const isPicked = gameState.pickedChampions.some(c => c.id === champion.id);

        if (playerSide === currentTurnColor && !isPicked && currentTeam[role] === null) {
            const alliedTeam = Object.values(currentTeam).filter(c => c !== null);
            const enemyTeam = Object.values(playerSide === 'blue' ? gameState.redTeam : gameState.blueTeam).filter(c => c !== null);
            
            const score = calculatePickScore(champion, alliedTeam, enemyTeam);
            
            if(playerSide === 'blue') {
                gameState.blueTeam[role] = champion;
                gameState.blueScore += score;
            } else {
                gameState.redTeam[role] = champion;
                gameState.redScore += score;
            }

            gameState.pickedChampions.push(champion);
            gameState.turn++;

            await pubClient.set(`${GAME_PREFIX}${roomId}`, JSON.stringify(room));
            io.to(roomId).emit('game-update', room);
        }
    });

    socket.on('reset-game', async (roomId) => {
        const gameJSON = await pubClient.get(`${GAME_PREFIX}${roomId}`);
        if (!gameJSON) return;
        const room = JSON.parse(gameJSON);

        room.gameState = {
            blueTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
            redTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
            blueScore: 0, redScore: 0, turn: 0,
            pickedChampions: [],
            draftOrder: ['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red']
        };

        await pubClient.set(`${GAME_PREFIX}${roomId}`, JSON.stringify(room));
        io.to(roomId).emit('game-update', room);
    });

    socket.on('get-game-state', async (roomId) => {
        const gameJSON = await pubClient.get(`${GAME_PREFIX}${roomId}`);
        if (gameJSON) {
            socket.emit('game-state-response', JSON.parse(gameJSON));
        }
    });

    socket.on('disconnect', () => {
        console.log('Jogador desconectado:', socket.id);
        // Lógica de desconexão para limpar salas pode ser adicionada aqui
    });
});

function calculatePickScore(champion, alliedTeam, enemyTeam) {
    let score = 100;
    const adCount = alliedTeam.filter(c => c.tipo_dano === 'AD' || c.tipo_dano === 'Híbrido').length;
    if (champion.tipo_dano === 'AD' && adCount >= 2) score -= 20;
    const apCount = alliedTeam.filter(c => c.tipo_dano === 'AP' || c.tipo_dano === 'Híbrido').length;
    if (champion.tipo_dano === 'AP' && apCount >= 2) score -= 20;
    const teamHasHighCC = alliedTeam.some(c => c.nivel_cc === 'Alto');
    if (champion.nivel_cc === 'Alto' && !teamHasHighCC) score += 30;
    return Math.round(score);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));