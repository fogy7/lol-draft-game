// public/script.js - VERSÃO COM SELEÇÃO DE ROTA

document.addEventListener('DOMContentLoaded', async () => {
    const socket = io();

    // Elementos da UI
    const championGrid = document.getElementById('champion-grid');
    const blueTeamPicksContainer = document.getElementById('blue-team-picks');
    const redTeamPicksContainer = document.getElementById('red-team-picks');
    const turnIndicator = document.getElementById('turn-indicator');
    const blueScoreDisplay = document.getElementById('blue-score');
    const redScoreDisplay = document.getElementById('red-score');

    let allChampions = [];
    let myTeam = null;
    let roomId = null;
    let DDRAGON_URL = '';
    
    // NOVO ESTADO: Guarda o campeão que foi clicado, mas não confirmado
    let selectedChampion = null;

    async function initializeGame() {
        try {
            const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
            const versions = await versionsResponse.json();
            const latestVersion = versions[0];
            DDRAGON_URL = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/`;
            await loadChampions();
        } catch (error) {
            console.error("Erro ao inicializar o jogo:", error);
        }
    }

    async function loadChampions() {
        const response = await fetch('campeoes.json');
        allChampions = await response.json();
        populateChampionGrid();
    }

    function populateChampionGrid() {
        championGrid.innerHTML = '';
        allChampions.forEach(champ => {
            const champDiv = document.createElement('div');
            champDiv.classList.add('champion-icon');
            champDiv.dataset.id = champ.id;
            champDiv.innerHTML = `<img src="${DDRAGON_URL}${champ.id}.png" alt="${champ.nome}">`;
            
            // O clique agora chama handleChampionClick
            champDiv.addEventListener('click', () => handleChampionClick(champ, champDiv));
            championGrid.appendChild(champDiv);
        });
    }

    // --- NOVA LÓGICA DE SELEÇÃO ---

    function handleChampionClick(champion, element) {
        // Se um campeão já estiver selecionado, desmarque-o
        if (selectedChampion) {
            document.querySelector('.champion-icon.selected')?.classList.remove('selected');
        }

        // Seleciona o novo campeão
        selectedChampion = champion;
        element.classList.add('selected');
        
        // Atualiza a UI para destacar as rotas disponíveis
        socket.emit('get-game-state', roomId); // Pede o estado atual para saber quais rotas estão livres
    }

    function handleSlotClick(role, teamColor) {
        // Só faz algo se um campeão estiver selecionado e for a vez do time correto
        if (selectedChampion && teamColor === myTeam) {
            socket.emit('champion-pick', { roomId, champion: selectedChampion, role });
            
            // Limpa o estado de seleção
            selectedChampion = null;
            document.querySelector('.champion-icon.selected')?.classList.remove('selected');
        }
    }
    
    // Adiciona os event listeners aos slots uma vez
    document.querySelectorAll('.pick-slot').forEach(slot => {
        const role = slot.dataset.role;
        const teamColor = slot.closest('.team-panel').classList.contains('blue-team') ? 'blue' : 'red';
        slot.addEventListener('click', () => handleSlotClick(role, teamColor));
    });
    
    // --- OUVINTES DO SERVIDOR ---

    socket.on('waiting', (message) => turnIndicator.innerText = message);

    socket.on('game-start', (data) => {
        myTeam = data.yourTeam;
        roomId = data.room;
        document.querySelector(`.${myTeam}-team`).style.border = '3px solid #c89b3c';
    });
    
    // O servidor pode enviar o estado do jogo quando pedimos
    socket.on('game-state-response', (gameState) => {
        if (gameState) {
            updateUI(gameState);
        }
    });

    socket.on('game-update', (gameState) => {
        updateUI(gameState);
    });

    function updateUI(state) {
        // ... (código de updateUI continua na próxima seção)
        blueScoreDisplay.innerText = state.blueScore;
        redScoreDisplay.innerText = state.redScore;
    
        updateTeamPicks(blueTeamPicksContainer, state.blueTeam, 'blue', state);
        updateTeamPicks(redTeamPicksContainer, state.redTeam, 'red', state);
    
        const pickedIds = new Set(Object.values(state.blueTeam).concat(Object.values(state.redTeam)).filter(c => c).map(c => c.id));
    
        document.querySelectorAll('.champion-icon').forEach(icon => {
            icon.classList.toggle('picked', pickedIds.has(icon.dataset.id));
        });
    
        if (state.turn < 10) {
            const currentTurnColor = state.draftOrder[state.turn];
            turnIndicator.innerText = `Vez do Time ${currentTurnColor === 'blue' ? 'Azul' : 'Vermelho'}`;
            turnIndicator.style.color = currentTurnColor === 'blue' ? '#59bfff' : '#ff5959';
        } else {
            // ...
        }
    }

    function updateTeamPicks(container, team, teamColor, state) {
        const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
        const currentTurnColor = state.draftOrder[state.turn];
    
        roles.forEach(role => {
            const slot = container.querySelector(`.pick-slot[data-role="${role}"]`);
            const champion = team[role];
    
            if (champion) {
                slot.innerHTML = `
                    <img src="${DDRAGON_URL}${champion.id}.png" alt="${champion.nome}">
                    <div class="champion-name">${champion.nome}</div>
                `;
                slot.classList.add('filled');
                slot.classList.remove('available');
            } else {
                slot.innerHTML = `<span>${role}</span>`;
                slot.classList.remove('filled');
                // Adiciona a classe 'available' se for o turno do time, o jogador for desse time e um campeão estiver selecionado
                const isAvailable = currentTurnColor === teamColor && myTeam === teamColor && selectedChampion;
                slot.classList.toggle('available', isAvailable);
            }
        });
    }

    initializeGame();
});

// Adiciona uma pequena lógica no servidor para responder ao pedido de estado
// No server.js, adicione isso dentro do io.on('connection', ...):
socket.on('get-game-state', (roomId) => {
    if (gameRooms[roomId]) {
        socket.emit('game-state-response', gameRooms[roomId]);
    }
});