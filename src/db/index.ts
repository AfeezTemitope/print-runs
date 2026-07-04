import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Lazy init so `next build` doesn't need DATABASE_URL at import time.
let _db: NeonHttpDatabase<typeof schema> | null = null;

export function db() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

export * as tables from './schema';
