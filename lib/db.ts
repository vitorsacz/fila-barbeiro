import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';

type Query = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;
let _q: Query | null = null;

/**
 * Banco de dados com a mesma interface (tagged template → linhas) nos dois ambientes:
 * - Neon (produção): driver HTTP do Neon, ideal para funções serverless.
 * - Postgres local (Docker): driver `pg` comum, porque o driver do Neon não fala com Postgres puro.
 * A escolha é automática pelo host da DATABASE_URL.
 */
export function db(): Query {
  if (_q) return _q;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');

  const host = new URL(url).hostname;
  const local = ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(host) || process.env.DB_DRIVER === 'pg';

  if (!local) {
    _q = neon(url) as unknown as Query;
    return _q;
  }

  const g = globalThis as any;
  const pool: Pool = g.__nvPool || (g.__nvPool = new Pool({ connectionString: url, max: 5 }));
  _q = async (strings, ...values) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}` + strings[i + 1];
    const r = await pool.query(text, values);
    return r.rows;
  };
  return _q;
}
