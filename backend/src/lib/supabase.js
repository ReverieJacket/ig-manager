/**
 * Cliente Supabase compartilhado.
 *
 * Usa a chave de serviço (service role), que ignora o Row Level Security.
 * Por isso este módulo só pode ser usado no backend: nunca exponha a
 * chave ao frontend.
 */
const { createClient } = require("@supabase/supabase-js");

const { config, exigirVariaveis } = require("../config/env");

exigirVariaveis(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

/** Instância única do cliente (reaproveitada por todos os repositórios). */
const supabase = createClient(
    config.supabase.url,
    config.supabase.chaveServico,
    {
        // Processo de servidor: não há sessão de usuário para persistir.
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

module.exports = { supabase };
