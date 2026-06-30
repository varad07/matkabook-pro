/**
 * seed-demo-data.js
 * Seeds realistic demo entries so screenshots look populated.
 * Run: node scripts/seed-demo-data.js
 */

const http = require('http');

const BASE = 'http://localhost:5000';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: 'localhost',
      port: 5000,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🌱  Seeding demo data for MatkaBook Pro screenshots...\n');

  // ── Login as boss ─────────────────────────────────────────────
  const loginBoss = await request('POST', '/api/auth/login', {
    username: 'boss', password: 'boss123',
  });
  if (!loginBoss.body.token) {
    console.error('Boss login failed:', loginBoss.body);
    process.exit(1);
  }
  const bossToken = loginBoss.body.token;
  console.log('✅  Boss logged in');

  // ── Get markets ────────────────────────────────────────────────
  const mktsRes = await request('GET', '/api/markets', null, bossToken);
  const markets = mktsRes.body;
  if (!markets.length) { console.error('No markets found'); process.exit(1); }
  const market = markets[0];
  console.log(`✅  Using market: ${market.name} (${market.id})`);

  // ── Get brokers ────────────────────────────────────────────────
  const brkRes = await request('GET', '/api/brokers', null, bossToken);
  const brokers = brkRes.body;
  if (!brokers.length) { console.error('No brokers found'); process.exit(1); }
  console.log(`✅  ${brokers.length} broker(s) available`);

  // ── Submit entries as each broker ──────────────────────────────
  const entryBatches = [
    {
      brokerCreds: { username: 'brk001', password: 'broker123' },
      entries: [
        { bet_type: 'single_ank', number: '5',   amount: 500  },
        { bet_type: 'single_ank', number: '3',   amount: 300  },
        { bet_type: 'jodi',       number: '47',  amount: 1000 },
        { bet_type: 'jodi',       number: '25',  amount: 750  },
        { bet_type: 'pana',       number: '123', amount: 200  },
        { bet_type: 'pana',       number: '456', amount: 200  },
      ],
      session: 'open',
    },
  ];

  for (const batch of entryBatches) {
    const loginRes = await request('POST', '/api/auth/login', batch.brokerCreds);
    if (!loginRes.body.token) {
      console.warn(`  ⚠️  Broker login failed for ${batch.brokerCreds.username}, skipping`);
      continue;
    }
    const brkToken = loginRes.body.token;

    const submitRes = await request(
      'POST', '/api/entries/',
      { market_id: market.id, session: batch.session, entries: batch.entries },
      brkToken
    );
    if (submitRes.status === 201) {
      console.log(`✅  Submitted ${batch.entries.length} entries as ${batch.brokerCreds.username} — token: ${submitRes.body.token}`);
    } else {
      console.warn(`  ⚠️  Submit failed (${submitRes.status}):`, JSON.stringify(submitRes.body));
    }
  }

  // ── Submit on-behalf as boss (uses first broker) ───────────────
  if (brokers.length) {
    const onBehalfEntries = [
      { bet_type: 'pana',       number: '678', amount: 400 },
      { bet_type: 'single_ank', number: '9',   amount: 600 },
      { bet_type: 'jodi',       number: '36',  amount: 850 },
    ];
    const obRes = await request(
      'POST', '/api/entries/on-behalf',
      {
        broker_id: brokers[0].id,
        market_id: market.id,
        session: 'open',
        entries: onBehalfEntries,
      },
      bossToken
    );
    if (obRes.status === 201) {
      console.log(`✅  Boss submitted ${onBehalfEntries.length} on-behalf entries for ${brokers[0].name}`);
    } else {
      console.warn(`  ⚠️  On-behalf submit failed (${obRes.status}):`, JSON.stringify(obRes.body));
    }
  }

  console.log('\n🎉  Demo data seeding complete. App is ready for screenshots.');
}

main().catch((err) => { console.error(err); process.exit(1); });
