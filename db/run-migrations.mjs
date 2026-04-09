import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
const { Client } = pkg;

const __dir = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  host: 'db.bwpodttatghuwhfhlxts.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'YQ7xwQPt6c@194756',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('✓ Connected to Supabase');

  const schema = readFileSync(join(__dir, 'schema.sql'), 'utf8');
  const auth   = readFileSync(join(__dir, 'auth-functions.sql'), 'utf8');
  const v2     = readFileSync(join(__dir, 'migrate-v2.sql'), 'utf8');

  console.log('\n▶ Running schema.sql...');
  await client.query(schema);
  console.log('✓ schema.sql done');

  console.log('\n▶ Running auth-functions.sql...');
  await client.query(auth);
  console.log('✓ auth-functions.sql done');

  console.log('\n▶ Running migrate-v2.sql...');
  await client.query(v2);
  console.log('✓ migrate-v2.sql done');

  await client.end();
  console.log('\n✅ All migrations complete!');
}

run().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
