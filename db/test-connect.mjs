import pkg from 'pg';
const { Client } = pkg;

const password = 'YQ7xwQPt6c@194756';

const configs = [
  // Direct connection, postgres user
  { host: 'db.bwpodttatghuwhfhlxts.supabase.co', port: 5432, user: 'postgres', database: 'postgres', password, ssl: { rejectUnauthorized: false } },
  // Direct connection, no SSL
  { host: 'db.bwpodttatghuwhfhlxts.supabase.co', port: 5432, user: 'postgres', database: 'postgres', password, ssl: false },
  // Pooler session mode
  { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 5432, user: 'postgres.bwpodttatghuwhfhlxts', database: 'postgres', password, ssl: { rejectUnauthorized: false } },
  // Pooler transaction mode
  { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543, user: 'postgres.bwpodttatghuwhfhlxts', database: 'postgres', password, ssl: { rejectUnauthorized: false } },
];

for (const [i, cfg] of configs.entries()) {
  const c = new Client(cfg);
  try {
    await c.connect();
    const r = await c.query('SELECT version()');
    console.log(`✅ Config ${i+1} WORKS: ${cfg.host}:${cfg.port} user=${cfg.user}`);
    console.log('   ', r.rows[0].version.split(' ').slice(0,2).join(' '));
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log(`❌ Config ${i+1} failed (${cfg.host}:${cfg.port} user=${cfg.user}): ${e.message}`);
    try { await c.end(); } catch {}
  }
}
