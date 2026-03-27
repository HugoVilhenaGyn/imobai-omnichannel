import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente manualmente ou usar o fetch do NodeJS
async function testAPI() {
  console.log("Iniciando Teste do Motor de IA (Gemini)...");

  // Ler o .env
  const envPath = path.resolve('.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const apiKeyMatch = envContent.match(/VITE_GEMINI_API_KEY="?([^"\n]+)"?/);
  
  if (!apiKeyMatch || !apiKeyMatch[1] || apiKeyMatch[1] === 'COLOQUE_SUA_CHAVE_AQUI') {
    console.error("ERRO: A chave VITE_GEMINI_API_KEY não foi encontrada ou continua com o valor padrão.");
    process.exit(1);
  }

  const apiKey = apiKeyMatch[1].trim();
  console.log(`Chave encontrada! Tamanho da chave: ${apiKey.length} caracteres.`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const messageText = "Tenho interesse em comprar um apartamento financiado no centro.";
  const currentIntent = "indefinido";
  const currentStatus = "novo_contato";

  const prompt = `Você é um corretor virtual simpático e extremamente prestativo da ImobAI. Sua função é responder clientes, descobrir o que eles querem e qualificar o contato para os corretores humanos. Seja gentil, persuasivo, ágil e use emojis.
MUITO IMPORTANTE: Não invente dados de imóveis, apenas faça triagem.

O cliente enviou a seguinte mensagem: "${messageText}"

O status atual dele no funil (banco de dados) é: "${currentStatus}"
E a intenção atual é: "${currentIntent}"

Analise a intenção e RETORNE APENAS UM JSON VÁLIDO.
Estrutura do JSON Esperado:
{
  "resposta": "Sua mensagem direta para o cliente simulando que vc está digitando no WhatsApp.",
  "intent": "vendas" | "locacao" | "captacao" | "indefinido" (Mude baseado no que ele disse. Se for comprar=vendas, alugar=locacao, anunciar=captacao),
  "status": "novo_contato" | "triagem_ia" | "qualificado" | "novo_lead" (Regras: 'triagem_ia' enquando estiver conversando. 'qualificado' se ele definiu bem o que busca. 'novo_lead' se ele pedir um humano AGORA para encerrar a IA).
}
Certifique-se de que a saída seja APENAS e estritamente JSON. Sem blocos markdown (sem \`\`\`json).`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
    
    if (!res.ok) {
       const errTexto = await res.text();
       throw new Error(`Erro na API (${res.status}): ${errTexto}`);
    }
    
    const data = await res.json();
    const resultText = data.candidates[0].content.parts[0].text;
    
    console.log("\n==== RESPOSTA BRUTA DA API ====\n" + resultText + "\n================================\n");

    const parsedData = JSON.parse(resultText);
    console.log("✅ JSON PARSE COM SUCESSO!");
    console.log("👉 Resposta da IA:", parsedData.resposta);
    console.log("👉 Intenção deduzida:", parsedData.intent);
    console.log("👉 Novo Status de Funil:", parsedData.status);

  } catch(e) {
    console.error("❌ FALHA NO TESTE:", e);
  }
}

testAPI();
