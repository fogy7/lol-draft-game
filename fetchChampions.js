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

            let funcao_primaria = 'Indefinido';
            if (champ.tags.includes('Fighter')) funcao_primaria = 'Lutador';
            if (champ.tags.includes('Tank')) funcao_primaria = 'Tanque';
            if (champ.tags.includes('Mage')) funcao_primaria = 'Mago';
            if (champ.tags.includes('Assassin')) funcao_primaria = 'Assassino';
            if (champ.tags.includes('Marksman')) funcao_primaria = 'Atirador';
            if (champ.tags.includes('Support')) funcao_primaria = 'Suporte';
            
            processedChampions.push({
                id: champ.id,
                nome: champ.name,
                tags: champ.tags, // CORREÇÃO: Adiciona as tags originais para o filtro
                funcao_primaria: funcao_primaria, // Mantém a nossa lógica de função primária
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