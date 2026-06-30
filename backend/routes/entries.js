const express = require('express');
const pool    = require('../../database');
const { verifyToken }                = require('../middleware/auth');
const { requireBoss, requireBroker, requireBossOrEmployee, requireAnyRole } = require('../middleware/roleCheck');
const { getFamilyByPana, getSPByAnk, getDPByAnk } = require('../utils/panaFamilies');

const router = express.Router();

function detectPanaType(pana) {
    const d = pana.split('');
    if (d[0] === d[1] && d[1] === d[2]) return 'triple_pana';
    if (d[0] === d[1] || d[1] === d[2] || d[0] === d[2]) return 'double_pana';
    return 'single_pana';
}

function formatToken(code, date, seq) {
    const d  = new Date(date);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${code}-${dd}${mm}${yy}-${String(seq).padStart(6, '0')}`;
}

// POST /api/entries  (broker only)
router.post('/', verifyToken, requireBroker, async (req, res) => {
    const client = await pool.connect();
    try {
        const { market_id, session, entries, notes } = req.body;

        if (!market_id || !session || !Array.isArray(entries) || !entries.length)
            return res.status(400).json({ error: 'market_id, session and entries are required' });
        if (!['open', 'close'].includes(session))
            return res.status(400).json({ error: 'session must be open or close' });

        // Resolve broker record from logged-in user
        const brokerRes = await client.query(
            'SELECT id FROM brokers WHERE user_id=$1 AND is_active=TRUE',
            [req.user.id]
        );
        if (!brokerRes.rows.length)
            return res.status(403).json({ error: 'Active broker account not found' });
        const brokerId = brokerRes.rows[0].id;

        // Fetch market and validate status + cutoff time
        const marketRes = await client.query(
            'SELECT * FROM markets WHERE id=$1 AND is_active=TRUE',
            [market_id]
        );
        if (!marketRes.rows.length)
            return res.status(400).json({ error: 'Market not found or inactive' });
        const market = marketRes.rows[0];

        const cutoffField  = session === 'open' ? 'open_time'   : 'close_time';
        const statusField  = session === 'open' ? 'open_status' : 'close_status';
        const cutoffTime   = market[cutoffField];
        const marketStatus = market[statusField];

        if (marketStatus === 'stopped')
            return res.status(400).json({ error: `${session} session is stopped for this market` });

        // Block if result already declared for today (IST date)
        const resultCheck = await client.query(
            `SELECT status FROM results
             WHERE market_id=$1 AND result_date=(NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
            [market_id]
        );
        if (resultCheck.rows.length) {
            const rs = resultCheck.rows[0].status;
            if (rs === 'complete')
                return res.status(400).json({ error: 'Market closed. Result already declared.' });
            if (rs === 'open_declared' && session === 'open')
                return res.status(400).json({ error: 'Open result declared. Cannot submit open bets.' });
        }

        // Compare server time (HH:MM) against cutoff
        const nowTime = await client.query(`SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS t`);
        const serverHHMM = nowTime.rows[0].t;
        if (serverHHMM >= cutoffTime)
            return res.status(400).json({ error: `${session} cutoff time has passed (${cutoffTime})` });

        // Fetch all payout rates into a map
        const ratesRes = await client.query(`SELECT bet_type, rate FROM payout_rates WHERE is_active=TRUE`);
        const rates = {};
        for (const r of ratesRes.rows) rates[r.bet_type] = parseFloat(r.rate);

        // Validate and enrich each entry
        const enriched = [];
        for (const entry of entries) {
            const { bet_type, number, amount } = entry;
            const parsedAmount = parseFloat(amount);
            if (!bet_type || number === undefined || number === null || !isFinite(parsedAmount) || parsedAmount <= 0)
                return res.status(400).json({ error: 'Each entry needs bet_type, number, and amount > 0' });

            const rawNumber = String(number).trim();
            if (!rawNumber) return res.status(400).json({ error: 'number is required' });

            // Always keep as padded 3-char string — never parseInt (000 would become 0)
            const numStr = bet_type === 'pana' || ['single_pana','double_pana','triple_pana'].includes(bet_type)
                ? rawNumber.padStart(3, '0')
                : rawNumber;
            let resolvedType = bet_type;

            if (bet_type === 'pana') {
                if (!/^\d{3}$/.test(numStr))
                    return res.status(400).json({ error: `Invalid pana format: ${numStr}` });
                const panaRes = await client.query(
                    'SELECT pana FROM valid_panas WHERE pana=$1',
                    [numStr]
                );
                if (!panaRes.rows.length)
                    return res.status(400).json({ error: `Invalid Pana: ${numStr}` });
                resolvedType = detectPanaType(numStr);
            } else if (['single_pana', 'double_pana', 'triple_pana'].includes(bet_type)) {
                const panaRes = await client.query(
                    'SELECT pana FROM valid_panas WHERE pana=$1',
                    [numStr]
                );
                if (!panaRes.rows.length)
                    return res.status(400).json({ error: `Invalid Pana: ${numStr}` });
                const detected = detectPanaType(numStr);
                if (detected !== bet_type)
                    return res.status(400).json({ error: `Pana ${numStr} is ${detected}, not ${bet_type}` });
            } else if (bet_type === 'single_ank') {
                if (!/^[0-9]$/.test(numStr))
                    return res.status(400).json({ error: `single_ank must be 0-9, got: ${numStr}` });
            } else if (bet_type === 'jodi') {
                if (!/^\d{2}$/.test(numStr))
                    return res.status(400).json({ error: `jodi must be 2 digits, got: ${numStr}` });
            } else {
                return res.status(400).json({ error: `Unknown bet_type: ${bet_type}` });
            }

            const rate = rates[resolvedType];
            if (!rate)
                return res.status(400).json({ error: `No active payout rate for ${resolvedType}` });

            enriched.push({
                bet_type:         resolvedType,
                number:           numStr,
                amount:           parsedAmount,
                potential_payout: parsedAmount * rate,
            });
        }

        await client.query('BEGIN');

        // Generate token sequence
        const countRes = await client.query(
            `SELECT COUNT(*) FROM entry_batches WHERE market_id=$1 AND entry_date=NOW()::date`,
            [market_id]
        );
        const seq   = parseInt(countRes.rows[0].count) + 1;
        const today = await client.query(`SELECT NOW()::date AS d`);
        const token = formatToken(market.code, today.rows[0].d, seq);

        const totalAmount = enriched.reduce((s, e) => s + e.amount, 0);

        const batchRes = await client.query(
            `INSERT INTO entry_batches
               (broker_id, market_id, entry_date, session, status, total_amount, token, notes)
             VALUES ($1, $2, NOW()::date, $3, 'confirmed', $4, $5, $6)
             RETURNING *`,
            [brokerId, market_id, session, totalAmount, token, notes || null]
        );
        const batch = batchRes.rows[0];

        for (const e of enriched) {
            await client.query(
                `INSERT INTO entry_items (batch_id, bet_type, number, amount, potential_payout)
                 VALUES ($1, $2, $3, $4, $5)`,
                [batch.id, e.bet_type, e.number, e.amount, e.potential_payout]
            );
        }

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'CREATE_ENTRY', 'entry_batches', $2, $3)`,
            [req.user.id, batch.id, JSON.stringify({ token, market_id, session, totalAmount })]
        );

        await client.query('COMMIT');

        req.app.get('io').emit('new_entry', {
            token,
            broker_id:    brokerId,
            market_id,
            market_name:  market.name,
            session,
            total_amount: totalAmount,
            entry_count:  enriched.length,
        });

        res.status(201).json({ token, batch, entries: enriched });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// POST /api/entries/on-behalf  (boss + employee — submit on behalf of a broker)
router.post('/on-behalf', verifyToken, requireBossOrEmployee, async (req, res) => {
    const client = await pool.connect();
    try {
        const { broker_id, market_id, entries, notes } = req.body;
        const session = req.body.session ?? req.body.bet_side;

        if (!broker_id || !market_id || !session || !Array.isArray(entries) || !entries.length)
            return res.status(400).json({ error: 'broker_id, market_id, session and entries are required' });
        if (!['open', 'close'].includes(session))
            return res.status(400).json({ error: 'session must be open or close' });

        // Validate broker
        const brokerRes = await client.query(
            'SELECT id, name FROM brokers WHERE id=$1 AND is_active=TRUE',
            [broker_id]
        );
        if (!brokerRes.rows.length)
            return res.status(403).json({ error: 'Broker not found or inactive' });
        const brokerId   = brokerRes.rows[0].id;
        const brokerName = brokerRes.rows[0].name;

        // Fetch market and validate
        const marketRes = await client.query(
            'SELECT * FROM markets WHERE id=$1 AND is_active=TRUE',
            [market_id]
        );
        if (!marketRes.rows.length)
            return res.status(400).json({ error: 'Market not found or inactive' });
        const market = marketRes.rows[0];

        const cutoffField  = session === 'open' ? 'open_time'   : 'close_time';
        const statusField  = session === 'open' ? 'open_status' : 'close_status';
        const cutoffTime   = market[cutoffField];
        const marketStatus = market[statusField];

        if (marketStatus === 'stopped')
            return res.status(400).json({ error: `${session} session is stopped for this market` });

        const resultCheck = await client.query(
            `SELECT status FROM results
             WHERE market_id=$1 AND result_date=(NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
            [market_id]
        );
        if (resultCheck.rows.length) {
            const rs = resultCheck.rows[0].status;
            if (rs === 'complete')
                return res.status(400).json({ error: 'Market closed. Result already declared.' });
            if (rs === 'open_declared' && session === 'open')
                return res.status(400).json({ error: 'Open result declared. Cannot submit open bets.' });
        }

        const nowTime = await client.query(`SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS t`);
        const serverHHMM = nowTime.rows[0].t;
        if (serverHHMM >= cutoffTime)
            return res.status(400).json({ error: `${session} cutoff time has passed (${cutoffTime})` });

        // Fetch payout rates
        const ratesRes = await client.query(`SELECT bet_type, rate FROM payout_rates WHERE is_active=TRUE`);
        const rates = {};
        for (const r of ratesRes.rows) rates[r.bet_type] = parseFloat(r.rate);

        // Validate and enrich entries
        const enriched = [];
        for (const entry of entries) {
            const { bet_type, number, amount } = entry;
            const parsedAmount = parseFloat(amount);
            if (!bet_type || number === undefined || number === null || !isFinite(parsedAmount) || parsedAmount <= 0)
                return res.status(400).json({ error: 'Each entry needs bet_type, number, and amount > 0' });

            const rawNumber = String(number).trim();
            if (!rawNumber) return res.status(400).json({ error: 'number is required' });

            const numStr = bet_type === 'pana' || ['single_pana', 'double_pana', 'triple_pana'].includes(bet_type)
                ? rawNumber.padStart(3, '0')
                : rawNumber;
            let resolvedType = bet_type;

            if (bet_type === 'pana') {
                if (!/^\d{3}$/.test(numStr))
                    return res.status(400).json({ error: `Invalid pana format: ${numStr}` });
                const panaRes = await client.query('SELECT pana FROM valid_panas WHERE pana=$1', [numStr]);
                if (!panaRes.rows.length)
                    return res.status(400).json({ error: `Invalid Pana: ${numStr}` });
                resolvedType = detectPanaType(numStr);
            } else if (['single_pana', 'double_pana', 'triple_pana'].includes(bet_type)) {
                const panaRes = await client.query('SELECT pana FROM valid_panas WHERE pana=$1', [numStr]);
                if (!panaRes.rows.length)
                    return res.status(400).json({ error: `Invalid Pana: ${numStr}` });
                const detected = detectPanaType(numStr);
                if (detected !== bet_type)
                    return res.status(400).json({ error: `Pana ${numStr} is ${detected}, not ${bet_type}` });
            } else if (bet_type === 'single_ank') {
                if (!/^[0-9]$/.test(numStr))
                    return res.status(400).json({ error: `single_ank must be 0-9, got: ${numStr}` });
            } else if (bet_type === 'jodi') {
                if (!/^\d{2}$/.test(numStr))
                    return res.status(400).json({ error: `jodi must be 2 digits, got: ${numStr}` });
            } else {
                return res.status(400).json({ error: `Unknown bet_type: ${bet_type}` });
            }

            const rate = rates[resolvedType];
            if (!rate)
                return res.status(400).json({ error: `No active payout rate for ${resolvedType}` });

            enriched.push({
                bet_type:         resolvedType,
                number:           numStr,
                amount:           parsedAmount,
                potential_payout: parsedAmount * rate,
            });
        }

        await client.query('BEGIN');

        const countRes = await client.query(
            `SELECT COUNT(*) FROM entry_batches WHERE market_id=$1 AND entry_date=NOW()::date`,
            [market_id]
        );
        const seq   = parseInt(countRes.rows[0].count) + 1;
        const today = await client.query(`SELECT NOW()::date AS d`);
        const token = formatToken(market.code, today.rows[0].d, seq);

        const totalAmount = enriched.reduce((s, e) => s + e.amount, 0);

        const batchRes = await client.query(
            `INSERT INTO entry_batches
               (broker_id, market_id, entry_date, session, status, total_amount, token, notes,
                submitted_by, submitted_by_role)
             VALUES ($1, $2, NOW()::date, $3, 'confirmed', $4, $5, $6, $7, $8)
             RETURNING *`,
            [brokerId, market_id, session, totalAmount, token, notes || null,
             req.user.id, req.user.role]
        );
        const batch = batchRes.rows[0];

        for (const e of enriched) {
            await client.query(
                `INSERT INTO entry_items (batch_id, bet_type, number, amount, potential_payout)
                 VALUES ($1, $2, $3, $4, $5)`,
                [batch.id, e.bet_type, e.number, e.amount, e.potential_payout]
            );
        }

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'entry_submitted_by_employee', 'entry_batches', $2, $3)`,
            [req.user.id, batch.id,
             JSON.stringify({ broker_id: brokerId, broker_name: brokerName,
                              submitted_by_role: req.user.role, token, totalAmount })]
        );

        await client.query('COMMIT');

        req.app.get('io').emit('new_entry', {
            token,
            broker_id:          brokerId,
            market_id,
            market_name:        market.name,
            session,
            total_amount:       totalAmount,
            entry_count:        enriched.length,
            submitted_by_role:  req.user.role,
        });

        res.status(201).json({ token, batch, entries: enriched });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// GET /api/entries/family/:pana  (broker + boss + employee — pana family lookup)
router.get('/family/:pana', verifyToken, requireAnyRole, (req, res) => {
    const pana = String(req.params.pana).padStart(3, '0');
    if (!/^\d{3}$/.test(pana)) return res.status(400).json({ error: 'pana must be 3 digits' });
    const result = getFamilyByPana(pana);
    res.json({
        found:       result.members.length > 0,
        input_pana:  result.inputPana,
        pool:        result.pool,
        cuts:        result.cuts,
        members:     result.members,
        count:       result.count,
    });
});

// GET /api/entries/sp/:ank  (broker + boss + employee — SP panas for a given ank digit)
router.get('/sp/:ank', verifyToken, requireAnyRole, (req, res) => {
    const { ank } = req.params;
    if (!/^[0-9]$/.test(ank)) return res.status(400).json({ error: 'ank must be a single digit 0–9' });
    res.json(getSPByAnk(ank));
});

// GET /api/entries/dp/:ank  (broker + boss + employee — DP panas for a given ank digit)
router.get('/dp/:ank', verifyToken, requireAnyRole, (req, res) => {
    const { ank } = req.params;
    if (!/^[0-9]$/.test(ank)) return res.status(400).json({ error: 'ank must be a single digit 0–9' });
    res.json(getDPByAnk(ank));
});

// GET /api/entries/all  (boss + employee — with filters)
router.get('/all', verifyToken, requireBossOrEmployee, async (req, res) => {
    try {
        const { market_id, date, broker_id, bet_type } = req.query;

        const conditions = [];
        const params     = [];
        let   p          = 1;

        if (market_id) { conditions.push(`eb.market_id = $${p++}`);   params.push(market_id); }
        if (date)       { conditions.push(`eb.entry_date = $${p++}`);  params.push(date); }
        if (broker_id)  { conditions.push(`eb.broker_id = $${p++}`);   params.push(broker_id); }
        if (bet_type)   { conditions.push(`ei.bet_type   = $${p++}`);  params.push(bet_type); }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const { rows } = await pool.query(`
            SELECT
                eb.id AS batch_id, eb.token, eb.entry_date, eb.session,
                eb.status, eb.total_amount, eb.notes,
                eb.created_at AS submitted_at,
                b.broker_code, b.name AS broker_name,
                m.name AS market_name, m.code AS market_code,
                ei.id AS item_id, ei.bet_type, ei.number, ei.amount,
                ei.potential_payout, ei.actual_payout, ei.is_winner,
                u.username AS submitted_by_username,
                eb.submitted_by_role,
                CASE
                    WHEN eb.submitted_by_role = 'employee' THEN emp.name
                    WHEN eb.submitted_by_role = 'broker'   THEN b.name || ' (Self)'
                    ELSE 'Boss'
                END AS submitted_by_display
            FROM entry_batches eb
            JOIN brokers b      ON eb.broker_id    = b.id
            JOIN markets m      ON eb.market_id    = m.id
            JOIN entry_items ei ON ei.batch_id     = eb.id
            LEFT JOIN users u   ON eb.submitted_by = u.id
            LEFT JOIN employees emp ON emp.user_id = eb.submitted_by
            ${where}
            ORDER BY eb.entry_date DESC, eb.created_at DESC
        `, params);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/entries  (broker — own entries only, grouped with items)
router.get('/', verifyToken, requireBroker, async (req, res) => {
    try {
        const brokerRes = await pool.query(
            'SELECT id FROM brokers WHERE user_id=$1',
            [req.user.id]
        );
        if (!brokerRes.rows.length) return res.status(404).json({ error: 'Broker not found' });
        const brokerId = brokerRes.rows[0].id;

        const { date, market_id } = req.query;
        const conditions = ['eb.broker_id = $1'];
        const params     = [brokerId];
        let   p          = 2;

        if (date)      { conditions.push(`eb.entry_date = $${p++}`); params.push(date); }
        if (market_id) { conditions.push(`eb.market_id  = $${p++}`); params.push(market_id); }

        const { rows } = await pool.query(`
            SELECT
                eb.id          AS batch_id,
                eb.token,
                eb.entry_date,
                eb.session,
                eb.status,
                eb.total_amount,
                eb.market_id,
                eb.created_at  AS submitted_at,
                m.name         AS market_name,
                m.code         AS market_code,
                json_agg(
                    json_build_object(
                        'item_id',          ei.id,
                        'bet_type',         ei.bet_type,
                        'number',           ei.number,
                        'amount',           ei.amount,
                        'potential_payout', ei.potential_payout,
                        'actual_payout',    ei.actual_payout,
                        'is_winner',        ei.is_winner
                    ) ORDER BY ei.created_at
                ) AS items
            FROM entry_batches eb
            JOIN markets m      ON eb.market_id = m.id
            JOIN entry_items ei ON ei.batch_id  = eb.id
            WHERE ${conditions.join(' AND ')}
            GROUP BY eb.id, eb.token, eb.entry_date, eb.session, eb.status,
                     eb.total_amount, eb.market_id, eb.created_at, m.name, m.code
            ORDER BY eb.entry_date DESC, eb.created_at DESC
        `, params);

        res.json({ success: true, entries: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/entries/:id/cancel  (boss only)
router.put('/:id/cancel', verifyToken, requireBoss, async (req, res) => {
    try {
        const old = await pool.query('SELECT * FROM entry_batches WHERE id=$1', [req.params.id]);
        if (!old.rows.length) return res.status(404).json({ error: 'Entry batch not found' });
        if (old.rows[0].status === 'settled')
            return res.status(400).json({ error: 'Cannot cancel a settled batch' });

        const { rows } = await pool.query(
            `UPDATE entry_batches SET status='cancelled' WHERE id=$1 RETURNING *`,
            [req.params.id]
        );

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
             VALUES ($1, 'CANCEL_ENTRY', 'entry_batches', $2, $3, $4)`,
            [req.user.id, req.params.id,
             JSON.stringify({ status: old.rows[0].status }),
             JSON.stringify({ status: 'cancelled' })]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/entries/items/:id/edit  (boss only)
