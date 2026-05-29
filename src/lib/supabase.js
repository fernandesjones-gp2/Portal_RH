import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://placeholder.supabase.co';

// Valida a URL: se vier ausente ou inválida (ex.: env mal configurada no
// deploy), cai no placeholder válido para NÃO quebrar o build (prerender).
// Em runtime o app só conecta de verdade com a Project URL correta.
function resolveSupabaseUrl(url) {
  try {
    return new URL(url).protocol.startsWith('http') ? url : FALLBACK_URL;
  } catch {
    if (typeof console !== 'undefined') {
      console.warn(
        '[supabase] NEXT_PUBLIC_SUPABASE_URL ausente ou inválida — usando placeholder. ' +
          'Configure a Project URL (https://<ref>.supabase.co) nas variáveis de ambiente.'
      );
    }
    return FALLBACK_URL;
  }
}

const supabaseUrl = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
