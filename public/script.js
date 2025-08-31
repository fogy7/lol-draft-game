// public/script.js - VERSÃO FINAL COMPLETA

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // Telas
    const screens = {
        lobby: document.getElementById('lobby-screen'),
        draft: document.getElementById('draft-screen'),
        end: document.getElementById('end-screen')
    };

    // Elementos do Lobby
    const roomNameInput = document.getElementById('room-name-input');
    const sideButtons = document.querySelectorAll('.side-button');
    const createRoomButton = document.getElementById('create-room-button');
    const roomList = document.getElementById('room-list');
    
    // Elementos do Draft
    const championGrid = document.getElementById('champion-grid');
    const turnIndicator = document.getElementById('turn-indicator');
    const blueTeamPicksContainer = document.getElementById('blue-team-picks');
    const redTeamPicksContainer = document.getElementById('red-team-picks');

    // Elementos da Tela Final
    const resultTitle = document.getElementById('result-title');
    const myFinalScore = document.getElementById('my-final-score');
    const opponentResultTitle = document.getElementById('opponent-result-title');
    const opponentFinalScore = document.getElementById('opponent-final-score');
    const scoreDifference = document.getElementById('score-difference');
    const playAgainButton = document.getElementById('play-again-button');

    // Estado do Cliente
    let selectedSide = null;
    let mySide = null;
    let roomId = null;
    let allChampions = [];
    let DDRAGON_URL = '';
    let selectedChampion = null;

    // --- LÓGICA DO LOBBY ---

    sideButtons.forEach(button => {
        button.addEventListener('click', () => {
            sideButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            selectedSide = button.dataset.side;
            validateCreation();
        });
    });

    roomNameInput.addEventListener('input', validateCreation);
    createRoomButton.addEventListener('click', () => {
        socket.emit('create-room', { roomName: roomNameInput.value.trim(), side: selectedSide });
    });

    roomList.addEventListener('click', (e) => {
        if (e.target.classList.contains('join-button')) {
            const roomId = e.target.dataset.roomId;
            const side = e.target.dataset.side;
            socket.emit('join-room', { roomId, side });
        }
    });

    function validateCreation() {
        createRoomButton.disabled = !(roomNameInput.value.trim() && selectedSide);
    }

    function renderRoomList(rooms) {
        roomList.innerHTML = rooms.length === 0 ? '<p>Nenhuma sala aberta. Crie a sua!</p>' : '';
        rooms.forEach(room => {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            const playerSides = Object.values(room.players).map(p => p.side);
            const canJoinBlue = !playerSides.includes('blue');
            const canJoinRed = !playerSides.includes('red');
            roomItem.innerHTML = `
                <span>${room.name}</span>
                <div>
                    <button class="join-button blue" data-room-id="${room.id}" data-side="blue" ${!canJoinBlue ? 'disabled' : ''}>Entrar Azul</button>
                    <button class="join-button red" data-room-id="${room.id}" data-side="red" ${!canJoinRed ? 'disabled' : ''}>Entrar Vermelho</button>
                </div>`;
            roomList.appendChild(roomItem);
        });
    }

    function showScreen(screenId) {
        Object.values(screens).forEach(screen => screen.classList.remove('visible'));
        screens[screenId].classList.add('visible');
    }

    // --- LÓGICA DO DRAFT ---

    function handleChampionClick(champion, element) {
        if (selectedChampion) {
            document.querySelector('.champion-icon.selected')?.classList.remove('selected');
        }
        selectedChampion = champion;
        element.classList.add('selected');
        socket.emit('get-game-state', roomId);
    }

    function handleSlotClick(role, teamColor) {
        if (selectedChampion && teamColor === mySide) {
            socket.emit('champion-pick', { roomId, champion: selectedChampion, role });
        }
    }
    
    // --- LÓGICA DA TELA FINAL ---

    playAgainButton.addEventListener('click', () => {
        // Ao clicar em jogar novamente, o draft é resetado e a UI é atualizada
        socket.emit('reset-game', roomId);
    });

    function showEndScreen(state) {
        showScreen('end');
        const winner = state.blueScore > state.redScore ? 'blue' : 'red';
        const diff = Math.abs(state.blueScore - state.redScore);
        const myScore = mySide === 'blue' ? state.blueScore : state.redScore;
        const opponentScore = mySide === 'blue' ? state.redScore : state.blueScore;

        myFinalScore.innerText = myScore;
        resultTitle.parentElement.className = `result-panel ${mySide === winner ? 'victory' : 'defeat'}`;
        resultTitle.innerText = mySide === winner ? "Vitória" : "Derrota";

        opponentFinalScore.innerText = opponentScore;
        opponentResultTitle.parentElement.className = `result-panel opponent ${mySide !== winner ? 'victory' : 'defeat'}`;
        opponentResultTitle.innerText = mySide !== winner ? "Vitória" : "Derrota";
        
        scoreDifference.innerText = `Diferença de ${diff} pontos.`;
    }

    // --- ATUALIZAÇÃO DA INTERFACE (UI) ---

    function updateDraftUI(room) {
        const state = room.gameState;
        if (!state) return; // Se o jogo ainda não começou

        const myTeamData = mySide === 'blue' ? state.blueTeam : state.redTeam;
        const opponentTeamData = mySide === 'blue' ? state.redTeam : state.blueTeam;
        const currentTurnColor = state.draftOrder[state.turn];

        updateTeamPicks(blueTeamPicksContainer, state.blueTeam, 'blue', currentTurnColor);
        updateTeamPicks(redTeamPicksContainer, state.redTeam, 'red', currentTurnColor);
        
        const pickedIds = new Set(state.pickedChampions.map(c => c.id));
        document.querySelectorAll('.champion-icon').forEach(icon => {
            icon.classList.toggle('picked', pickedIds.has(icon.dataset.id));
            icon.classList.remove('selected');
        });
        selectedChampion = null;

        if (state.turn < 10) {
            turnIndicator.innerText = `Vez do Time ${currentTurnColor === 'blue' ? 'Azul' : 'Vermelho'}`;
            turnIndicator.style.color = currentTurnColor === 'blue' ? '#59bfff' : '#ff5959';
        } else {
            showEndScreen(state);
        }
    }

    function updateTeamPicks(container, teamData, teamColor, currentTurnColor) {
        Object.keys(teamData).forEach(role => {
            const slot = container.querySelector(`.pick-slot[data-role="${role.toUpperCase()}"]`);
            const champion = teamData[role];
            if (champion) {
                slot.innerHTML = `<img src="${DDRAGON_URL}${champion.id}.png" alt="${champion.nome}"><div class="champion-name">${champion.nome}</div>`;
                slot.classList.add('filled');
                slot.classList.remove('available');
            } else {
                slot.innerHTML = `<span>${role.toUpperCase()}</span>`;
                slot.classList.remove('filled');
                const isAvailable = currentTurnColor === teamColor && mySide === teamColor && selectedChampion;
                slot.classList.toggle('available', isAvailable);
            }
        });
    }

    // --- INICIALIZAÇÃO E OUVINTES DO SOCKET ---

    async function initializeApp() {
        const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await versionsResponse.json();
        const latestVersion = versions[0];
        DDRAGON_URL = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/`;
        
        const championsResponse = await fetch('campeoes.json');
        allChampions = await championsResponse.json();
        
        championGrid.innerHTML = '';
        allChampions.forEach(champ => {
            const champDiv = document.createElement('div');
            champDiv.classList.add('champion-icon');
            champDiv.dataset.id = champ.id;
            champDiv.innerHTML = `<img src="${DDRAGON_URL}${champ.id}.png" alt="${champ.nome}">`;
            champDiv.addEventListener('click', () => handleChampionClick(champ, champDiv));
            championGrid.appendChild(champDiv);
        });

        document.querySelectorAll('.pick-slot').forEach(slot => {
            const role = slot.dataset.role;
            const teamColor = slot.closest('.team-panel').classList.contains('blue-team') ? 'blue' : 'red';
            slot.addEventListener('click', () => handleSlotClick(role, teamColor));
        });

        socket.on('connect', () => socket.emit('get-room-list'));
        socket.on('room-list-update', renderRoomList);

        socket.on('room-created', (room) => {
            roomId = room.id;
            mySide = Object.values(room.players)[0].side;
            showScreen('draft');
            turnIndicator.innerText = `Sala "${room.name}" criada! Aguardando oponente...`;
        });
        
        socket.on('game-start', (room) => {
            roomId = room.id;
            mySide = room.players[socket.id].side;
            showScreen('draft');

            const myHeader = document.querySelector(`.${mySide}-team h2`);
            const opponentHeader = document.querySelector(`.${mySide === 'blue' ? 'red' : 'blue'}-team h2`);
            myHeader.innerText = "Seu Time";
            opponentHeader.innerText = "Oponente";

            updateDraftUI(room);
        });
        
        socket.on('game-update', (room) => {
             // Quando o jogo reseta, volta para o draft
            if(room.gameState.turn === 0){
                showScreen('draft');
            }
            updateDraftUI(room);
        });

        socket.on('game-state-response', (state) => updateDraftUI(state));

        showScreen('lobby');
        validateCreation();
    }

    initializeApp();
});