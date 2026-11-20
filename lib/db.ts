import { neon } from '@neondatabase/serverless';

type Sql = ReturnType<typeof neon>;
let _sql: Sql | null = null;

/** Conexão HTTP com o Neon, criada só na primeira query (o build não precisa do banco). */
export function db(): (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql as any;
}
