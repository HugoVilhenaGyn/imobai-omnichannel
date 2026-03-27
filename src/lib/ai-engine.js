import { supabase } from './supabase';

const AI_DELAY = 1000; // Delay menor pois a chamada à API já demora um pouquinho

async function callGenerativeAI(messageText, currentIntent, currentStatus) {
  // Ler configuração da interface gráfica local
  const savedConfigStr = localStorage.getItem('imobai_ai_config');
  let localConfig = { active: true, apiKey: '', agentName: 'Corretor Virtual ImobAI', prompt: '' };
  try { if (savedConfigStr) localConfig = JSON.parse(savedConfigStr); } catch (e) {}

  if (localConfig.active === false) {
    return { abort: true, status: 'IA Desativada nas Configurações' };
  }

  const apiKey = localConfig.apiKey || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'COLOQUE_SUA_CHAVE_AQUI') {
    console.warn("Chave API do Gemini não configurada.");
    return null;
  }

  const agentName = localConfig.agentName || 'Assistente ImobAI';
  const baseInstruction = localConfig.prompt || "Você é um corretor virtual simpático e extremamente prestativo da ImobAI.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `INSTRUÇÕES DE DIRETRIZ E PERSONALIDADE:
O seu nome é: ${agentName}.
${baseInstruction}

O cliente enviou a seguinte mensagem: "${messageText}"

O status atual dele no funil (banco de dados) é: "${currentStatus}"
E a intenção atual é: "${currentIntent}"

Analise a intenção e RETORNE APENAS UM JSON VÁLIDO.
Estrutura do JSON Esperado:
{
  "resposta": "Sua mensagem direta para o cliente simulando que vc está digitando no WhatsApp.",
  "intent": "vendas" | "locacao" | "captacao" | "indefinido" (Mude baseado no que ele disse),
  "status": "novo_contato" | "triagem_ia" | "qualificado" | "novo_lead" (Mova para 'novo_lead' se ele pedir corretor humano ou para terminar).
}
Certifique-se de que a saída seja APENAS JSON sem marcação markdown.`;

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
    
    if (!res.ok) throw new Error("Erro de rede ao chamar Google Gemini");
    
    const data = await res.json();
    const resultText = data.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(resultText);
    return parsedData;
  } catch(e) {
    console.error("Falha na IA LLM:", e);
    return null;
  }
}

export async function processAILogic(newMessage) {
  if (newMessage.sender_type !== 'user') return;

  try {
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', newMessage.contact_id)
      .single();

    if (!contact || !contact.handled_by_ai) return;

    let respostaIA = "Hum... Tive um pequeno problema processando sua mensagem no momento. Poderia repetir?";
    let novoIntent = contact.intent || 'vendas';
    let novoStatus = contact.status || 'novo_contato';

    // Chama o cébero real (Gemini) passando a mensagem e o estado atual
    const aiMinds = await callGenerativeAI(newMessage.content, contact.intent, contact.status);

    if (aiMinds && aiMinds.abort) {
      console.log('IA desativada. Nenhuma ação tomada.');
      return; 
    }

    if (aiMinds && aiMinds.resposta) {
      respostaIA = aiMinds.resposta;
      novoIntent = aiMinds.intent || contact.intent;
      novoStatus = aiMinds.status || contact.status;
    } else {
      // Simulação Hardcoded caso não ache a chave de API
      const texto = newMessage.content.toLowerCase();
      if (texto.includes('comprar')) { novoIntent = 'vendas'; novoStatus = 'qualificado'; respostaIA = "(Simulação sem API Key) Excelente! Que tipo de imóvel para compra?"; } 
      else if (texto.includes('alugar')) { novoIntent = 'locacao'; novoStatus = 'qualificado'; respostaIA = "(Simulação sem API Key) Perfeito! Locação residencial ou comercial?"; }
      else { novoStatus = 'triagem_ia'; respostaIA = "(Simulação sem API Key) Olá! Você deseja comprar, alugar ou anunciar conosco?"; }
    }

    // Se houve mudança no nível/funil, atualiza no Kanban via tabela 'contacts'
    if (novoIntent !== contact.intent || novoStatus !== contact.status) {
      await supabase
        .from('contacts')
        .update({ intent: novoIntent, status: novoStatus })
        .eq('id', contact.id);
      console.log(`🤖 CÉREBRO IA atualizou Kanban: Funil '${novoIntent}' -> Coluna '${novoStatus}'`);
    }

    // Aguarda o término da inserção diretamente, sem setTimeout, para que a 
    // promessa principal seja cumprida no tempo exato que o Gemini respondeu
    await supabase.from('messages').insert([{
      contact_id: contact.id,
      sender_type: 'ai_agent',
      content: respostaIA
    }]);
    
    return true; // Sucesso

  } catch (err) {
    console.error("Erro no Motor IA:", err);
    return false;
  }
}

export function startAIEngine() {
  console.log("🤖 Motor de Inteligência Artificial ImobAI Iniciado!");

  const subscription = supabase
    .channel('ai_listener')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
        processAILogic(payload.new);
      }
    )
    .subscribe();

  return subscription;
}
