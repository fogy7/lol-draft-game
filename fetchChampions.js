// fetchChampions.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ATUALIZE A VERSÃO CONFORME NECESSÁRIO
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

            // Tenta adivinhar o tipo de dano principal
            let tipo_dano = 'Híbrido';
            if (champ.info.magic > champ.info.physical && champ.info.physical < 4) tipo_dano = 'AP';
            if (champ.info.physical > champ.info.magic && champ.info.magic < 4) tipo_dano = 'AD';
            
            processedChampions.push({
                id: champ.id,
                nome: champ.name,
                tags: champ.tags,
                // --- NOVOS CAMPOS ADICIONADOS AQUI ---
                papel_jogo: "", // Ex: "Mago de controle com alto dano em área."
                pico_poder: {
                    early: "", // Preencher com: Forte, Razoável, Fraco
                    mid: "",   // Preencher com: Forte, Razoável, Fraco
                    late: ""   // Preencher com: Forte, Razoável, Fraco
                },
                tipo_dano: tipo_dano, // Pré-preenchido, mas você pode ajustar
                nivel_dano: "", // Preencher com: Alto, Médio, Baixo
                countera: [], // Ex: ["Yasuo", "Zed", "Veigar"]
                counterado_por: [] // Ex: ["Fizz", "Kassadin", "Diana"]
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