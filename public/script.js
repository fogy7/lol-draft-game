// public/script.js - VERSÃO DE DIAGNÓSTICO

document.addEventListener('DOMContentLoaded', () => {
    console.log("1. Documento carregado. A iniciar o script.");

    try {
        const socket = io();

        // Telas
        const screens = {
            lobby: document.getElementById('lobby-screen'),
            draft: document.getElementById('draft-screen'),
            end: document.getElementById('end-screen')
        };
        console.log("2. Ecrãs encontrados:", screens.lobby ? 'OK' : 'FALHA', screens.draft ? 'OK' : 'FALHA', screens.end ? 'OK' : 'FALHA');

        // Elementos do Lobby
        const roomNameInput = document.getElementById('room-name-input');
        const sideButtons = document.querySelectorAll('.side-button');
        const createRoomButton = document.getElementById('create-room-button');
        const roomList = document.getElementById('room-list');
        console.log("3. Elementos do Lobby encontrados:", roomNameInput ? 'OK' : 'FALHA', sideButtons.length > 0 ? 'OK' : 'FALHA', createRoomButton ? 'OK' : 'FALHA');

        // ... (outros elementos)

        let selectedSide = null;
        let mySide = null;
        let roomId = null;

        // --- LÓGICA DO LOBBY ---

        sideButtons.forEach(button => {
            button.addEventListener('click', () => {
                console.log("Botão de lado clicado:", button.dataset.side);
                sideButtons.forEach(btn => btn.classList.remove('selected'));
                button.classList.add('selected');
                selectedSide = button.dataset.side;
                validateCreation();
            });
        });

        roomNameInput.addEventListener('input', () => {
            console.log("Texto inserido no nome da sala:", roomNameInput.value);
            validateCreation();
        });

        createRoomButton.addEventListener('click', () => {
            console.log("Botão 'Criar Sala' clicado.");
            socket.emit('create-room', { roomName: roomNameInput.value.trim(), side: selectedSide });
        });

        function validateCreation() {
            const isNameValid = roomNameInput && roomNameInput.value.trim() !== '';
            const isSideSelected = selectedSide !== null;
            createRoomButton.disabled = !(isNameValid && isSideSelected);
            console.log(`Validando... Nome: ${isNameValid}, Lado: ${isSideSelected}. Botão desabilitado: ${createRoomButton.disabled}`);
        }
        
        function showScreen(screenId) {
            console.log("A mostrar ecrã:", screenId);
            Object.values(screens).forEach(screen => screen.classList.remove('visible'));
            screens[screenId].classList.add('visible');
        }

        // --- OUVINTES DO SOCKET ---
        socket.on('connect', () => {
            console.log("Conectado ao servidor via Socket.IO!");
            socket.emit('get-room-list');
        });
        
        socket.on('room-list-update', (rooms) => {
            console.log("Recebida lista de salas atualizada:", rooms);
            // ... (lógica de renderização)
        });

        // ... (resto do código)
        
        // --- INICIALIZAÇÃO ---
        console.log("A iniciar a aplicação...");
        showScreen('lobby');
        validateCreation();

    } catch (error) {
        console.error("ERRO CRÍTICO NO SCRIPT:", error);
    }
});