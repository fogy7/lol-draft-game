// fetchChampions.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ATUALIZE A VERSÃO CONFORME NECESSÁRIO (ex: '15.17.1')
// Pode encontrar a versão mais recente em: https://ddragon.leagueoflegends.com/api/versions.json
const DDRAGON_VERSION = '15.17.1'; 
const DDRAGON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/pt_BR/champion.json`;

async function fetchAndProcessChampions() {
    try {
        console.log('Buscando dados dos campeões do Data Dragon...');
        const response = await axios.get(DDRAGON_URL);
        const championsData = response.data.data;
        
        const processedChampions = [];

        for (const key in championsData) {
            const champ = championsData[key];
            
            processedChampions.push({
                id: champ.id,
                nome: champ.name,
                tags: champ.tags, // Salva as tags de classe (Fighter, Mage, etc.)
                // --- CAMPOS PARA PREENCHER MANUALMENTE ---
                tipo_dano: "", 
                nivel_cc: "", 
                estilo_jogo: [],
                forca: "", 
                tipo_de_engage: "",
                sinergias_fortes_com: [],
                fraco_contra: []
            });
        }

        // Ordena a lista final de campeões por nome
        processedChampions.sort((a, b) => a.nome.localeCompare(b.nome));
        
        console.log(`${processedChampions.length} campeões processados e ordenados.`);

        const outputPath = path.join(__dirname, 'public', 'campeoes.json');
        fs.writeFileSync(outputPath, JSON.stringify(processedChampions, null, 2));

        console.log(`Arquivo 'campeoes.json' atualizado com sucesso em ${outputPath}!`);

    } catch (error) {
        console.error('Ocorreu um erro ao buscar os campeões:', error.message);
    }
}

fetchAndProcessChampions();