// fetchChampions.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// URL do Data Dragon para a versão mais recente dos campeões em português
const DDRAGON_URL = 'https://ddragon.leagueoflegends.com/cdn/14.17.1/data/pt_BR/champion.json';
// NOTA: A versão (14.17.1) pode ser atualizada no futuro.

async function fetchAndProcessChampions() {
    try {
        console.log('Buscando dados dos campeões do Data Dragon...');
        const response = await axios.get(DDRAGON_URL);
        const championsData = response.data.data;
        
        const processedChampions = [];

        for (const key in championsData) {
            const champ = championsData[key];

            // Mapeia as tags do Data Dragon para a nossa "funcao_primaria"
            let funcao_primaria = 'Indefinido';
            if (champ.tags.includes('Fighter')) funcao_primaria = 'Top';
            if (champ.tags.includes('Tank')) funcao_primaria = 'Top';
            if (champ.tags.includes('Mage')) funcao_primaria = 'Mid';
            if (champ.tags.includes('Assassin')) funcao_primaria = 'Mid';
            if (champ.tags.includes('Marksman')) funcao_primaria = 'ADC';
            if (champ.tags.includes('Support')) funcao_primaria = 'Suporte';
            // Junglers são mais complexos, mas podemos usar um placeholder
            if (['Lee Sin', 'Master Yi', 'Jarvan IV', 'Rammus'].includes(champ.name)) {
                funcao_primaria = 'Jungle';
            }
            
            processedChampions.push({
                id: champ.id,
                nome: champ.name,
                funcao_primaria: funcao_primaria,
                // --- CAMPOS PARA PREENCHER MANUALMENTE ---
                tipo_dano: "", // Preencher com 'AD', 'AP' ou 'Híbrido'
                nivel_cc: "", // Preencher com 'Nulo', 'Baixo', 'Médio', 'Alto'
                estilo_jogo: [], // Ex: ["Assassino", "Split Push"]
                forca: "", // Preencher com 'Early Game', 'Mid Game', 'Late Game'
                tipo_de_engage: "", // Preencher com 'Primário', 'Secundário', 'Nenhum'
                sinergias_fortes_com: [],
                fraco_contra: []
            });
        }
        
        console.log(`${processedChampions.length} campeões processados.`);

        // Salva o arquivo na pasta 'public'
        const outputPath = path.join(__dirname, 'public', 'campeoes.json');
        fs.writeFileSync(outputPath, JSON.stringify(processedChampions, null, 2));

        console.log(`Arquivo 'campeoes.json' atualizado com sucesso em ${outputPath}!`);

    } catch (error) {
        console.error('Ocorreu um erro ao buscar os campeões:', error.message);
    }
}

fetchAndProcessChampions();