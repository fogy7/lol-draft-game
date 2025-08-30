// public/script.js - VERSÃO COM TELA FINAL

document.addEventListener('DOMContentLoaded', async () => {
    const socket = io();

    // Elementos da UI
    const draftContainer = document.querySelector('.draft-container');
    const championGrid = document.getElementById('champion-grid');
    const blueTeamPicksContainer = document.getElementById('blue-team-picks');
    const redTeamPicksContainer = document.getElementById('red-team-picks');
    const turnIndicator = document.getElementById('turn-indicator');

    // Elementos da Tela Final
    const endScreen = document.getElementById('end-screen');
    const resultTitle = document.getElementById('result-title');
    const myFinalScore = document.getElementById('my-final-score');
    const opponentResultTitle = document.getElementById('opponent-result-title');
    const opponentFinalScore = document.getElementById('opponent-final-score');
    const scoreDifference = document.getElementById('score-difference');
    const playAgainButton = document.getElementById('play-again-button');

    let allChampions = [];
    let myTeam = null;
    let roomId = null;
    let DDRAGON_URL = '';
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
        // ... (código existente sem alterações)
        const response = await fetch('campeoes.json');
        allChampions = await response.json();
        populateChampionGrid();
    }

    function populateChampionGrid() {
        // ... (código existente sem alterações)
        championGrid.innerHTML = '';
        allChampions.forEach(champ => {
            const champDiv = document.createElement('div');
            champDiv.classList.add('champion-icon');
            champDiv.dataset.id = champ.id;
            champDiv.innerHTML = `<img src="${DDRAGON_URL}${champ.id}.png" alt="${champ.nome}">`;
            champDiv.addEventListener('click', () => handleChampionClick(champ, champDiv));
            championGrid.appendChild(champDiv);
        });
    }

    function handleChampionClick(champion, element) {
        // ... (código existente sem alterações)
        if (selectedChampion) {
            document.querySelector('.champion-icon.selected')?.classList.remove('selected');
        }
        selectedChampion = champion;
        element.classList.add('selected');
        socket.emit('get-game-state', roomId);
    }

    function handleSlotClick(role, teamColor) {
        // ... (código existente sem alterações)
        if (selectedChampion && teamColor === myTeam) {
            socket.emit('champion-pick', { roomId, champion: selectedChampion, role });
            selectedChampion = null;
            document.querySelector('.champion-icon.selected')?.classList.remove('selected');
        }
    }

    document.querySelectorAll('.pick-slot').forEach(slot => {
        // ... (código existente sem alterações)
        const role = slot.dataset.role;
        const teamColor = slot.closest('.team-panel').classList.contains('blue-team') ? 'blue' : 'red';
        slot.addEventListener('click', () => handleSlotClick(role, teamColor));
    });

    playAgainButton.addEventListener('click', () => {
        endScreen.classList.remove('visible');
        draftContainer.style.display = 'flex';
        socket.emit('reset-game', roomId);
    });

    // --- OUVINTES DO SERVIDOR ---
    socket.on('waiting', (message) => turnIndicator.innerText = message);

    socket.on('game-start', (data) => {
        myTeam = data.yourTeam;
        roomId = data.room;
        document.querySelectorAll('.team-panel').forEach(p => p.style.border = 'none');
        document.querySelector(`.${myTeam}-team`).style.border = '3px solid #c89b3c';
    });
    
    socket.on('game-state-response', (gameState) => {
        if (gameState) updateUI(gameState);
    });

    socket.on('game-update', (gameState) => {
        updateUI(gameState);
    });

    function updateUI(state) {
        // A lógica de pontuação agora é invisível para o jogador
        // document.getElementById('blue-score').innerText = state.blueScore; (REMOVIDO)
        // document.getElementById('red-score').innerText = state.redScore; (REMOVIDO)

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
            // FIM DO DRAFT - CHAMA A NOVA TELA
            showEndScreen(state);
        }
    }

    function updateTeamPicks(container, team, teamColor, state) {
        // ... (código existente sem alterações)
        const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
        const currentTurnColor = state.draftOrder[state.turn];
    
        roles.forEach(role => {
            const slot = container.querySelector(`.pick-slot[data-role="${role}"]`);
            const champion = team[role];
    
            if (champion) {
                slot.innerHTML = `<img src="${DDRAGON_URL}${champion.id}.png" alt="${champion.nome}"><div class="champion-name">${champion.nome}</div>`;
                slot.classList.add('filled');
                slot.classList.remove('available');

            } else {
                slot.innerHTML = `<span>${role}</span>`;
                slot.classList.remove('filled');
                const isAvailable = currentTurnColor === teamColor && myTeam === teamColor && selectedChampion;
                slot.classList.toggle('available', isAvailable);
            }
        });
    }

    // --- NOVA FUNÇÃO PARA MOSTRAR A TELA FINAL ---
    function showEndScreen(state) {
        draftContainer.style.display = 'none'; // Esconde a tela de draft
        const winner = state.blueScore > state.redScore ? 'blue' : 'red';
        const diff = Math.abs(state.blueScore - state.redScore);

        const myScore = myTeam === 'blue' ? state.blueScore : state.redScore;
        const opponentScore = myTeam === 'blue' ? state.redScore : state.blueScore;
        const opponentTeamColor = myTeam === 'blue' ? 'red' : 'blue';

        // Configura o painel do jogador
        myFinalScore.innerText = myScore;
        if (myTeam === winner) {
            resultTitle.innerText = "Vitória";
            resultTitle.parentElement.className = 'result-panel victory';
        } else {
            resultTitle.innerText = "Derrota";
            resultTitle.parentElement.className = 'result-panel defeat';
        }

        // Configura o painel do oponente
        opponentFinalScore.innerText = opponentScore;
        if (opponentTeamColor === winner) {
            opponentResultTitle.innerText = "Vitória";
            opponentResultTitle.parentElement.className = 'result-panel opponent victory';
        } else {
            opponentResultTitle.innerText = "Derrota";
            opponentResultTitle.parentElement.className = 'result-panel opponent defeat';
        }

        scoreDifference.innerText = `Diferença de ${diff} pontos.`;
        endScreen.classList.add('visible'); // Mostra a tela final
    }

    initializeGame();
});