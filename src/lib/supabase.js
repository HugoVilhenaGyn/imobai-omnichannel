import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('EXEMPLO') || supabaseAnonKey.includes('EXEMPLO')) {
  console.error('⚠️ Faltam as credenciais do Supabase no arquivo .env ou elas são inválidas.')
}

const client = createClient(supabaseUrl, supabaseAnonKey)

// Helper para verificar conexão rápida
export const checkConnection = async () => {
  try {
    const { data, error } = await client.from('contacts').select('id', { count: 'exact', head: true }).limit(1);
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const supabase = client
