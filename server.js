// server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve os arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

let waitingPlayer = null;
const gameRooms = {}; // Armazena o estado de todos os jogos ativos

// Lógica de Conexão do Socket.IO
io.on('connection', (socket) => {
    console.log('Novo jogador conectado:', socket.id);

    if (waitingPlayer) {
        // Se já existe um jogador esperando, cria uma sala e inicia o jogo
        const roomName = `room_${socket.id}_${waitingPlayer.id}`;
        
        // Coloca ambos os jogadores na mesma sala
        waitingPlayer.join(roomName);
        socket.join(roomName);

        // Cria o estado inicial do jogo para esta sala
        gameRooms[roomName] = {
            players: {
                blue: waitingPlayer.id,
                red: socket.id
            },
            campeoes: [], // Precisamos carregar os campeões aqui
            blueTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
            redTeam: { TOP: null, JG: null, MID: null, ADC: null, SUP: null },
            blueScore: 0,
            redScore: 0,
            turn: 0,
            pickedChampions: new Set(),
            draftOrder: ['blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red'],
            draftRoles: ['TOP', 'JG', 'MID', 'ADC', 'SUP', 'TOP', 'JG', 'MID', 'ADC', 'SUP']
        };

        console.log(`Jogo iniciado na sala ${roomName} entre ${waitingPlayer.id} e ${socket.id}`);
        
        // Avisa aos jogadores que o jogo começou
        io.to(roomName).emit('game-start', {
            room: roomName,
            yourTeam: 'blue', // O primeiro jogador é sempre o azul
            opponentTeam: 'red'
        });
        io.to(socket.id).emit('game-start', {
            room: roomName,
            yourTeam: 'red',
            opponentTeam: 'blue'
        });
        
        io.to(roomName).emit('game-update', gameRooms[roomName]);
        waitingPlayer = null; // Limpa o jogador em espera

    } else {
        // Se não há ninguém esperando, este jogador se torna o 'waitingPlayer'
        waitingPlayer = socket;
        socket.emit('waiting', 'Aguardando outro jogador...');
    }

    // Lógica para quando um jogador escolhe um campeão
    socket.on('champion-pick', (data) => {
    const { roomId, champion, role } = data; // Adicionamos 'role'
    const room = gameRooms[roomId];
    if (!room) return;

    const playerTeamColor = room.players.blue === socket.id ? 'blue' : 'red';
    const currentTurnColor = room.draftOrder[room.turn];
    const currentTeam = playerTeamColor === 'blue' ? room.blueTeam : room.redTeam;

    // Validação extra: a rota está disponível?
    if (playerTeamColor === currentTurnColor && !room.pickedChampions.has(champion.id) && currentTeam[role] === null) {
        const alliedTeam = Object.values(currentTeam).filter(c => c !== null); // Pega os campeões já escolhidos
        const enemyTeam = Object.values(playerTeamColor === 'blue' ? room.redTeam : room.blueTeam).filter(c => c !== null);

        const score = calculatePickScore(champion, alliedTeam, enemyTeam);

        if(playerTeamColor === 'blue') {
            room.blueTeam[role] = champion; // Coloca o campeão na rota certa
            room.blueScore += score;
        } else {
            room.redTeam[role] = champion; // Coloca o campeão na rota certa
            room.redScore += score;
        }

        room.pickedChampions.add(champion.id);
        room.turn++;

        io.to(roomId).emit('game-update', room);
    }
});

    // Lógica para quando um jogador desconecta
    socket.on('disconnect', () => {
        console.log('Jogador desconectado:', socket.id);
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
        // Adicionar lógica para encerrar jogos em andamento se um jogador sair
    });
    socket.on('reset-game', (roomId) => {
        const room = gameRooms[roomId];
        if (room) {
            // Reseta o estado do jogo para o inicial
            room.blueTeam = { TOP: null, JG: null, MID: null, ADC: null, SUP: null };
            room.redTeam = { TOP: null, JG: null, MID: null, ADC: null, SUP: null };
            room.blueScore = 0;
            room.redScore = 0;
            room.turn = 0;
            room.pickedChampions = new Set();
            
            console.log(`Jogo na sala ${roomId} foi reiniciado.`);
            // Envia o estado zerado para ambos os jogadores
            io.to(roomId).emit('game-update', room);
        }
    });

// não se esqueça de adicionar a pequena lógica de 'get-game-state' que faltou na resposta anterior
    socket.on('get-game-state', (roomId) => {
        if (gameRooms[roomId]) {
            socket.emit('game-state-response', gameRooms[roomId]);
        }
    });
});

// A função de pontuação (IA) agora vive no servidor
function calculatePickScore(champion, alliedTeam, enemyTeam) {
    let score = 100;
    const adCount = alliedTeam.filter(c => c.tipo_dano === 'AD' || c.tipo_dano === 'Híbrido').length;
    if (champion.tipo_dano === 'AD' && adCount >= 2) score -= 20;
    const apCount = alliedTeam.filter(c => c.tipo_dano === 'AP' || c.tipo_dano === 'Híbrido').length;
    if (champion.tipo_dano === 'AP' && apCount >= 2) score -= 20;
    const teamHasHighCC = alliedTeam.some(c => c.nivel_cc === 'Alto');
    if (champion.nivel_cc === 'Alto' && !teamHasHighCC) score += 30;
    const teamHasEngage = alliedTeam.some(c => c.tipo_de_engage === 'Primário');
    if (champion.tipo_de_engage === 'Primário' && !teamHasEngage) score += 35;
    for (const ally of alliedTeam) {
        if (ally.sinergias_fortes_com && ally.sinergias_fortes_com.includes(champion.nome)) score += 25;
        if (champion.sinergias_fortes_com && champion.sinergias_fortes_com.includes(ally.nome)) score += 25;
    }
    return Math.round(score);
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));