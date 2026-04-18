import { supabase } from './supabase';

const AI_DELAY = 1000; // Delay menor pois a chamada à API já demora um pouquinho

async function callGenerativeAI(contactId, messageText, currentIntent, currentStatus) {
  // Ler configuração da interface gráfica local
  const savedConfigStr = localStorage.getItem('imobai_ai_config');
  let localConfig = { active: true, apiKey: '', agentName: 'Corretor Virtual ImobAI', prompt: '', policies: '', catalog: '', contextDocs: '' };
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
  const baseInstruction = localConfig.prompt || "Você é um corretor virtual simpático e prestativo.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // 1. MEMÓRIA: Buscar as últimas mensagens do banco para contexto da conversa
  let geminiContents = [];
  try {
    const { data: historyItems } = await supabase
      .from('messages')
      .select('sender_type, content')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (historyItems) {
      // Ignoramos a mensagem atual caso o webhook já tenha inserido, e revertemos a ordem para cronológica
      geminiContents = historyItems
        .filter(msg => msg.content !== messageText)
        .reverse()
        .map(msg => ({
          role: msg.sender_type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));
    }
  } catch (err) {
    console.error("Erro ao puxar histórico de memória:", err);
  }

  // Adicionamos a fala mais recente obrigatoriamente no final
  geminiContents.push({
    role: "user",
    parts: [{ text: messageText }]
  });

  // 2. ANTI-ALUCINAÇÃO E REGRAS MANDATÓRIAS (System Instruction)
  const systemInstructionText = `INSTRUÇÕES BASE E PERSONALIDADE:
O seu nome é: ${agentName}.
${baseInstruction}

REGRAS ESTRITAS E POLÍTICAS DE ATENDIMENTO (TRAVA ANTI-ALUCINAÇÃO):
As seguintes regras são a LEI. Nunca as viole, nunca invente informações fora delas:
${localConfig.policies || '1. Seja educado e responda com base nos conhecimentos da imobiliária.'}

CONTEXTO INSTITUCIONAL E MATERIAL DE CONSULTA (FAQ):
Utilize o material abaixo para responder a dúvidas gerais sobre a empresa, regras de locação, documentos e forma de trabalho:
${localConfig.contextDocs || 'Nenhuma FAQ ou material institucional fornecido.'}

CATÁLOGO DE IMÓVEIS E BASE DE CONHECIMENTO DISPONÍVEL:
Só oferte imóveis que estejam explícitos na lista abaixo. Se o cliente perguntar algo que não está aqui, diga que não encontrou ou vai ver com a equipe:
${localConfig.catalog || 'Nenhum catálogo específico cadastrado.'}

MECÂNICA E FORMATO DE SAÍDA MANDATÓRIO (JSON):
Sua resposta DITA O SISTEMA. Analise a memória da conversa mais acima, o status atual (${currentStatus}) e a intenção atual (${currentIntent}).
RETORNE EXATAMENTE UM JSON VÁLIDO.
{
  "resposta": "Sua mensagem pro cliente conversando de forma natural e empática, seguindo as regras Anti-Alucinação.",
  "intent": "vendas" | "locacao" | "captacao" | "indefinido",
  "status": "novo_contato" | "triagem_ia" | "qualificado" | "novo_lead" (Altere para novo_lead se o cliente pedir atendimento humano claro)
}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstructionText }] },
        contents: geminiContents,
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

    // Chama o cébero real (Gemini) passando o contato, histórico em memória e estado atual
    const aiMinds = await callGenerativeAI(contact.id, newMessage.content, contact.intent, contact.status);

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
