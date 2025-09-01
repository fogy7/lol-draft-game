// server.js - VERSÃO FINAL COM LÓGICA DE DRAFT CORRIGIDA

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
const ROOM_EXPIRATION_MS = 10 * 60 * 1000;

// A "Bíblia" do nosso draft, a única fonte da verdade para a ordem
const DRAFT_ORDER = [
    { type: 'ban', team: 'blue' }, { type: 'ban', team: 'red' }, { type: 'ban', team: 'blue' },
    { type: 'ban', team: 'red' }, { type: 'ban', team: 'blue' }, { type: 'ban', team: 'red' },
    { type: 'pick', team: 'blue' }, { type: 'pick', team: 'red' }, { type: 'pick', team: 'red' },
    { type: 'pick', team: 'blue' }, { type: 'pick', team: 'blue' }, { type: 'pick', team: 'red' },
    { type: 'ban', team: 'red' }, { type: 'ban', team: 'blue' }, { type: 'ban', team: 'red' },
    { type: 'ban', team: 'blue' },
    { type: 'pick', team: 'red' }, { type: 'pick', team: 'blue' }, { type: 'pick', team: 'blue' },
    { type: 'pick', team: 'red' }
];

function createInitialGameState() {
    return {
        turn: 0,
        blueBans: [],
        redBans: [],
        blueTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
        redTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
        blueScore: 0,
        redScore: 0,
        bannedOrPickedChampions: [],
    };
}

async function broadcastRoomList() {
    try {
        const roomsJSON = await pubClient.hGetAll(ROOMS_KEY);
        const rooms = Object.values(roomsJSON).map(JSON.parse);
        io.emit('room-list-update', rooms);
    } catch (err) {
        console.error("Erro ao transmitir lista de salas:", err);
    }
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
            createdAt: Date.now()
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
        if (Object.keys(room.players).length >= 2 || Object.values(room.players).some(p => p.side === side)) return;
        room.players[socket.id] = { side };
        if (Object.keys(room.players).length === 2) {
            await pubClient.hDel(ROOMS_KEY, roomId);
            room.gameState = createInitialGameState();
            await pubClient.set(`${GAME_PREFIX}${roomId}`, JSON.stringify(room));
            socket.join(roomId);
            io.to(roomId).emit('game-start', room);
            broadcastRoomList();
        } else {
            await pubClient.hSet(ROOMS_KEY, roomId, JSON.stringify(room));
            socket.join(roomId);
            broadcastRoomList();
        }
    });
    
    // Função unificada para lidar com todas as ações de draft
    const handleDraftAction = async (isBan, { roomId, champion, role }) => {
        const gameJSON = await pubClient.get(`${GAME_PREFIX}${roomId}`);
        if (!gameJSON) return;
        const room = JSON.parse(gameJSON);
        const { gameState } = room;

        if (gameState.turn >= DRAFT_ORDER.length) return; // Draft já terminou

        const currentAction = DRAFT_ORDER[gameState.turn];
        const expectedActionType = isBan ? 'ban' : 'pick';
        const playerSide = room.players[socket.id]?.side;

        if (!playerSide || currentAction.type !== expectedActionType || currentAction.team !== playerSide) {
            return; // Ação inválida ou não é o turno do jogador
        }

        const isAlreadyUsed = gameState.bannedOrPickedChampions.some(c => c.id === champion.id);
        if (isAlreadyUsed) return;

        // Processa a Ação
        if (isBan) {
            if (playerSide === 'blue') gameState.blueBans.push(champion);
            else gameState.redBans.push(champion);
        } else { // É um Pick
            const currentTeam = playerSide === 'blue' ? gameState.blueTeam : gameState.redTeam;
            if (currentTeam[role] === null) {
                const alliedTeam = Object.values(currentTeam).filter(c => c !== null);
                const enemyTeam = Object.values(playerSide === 'blue' ? gameState.redTeam : gameState.blueTeam).filter(c => c !== null);
                const score = calculatePickScore(champion, alliedTeam, enemyTeam);
                
                currentTeam[role] = champion;
                if (playerSide === 'blue') gameState.blueScore += score;
                else gameState.redScore += score;
            } else {
                return; // Slot já ocupado
            }
        }

        gameState.bannedOrPickedChampions.push(champion);
        gameState.turn++;

        await pubClient.set(`${GAME_PREFIX}${roomId}`, JSON.stringify(room));
        io.to(roomId).emit('game-update', room);
    };

    socket.on('champion-ban', (data) => handleDraftAction(true, data));
    socket.on('champion-pick', (data) => handleDraftAction(false, data));

    socket.on('reset-game', async (roomId) => {
        const gameJSON = await pubClient.get(`${GAME_PREFIX}${roomId}`);
        if (!gameJSON) return;
        const room = JSON.parse(gameJSON);
        room.gameState = createInitialGameState();
        await pubClient.set(`${GAME_PREFIX}${roomId}`, JSON.stringify(room));
        io.to(roomId).emit('game-update', room);
    });

    socket.on('disconnect', () => {
        console.log('Jogador desconectado:', socket.id);
        // Lógica de desconexão para limpar salas pode ser adicionada aqui
    });
});

