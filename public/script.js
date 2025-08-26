// public/script.js

document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Conecta ao servidor Socket.IO

    // Elementos da UI
    const championGrid = document.getElementById('champion-grid');
    const blueTeamPicksContainer = document.getElementById('blue-team-picks');
    const redTeamPicksContainer = document.getElementById('red-team-picks');
    const turnIndicator = document.getElementById('turn-indicator');
    const pickInfo = document.getElementById('pick-info');
    const blueScoreDisplay = document.getElementById('blue-score');
    const redScoreDisplay = document.getElementById('red-score');

    let allChampions = [];
    let myTeam = null;
    let roomId = null;
    const DDRAGON_URL = "https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/";

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
            champDiv.innerHTML = `<img src="${DDRAGON_URL}${champ.id}.png" alt="${champ.nome}">`;
            
            // A ação de clique agora envia um evento para o servidor
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
        // Atualiza a interface para mostrar qual time você é
        document.querySelector(`.${myTeam}-team`).style.border = '3px solid #c89b3c';
    });

    socket.on('game-update', (gameState) => {
        // A função de update agora apenas renderiza o estado recebido do servidor
        updateUI(gameState);
    });
    
    // --- FUNÇÃO DE RENDERIZAÇÃO ---
    
    function updateUI(state) {
        blueScoreDisplay.innerText = state.blueScore;
        redScoreDisplay.innerText = state.redScore;

        updateTeamPicks(blueTeamPicksContainer, state.blueTeam, state.draftRoles);
        updateTeamPicks(redTeamPicksContainer, state.redTeam, state.draftRoles);

        document.querySelectorAll('.champion-icon').forEach(icon => {
            if (state.pickedChampions.includes(icon.dataset.id) || Array.from(state.pickedChampions).some(c => c.id === icon.dataset.id)) {
                icon.classList.add('picked');
            } else {
                icon.classList.remove('picked');
            }
        });

        if (state.turn < state.draftOrder.length) {
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

    loadChampions();
});