// public/script.js - VERSÃO FINAL COM FILTRO E CORREÇÃO DE PICK

document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // Telas
    const screens = { lobby: document.getElementById('lobby-screen'), draft: document.getElementById('draft-screen'), end: document.getElementById('end-screen') };

    // Elementos
    const roomNameInput = document.getElementById('room-name-input');
    const sideButtons = document.querySelectorAll('.side-button');
    const createRoomButton = document.getElementById('create-room-button');
    const roomList = document.getElementById('room-list');
    const searchInput = document.getElementById('search-input');
    const roleFilters = document.getElementById('role-filters');
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

    // Estado do Cliente
    let selectedSide, mySide, roomId, selectedChampion = null;
    let currentGameState = null;
    let allChampions = [];
    let DDRAGON_URL = '';
    let activeRoleFilter = 'Todos';

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

    // --- LÓGICA DE FILTRAGEM ---
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        let filteredChampions = allChampions;
        if (activeRoleFilter !== 'Todos') {
            filteredChampions = filteredChampions.filter(champ =>
                champ.tags && champ.tags.includes(activeRoleFilter)
            );
        }
        if (searchTerm) {
            filteredChampions = filteredChampions.filter(champ =>
                champ.nome.toLowerCase().includes(searchTerm)
            );
        }
        populateChampionGrid(filteredChampions);
        if (currentGameState) {
            updateUsedChampions(currentGameState.bannedOrPickedChampions);
        }
    }

    searchInput.addEventListener('input', applyFilters);

    roleFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('role-filter-btn')) {
            document.querySelector('.role-filter-btn.active').classList.remove('active');
            e.target.classList.add('active');
            activeRoleFilter = e.target.dataset.filter;
            applyFilters();
        }
    });

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
    createRoomButton.addEventListener('click', () => socket.emit('create-room', { roomName: roomNameInput.value.trim(), side: selectedSide }));
    roomList.addEventListener('click', (e) => {
        if (e.target.classList.contains('join-button')) {
            socket.emit('join-room', { roomId: e.target.dataset.roomId, side: e.target.dataset.side });
        }
    });
    function validateCreation() { createRoomButton.disabled = !(roomNameInput.value.trim() && selectedSide); }
    function renderRoomList(rooms) { /* ...código de renderização de salas sem alterações... */ }
    function showScreen(screenId) {
        Object.values(screens).forEach(screen => screen.classList.remove('visible'));
        screens[screenId].classList.add('visible');
    }

    // --- LÓGICA DO DRAFT E BAN ---
    function populateChampionGrid(championsToDisplay) {
        championGrid.innerHTML = '';
        championsToDisplay.forEach(champ => {
            const champDiv = document.createElement('div');
            champDiv.classList.add('champion-icon');
            champDiv.dataset.id = champ.id;
            champDiv.innerHTML = `<img src="${DDRAGON_URL}${champ.id}.png" alt="${champ.nome}">`;
            champDiv.addEventListener('click', () => handleChampionClick(champ, champDiv));
            championGrid.appendChild(champDiv);
        });
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
            updateTeamPicks(blueTeamPicksContainer, currentGameState.blueTeam, 'blue', currentAction);
            updateTeamPicks(redTeamPicksContainer, currentGameState.redTeam, 'red', currentAction);
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

    // --- LÓGICA DA TELA FINAL ---
    playAgainButton.addEventListener('click', () => socket.emit('reset-game', roomId));
    function showEndScreen(state) { /* ...código da tela final sem alterações... */ }

    // --- ATUALIZAÇÃO DA INTERFACE (UI) ---
    function updateUsedChampions(bannedOrPickedChampions) {
        const usedIds = new Set((bannedOrPickedChampions || []).map(c => c.id));
        document.querySelectorAll('.champion-icon').forEach(icon => {
            icon.classList.toggle('picked', usedIds.has(icon.dataset.id));
        });
    }

    function updateDraftUI(room) {
        currentGameState = room.gameState;
        if (!currentGameState) return;
        const { turn, blueBans, redBans, blueTeam, redTeam, bannedOrPickedChampions } = currentGameState;

        applyFilters(); // Re-aplica filtros para manter a visualização consistente

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

        updateUsedChampions(bannedOrPickedChampions);
        
        if (document.querySelector('.champion-icon.selected')) {
           document.querySelector('.champion-icon.selected').classList.remove('selected');
        }
        selectedChampion = null;
    }
    
    function updateBanSlots(container, bans) { /* ...código sem alterações... */ }
    function updateTeamPicks(container, teamData, teamColor, currentAction) { /* ...código sem alterações... */ }

    // --- INICIALIZAÇÃO E OUVINTES DO SOCKET ---
    async function initializeApp() {
        const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await versionsResponse.json();
        const latestVersion = versions[0];
        DDRAGON_URL = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/`;
        const championsResponse = await fetch('campeoes.json');
        allChampions = await championsResponse.json();
        populateChampionGrid(allChampions);
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