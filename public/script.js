// public/script.js - VERSÃO COM DRAFT PROFISSIONAL

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    const screens = { lobby: document.getElementById('lobby-screen'), draft: document.getElementById('draft-screen'), end: document.getElementById('end-screen') };
    const roomNameInput = document.getElementById('room-name-input');
    const sideButtons = document.querySelectorAll('.side-button');
    const createRoomButton = document.getElementById('create-room-button');
    const roomList = document.getElementById('room-list');
    const championGrid = document.getElementById('champion-grid');
    const turnIndicator = document.getElementById('turn-indicator');
    const blueTeamPicksContainer = document.getElementById('blue-team-picks');
    const redTeamPicksContainer = document.getElementById('red-team-picks');
    const blueTeamBansContainer = document.getElementById('blue-team-bans');
    const redTeamBansContainer = document.getElementById('red-team-bans');
    const resultTitle = document.getElementById('result-title');
    const myFinalScore = document.getElementById('my-final-score');
    const opponentResultTitle = document.getElementById('opponent-result-title');
    const opponentFinalScore = document.getElementById('opponent-final-score');
    const scoreDifference = document.getElementById('score-difference');
    const playAgainButton = document.getElementById('play-again-button');

    let selectedSide, mySide, roomId, selectedChampion = null;
    let currentGameState = null;
    let allChampions = [];
    let DDRAGON_URL = '';

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

    sideButtons.forEach(button => {
        button.addEventListener('click', () => {
            sideButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            selectedSide = button.dataset.side;
            validateCreation();
        });
    });

    roomNameInput.addEventListener('input', validateCreation);
    createRoomButton.addEventListener('click', () => socket.emit('create-room', { roomName: roomNameInput.value.trim(), side: selectedSide }));
    roomList.addEventListener('click', (e) => {
        if (e.target.classList.contains('join-button')) {
            socket.emit('join-room', { roomId: e.target.dataset.roomId, side: e.target.dataset.side });
        }
    });

    function validateCreation() { createRoomButton.disabled = !(roomNameInput.value.trim() && selectedSide); }

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

    function handleChampionClick(champion, element) {
        if (!currentGameState || !roomId || currentGameState.turn >= DRAFT_ORDER.length) return;
        const currentAction = DRAFT_ORDER[currentGameState.turn];
        if (mySide !== currentAction.team) return;
        if (currentAction.type === 'ban') {
            socket.emit('champion-ban', { roomId, champion });
        } else if (currentAction.type === 'pick') {
            if (selectedChampion) {
                document.querySelector('.champion-icon.selected')?.classList.remove('selected');
            }
            selectedChampion = champion;
            element.classList.add('selected');
            updateDraftUI({ gameState: currentGameState });
        }
    }

    function handleSlotClick(role, teamColor) {
        if (!selectedChampion || !currentGameState || currentGameState.turn >= DRAFT_ORDER.length) return;
        const currentAction = DRAFT_ORDER[currentGameState.turn];
        if (currentAction.type !== 'pick' || mySide !== teamColor) return;
        const myTeamData = mySide === 'blue' ? currentGameState.blueTeam : currentGameState.redTeam;
        if (mySide === currentAction.team && myTeamData[role] === null) {
            socket.emit('champion-pick', { roomId, champion: selectedChampion, role });
        }
    }

    playAgainButton.addEventListener('click', () => socket.emit('reset-game', roomId));

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

    function updateDraftUI(room) {
        currentGameState = room.gameState;
        if (!currentGameState) return;
        const { turn, blueBans, redBans, blueTeam, redTeam, bannedOrPickedChampions } = currentGameState;

        if (turn >= DRAFT_ORDER.length) {
            showEndScreen(currentGameState);
            return;
        }

        const currentAction = DRAFT_ORDER[turn];
        const teamText = currentAction.team === 'blue' ? 'Azul' : 'Vermelho';
        const actionText = currentAction.type === 'ban' ? 'bane' : 'escolhe';
        turnIndicator.innerText = `Time ${teamText} ${actionText}`;
        turnIndicator.style.color = currentAction.team === 'blue' ? '#59bfff' : '#ff5959';
        
        updateBanSlots(blueTeamBansContainer, blueBans);
        updateBanSlots(redTeamBansContainer, redBans);

        updateTeamPicks(blueTeamPicksContainer, blueTeam, 'blue', currentAction);
        updateTeamPicks(redTeamPicksContainer, redTeam, 'red', currentAction);

        const usedIds = new Set((bannedOrPickedChampions || []).map(c => c.id));
        document.querySelectorAll('.champion-icon').forEach(icon => {
            icon.classList.toggle('picked', usedIds.has(icon.dataset.id));
            if (!selectedChampion || icon.dataset.id !== selectedChampion.id) {
               icon.classList.remove('selected');
            }
        });
        
        if (currentAction.type === 'ban') {
            selectedChampion = null;
        }
    }
    
    function updateBanSlots(container, bans) {
        const slots = container.querySelectorAll('.ban-slot');
        slots.forEach((slot, index) => {
            const champion = bans[index];
            if (champion) {
                slot.innerHTML = `<img src="${DDRAGON_URL}${champion.id}.png" alt="${champion.nome}">`;
                slot.classList.add('filled');
            } else {
                slot.innerHTML = '';
                slot.classList.remove('filled');
            }
        });
    }

    function updateTeamPicks(container, teamData, teamColor, currentAction) {
        Object.keys(teamData).forEach(role => {
            const slot = container.querySelector(`.pick-slot[data-role="${role.toUpperCase()}"]`);
            if (!slot) return;
            const champion = teamData[role];
            if (champion) {
                slot.innerHTML = `<img src="${DDRAGON_URL}${champion.id}.png" alt="${champion.nome}"><div class="champion-name">${champion.nome}</div>`;
                slot.classList.add('filled');
                slot.classList.remove('available');
            } else {
                slot.innerHTML = `<span>${role.toUpperCase()}</span>`;
                slot.classList.remove('filled');
                const isAvailable = currentAction.type === 'pick' && currentAction.team === teamColor && mySide === teamColor && selectedChampion;
                slot.classList.toggle('available', isAvailable);
            }
        });
    }

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
            if (room.gameState.turn === 0) {
                showScreen('draft');
            }
            updateDraftUI(room);
        });

        showScreen('lobby');
        validateCreation();
    }
    initializeApp();
});