async function cleanupInactiveRooms() {
    console.log("Executando limpeza de salas inativas...");
    try {
        const roomsJSON = await pubClient.hGetAll(ROOMS_KEY);
        let roomsDeleted = 0;
        for (const [fieldId, roomStr] of Object.entries(roomsJSON)) {
            if (!roomStr) continue;
            let room;
            try {
                room = JSON.parse(roomStr);
            } catch (err) {
                console.warn(`Falha ao parsear sala ${fieldId}:`, err);
                continue;
            }
            const playerCount = room.players ? Object.keys(room.players).length : 0;
            const age = Date.now() - (room.createdAt || 0);
            if (age > ROOM_EXPIRATION_MS) {
                await pubClient.hDel(ROOMS_KEY, fieldId);
                roomsDeleted++;
                console.log(`Sala expirada removida: "${room.name}" (${fieldId}), criada há ${Math.round(age/1000)}s, players=${playerCount}`);
            }
        }
        if (roomsDeleted > 0) {
            console.log(`Limpeza completa: ${roomsDeleted} sala(s) removida(s).`);
            broadcastRoomList();
        } else {
            console.log("Limpeza completa: nenhuma sala removida.");
        }
    } catch (err) {
        console.error("Erro durante cleanupInactiveRooms:", err);
    }
}

setInterval(cleanupInactiveRooms, 60000);

function calculatePickScore(champion, alliedTeam, enemyTeam) {
    let score = 100;
    const adCount = alliedTeam.filter(c => c.tipo_dano === 'AD' || c.tipo_dano === 'Híbrido').length;
    if (champion.tipo_dano === 'AD' && adCount >= 2) score -= 20;
    const apCount = alliedTeam.filter(c => c.tipo_dano === 'AP' || c.tipo_dano === 'Híbrido').length;
    if (champion.tipo_dano === 'AP' && apCount >= 2) score -= 20;
    const teamHasHighCC = alliedTeam.some(c => c.nivel_cc === 'Alto');
    if (champion.nivel_cc === 'Alto' && !teamHasHighCC) score += 30;
    for (const ally of alliedTeam) {
        if (ally.sinergias_fortes_com && ally.sinergias_fortes_com.includes(champion.nome)) {
            score += 25;
        }
        if (champion.sinergias_fortes_com && champion.sinergias_fortes_com.includes(ally.nome)) {
            score += 25;
        }
    }
    for (const enemy of enemyTeam) {
        if (champion.fraco_contra && champion.fraco_contra.includes(enemy.nome)) {
            score -= 15;
        }
        if (enemy.fraco_contra && enemy.fraco_contra.includes(champion.nome)) {
            score += 20;
        }
    }
    return Math.round(score);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));