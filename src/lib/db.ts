import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Database connection string is missing in environment variables');
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2500, // Fast 2.5s failover for cloud environments
    });

    pool.on('error', (err) => {
      console.warn('Unexpected error on idle pg client:', err.message);
    });
  }
  return pool;
}

/**
 * Execute a query with fast failover.
 * If direct PostgreSQL connection is unreachable (e.g. IPv6 restrictions on serverless/cloud hosting),
 * it returns null so callers can seamlessly fall back to Supabase HTTPS REST API.
 */
export async function tryDirectQuery<T>(fn: (pool: Pool) => Promise<T>): Promise<T | null> {
  try {
    const dbPool = getDbPool();
    return await fn(dbPool);
  } catch (err: unknown) {
    const error = err as Error;
    console.warn('[Direct DB Engine Warning] Direct Postgres connection unavailable, falling back to Supabase HTTPS Service-Role:', error.message);
    return null;
  }
}