router.put('/items/:id/edit', verifyToken, requireBoss, async (req, res) => {
    try {
        const { amount, number } = req.body;
        if (!amount && !number)
            return res.status(400).json({ error: 'Provide amount or number to update' });

        const oldRes = await pool.query('SELECT * FROM entry_items WHERE id=$1', [req.params.id]);
        if (!oldRes.rows.length) return res.status(404).json({ error: 'Entry item not found' });
        const old = oldRes.rows[0];

        // If number changes, re-validate pana
        let resolvedNumber = old.number;
        let resolvedType   = old.bet_type;
        if (number && ['single_pana', 'double_pana', 'triple_pana'].includes(old.bet_type)) {
            const panaRes = await pool.query('SELECT 1 FROM valid_panas WHERE pana=$1', [String(number)]);
            if (!panaRes.rows.length) return res.status(400).json({ error: `Invalid pana: ${number}` });
            resolvedNumber = String(number);
            resolvedType   = detectPanaType(resolvedNumber);
        } else if (number) {
            resolvedNumber = String(number);
        }

        const newAmount = amount ? parseFloat(amount) : parseFloat(old.amount);

        // Re-fetch rate if type changed
        const rateRes = await pool.query(
            'SELECT rate FROM payout_rates WHERE bet_type=$1 AND is_active=TRUE',
            [resolvedType]
        );
        const rate = rateRes.rows.length ? parseFloat(rateRes.rows[0].rate) : 0;

        const { rows } = await pool.query(
            `UPDATE entry_items
             SET number=$1, amount=$2, bet_type=$3, potential_payout=$4
             WHERE id=$5
             RETURNING *`,
            [resolvedNumber, newAmount, resolvedType, newAmount * rate, req.params.id]
        );

        // Recalculate batch total
        await pool.query(
            `UPDATE entry_batches
             SET total_amount = (SELECT SUM(amount) FROM entry_items WHERE batch_id=$1)
             WHERE id=$1`,
            [old.batch_id]
        );

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
             VALUES ($1, 'EDIT_ENTRY_ITEM', 'entry_items', $2, $3, $4)`,
            [req.user.id, req.params.id,
             JSON.stringify({ number: old.number, amount: old.amount, bet_type: old.bet_type }),
             JSON.stringify({ number: resolvedNumber, amount: newAmount, bet_type: resolvedType })]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
