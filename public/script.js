// public/script.js - VERSÃO MELHORADA E AUTOMÁTICA

document.addEventListener('DOMContentLoaded', async () => { // Adicionamos 'async' aqui
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

    // --- NOVA LÓGICA AUTOMÁTICA ---
    let DDRAGON_URL = '';

    async function initializeGame() {
        try {
            console.log("Buscando a versão mais recente do Data Dragon...");
            // 1. Busca a lista de todas as versões
            const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
            const versions = await versionsResponse.json();
            const latestVersion = versions[0]; // A primeira da lista é a mais recente
            console.log(`Versão mais recente encontrada: ${latestVersion}`);

            // 2. Monta a URL correta para as imagens
            DDRAGON_URL = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/`;

            // 3. Carrega os campeões do nosso arquivo JSON
            await loadChampions();
        } catch (error) {
            console.error("Erro ao inicializar o jogo:", error);
            turnIndicator.innerText = "Erro ao carregar dados do jogo.";
        }
    }
    // --------------------------------

    async function loadChampions() {
        try {
            const response = await fetch('campeoes.json');
            allChampions = await response.json();
            populateChampionGrid();
        } catch (error) {
            console.error("Erro ao carregar campeoes.json:", error);
        }
    }

    function populateChampionGrid() {
        championGrid.innerHTML = '';
        allChampions.forEach(champ => {
            const champDiv = document.createElement('div');
            champDiv.classList.add('champion-icon');
            champDiv.dataset.id = champ.id;
            // Usa a URL dinâmica que buscamos
            champDiv.innerHTML = `<img src="${DDRAGON_URL}${champ.id}.png" alt="${champ.nome}">`;
            
            champDiv.addEventListener('click', () => {
                if(roomId){
                    socket.emit('champion-pick', { roomId, champion: champ });
                }
            });
            championGrid.appendChild(champDiv);
        });
    }

    // --- OUVINTES DE EVENTOS DO SERVIDOR ---
    socket.on('waiting', (message) => {
        turnIndicator.innerText = message;
    });

    socket.on('game-start', (data) => {
        myTeam = data.yourTeam;
        roomId = data.room;
        document.querySelector(`.${myTeam}-team`).style.border = '3px solid #c89b3c';
    });

    socket.on('game-update', (gameState) => {
        updateUI(gameState);
    });
    
    // --- FUNÇÃO DE RENDERIZAÇÃO ---
    function updateUI(state) {
        blueScoreDisplay.innerText = state.blueScore;
        redScoreDisplay.innerText = state.redScore;

        const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
        updateTeamPicks(blueTeamPicksContainer, state.blueTeam, roles);
        updateTeamPicks(redTeamPicksContainer, state.redTeam, roles);

        const pickedIds = new Set(state.blueTeam.map(c => c.id).concat(state.redTeam.map(c => c.id)));

        document.querySelectorAll('.champion-icon').forEach(icon => {
            if (pickedIds.has(icon.dataset.id)) {
                icon.classList.add('picked');
            } else {
                icon.classList.remove('picked');
            }
        });

        if (state.turn < 10) {
            const currentTurnColor = state.draftOrder[state.turn];
            turnIndicator.innerText = `Vez do Time ${currentTurnColor === 'blue' ? 'Azul' : 'Vermelho'}`;
            turnIndicator.style.color = currentTurnColor === 'blue' ? '#59bfff' : '#ff5959';
        } else {
            const winner = state.blueScore > state.redScore ? 'Azul' : 'Vermelho';
            const scoreDiff = Math.abs(state.blueScore - state.redScore);
            turnIndicator.innerText = `Fim do Draft! Time ${winner} venceu por ${scoreDiff} pontos!`;
        }
    }

    function updateTeamPicks(container, team, roles) {
        const slots = container.querySelectorAll('.pick-slot');
        slots.forEach((slot, index) => {
            const champion = team[index];
            if (champion) {
                slot.innerHTML = `
                    <img src="${DDRAGON_URL}${champion.id}.png" alt="${champion.nome}">
                    <div class="champion-name">${champion.nome}</div>
                `;
                slot.classList.add('filled');
            } else {
                 slot.innerHTML = `<span>${roles[index]}</span>`;
                 slot.classList.remove('filled');
            }
        });
    }

    // Inicia o jogo com a nova lógica
    initializeGame();
});