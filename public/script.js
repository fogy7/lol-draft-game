// public/script.js - VERSÃO COM PAINEL DE INFORMAÇÕES LATERAL

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
    const blueInfoPanel = document.getElementById('blue-info-panel');
    const redInfoPanel = document.getElementById('red-info-panel');
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
            filteredChampions = filteredChampions.filter(champ => champ.tags && champ.tags.includes(activeRoleFilter));
        }
        if (searchTerm) {
            filteredChampions = filteredChampions.filter(champ => champ.nome.toLowerCase().includes(searchTerm));
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
    sideButtons.forEach(button => { button.addEventListener('click', () => { sideButtons.forEach(btn => btn.classList.remove('selected')); button.classList.add('selected'); selectedSide = button.dataset.side; validateCreation(); }); });
    roomNameInput.addEventListener('input', validateCreation);
    createRoomButton.addEventListener('click', () => socket.emit('create-room', { roomName: roomNameInput.value.trim(), side: selectedSide }));
    roomList.addEventListener('click', (e) => { if (e.target.classList.contains('join-button')) { socket.emit('join-room', { roomId: e.target.dataset.roomId, side: e.target.dataset.side }); } });
    function validateCreation() { createRoomButton.disabled = !(roomNameInput.value.trim() && selectedSide); }
    function renderRoomList(rooms) {
        roomList.innerHTML = rooms.length === 0 ? '<p>Nenhuma sala aberta. Crie a sua!</p>' : '';
        rooms.forEach(room => {
            const roomItem = document.createElement('div');
            roomItem.className = 'room-item';
            const playerSides = Object.values(room.players).map(p => p.side);
            const canJoinBlue = !playerSides.includes('blue');
            const canJoinRed = !playerSides.includes('red');
            roomItem.innerHTML = `<span>${room.name}</span><div><button class="join-button blue" data-room-id="${room.id}" data-side="blue" ${!canJoinBlue ? 'disabled' : ''}>Entrar Azul</button><button class="join-button red" data-room-id="${room.id}" data-side="red" ${!canJoinRed ? 'disabled' : ''}>Entrar Vermelho</button></div>`;
            roomList.appendChild(roomItem);
        });
    }
    function showScreen(screenId) { Object.values(screens).forEach(screen => screen.classList.remove('visible')); screens[screenId].classList.add('visible'); }

    // --- LÓGICA DO PAINEL DE INFORMAÇÕES ---
    function showChampionInfo(championId, teamColor) {
        const champData = allChampions.find(c => c.id === championId);
        if (!champData) return;

        blueInfoPanel.style.display = 'none';
        redInfoPanel.style.display = 'none';
        const targetPanel = teamColor === 'blue' ? blueInfoPanel : redInfoPanel;

        const powerMap = { 'Forte': 100, 'Razoável': 60, 'Fraco': 25 };
        const earlyPower = powerMap[champData.pico_poder?.early] || 0;
        const midPower = powerMap[champData.pico_poder?.mid] || 0;
        const latePower = powerMap[champData.pico_poder?.late] || 0;

        targetPanel.innerHTML = `
            <div class="info-header">
                <img src="${DDRAGON_URL}${champData.id}.png" alt="${champData.nome}">
                <h2>${champData.nome}</h2>
            </div>
            <div class="info-body">
                <div class="info-section">
                    <h3>Papel no Jogo</h3>
                    <p>${champData.papel_jogo || "Não especificado."}</p>
                </div>
                <div class="info-section">
                    <h3>Pico de Poder</h3>
                    <div class="power-spike-container">
                        <div class="spike-bar-group"><div class="spike-bar" style="--power: ${earlyPower}%"></div><span>Early</span></div>
                        <div class="spike-bar-group"><div class="spike-bar" style="--power: ${midPower}%"></div><span>Mid</span></div>
                        <div class="spike-bar-group"><div class="spike-bar" style="--power: ${latePower}%"></div><span>Late</span></div>
                    </div>
                </div>
                <div class="info-section">
                    <h3>Atributos de Dano</h3>
                    <p><strong>Tipo:</strong> ${champData.tipo_dano || "?"}</p>
                    <p><strong>Nível:</strong> ${champData.nivel_dano || "?"}</p>
                </div>
                <div class="info-section-row">
                    <div class="info-section">
                        <h3>Forte Contra</h3>
                        <ul>${(champData.countera || []).map(c => `<li>${c}</li>`).join('') || "<li>Nenhum</li>"}</ul>
                    </div>
                    <div class="info-section">
                        <h3>Fraco Contra</h3>
                        <ul>${(champData.counterado_por || []).map(c => `<li>${c}</li>`).join('') || "<li>Nenhum</li>"}</ul>
                    </div>
                </div>
            </div>`;
        targetPanel.classList.add('visible');
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
        
        blueInfoPanel.classList.remove('visible');
        redInfoPanel.classList.remove('visible');
        
        applyFilters();
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
                slot.dataset.championId = champion.id;
            } else {
                slot.innerHTML = `<span>${role.toUpperCase()}</span>`;
                slot.classList.remove('filled');
                slot.removeAttribute('data-champion-id');
            }
            const isAvailable = currentAction.type === 'pick' && currentAction.team === teamColor && mySide === teamColor && selectedChampion;
            slot.classList.toggle('available', isAvailable);
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
        populateChampionGrid(allChampions);

        document.querySelectorAll('.pick-slot').forEach(slot => {
            const role = slot.dataset.role;
            const teamColor = slot.closest('.team-panel').classList.contains('blue-team') ? 'blue' : 'red';
            slot.addEventListener('click', () => handleSlotClick(role, teamColor));
        });

        blueTeamPicksContainer.addEventListener('click', (e) => {
            const slot = e.target.closest('.pick-slot.filled');
            if (slot && slot.dataset.championId) {
                showChampionInfo(slot.dataset.championId, 'blue');
            }
        });
        redTeamPicksContainer.addEventListener('click', (e) => {
            const slot = e.target.closest('.pick-slot.filled');
            if (slot && slot.dataset.championId) {
                showChampionInfo(slot.dataset.championId, 'red');
            }
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