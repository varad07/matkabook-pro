const express = require('express');
const pool    = require('../../database');
const { verifyToken }  = require('../middleware/auth');
const { requireBoss } = require('../middleware/roleCheck');

const router = express.Router();

// Normalize a bet number for winner comparison
function normalizeForCompare(value, betType) {
    const v = String(value == null ? '' : value).trim();
    if (betType === 'single_ank') return v.replace(/^0+/, '') || '0';
    if (betType === 'jodi')       return v.padStart(2, '0');
    return v.padStart(3, '0'); // single_pana, double_pana, triple_pana
}

// Safe parseFloat: returns 0 for NaN/null/undefined to prevent JSON.stringify(NaN)=null poison
function safeFloat(val) {
    const n = parseFloat(val);
    return isFinite(n) ? n : 0;
}

// POST /api/results/declare-open
router.post('/declare-open', verifyToken, requireBoss, async (req, res) => {
    const client = await pool.connect();
    try {
        const { market_id, date } = req.body;
        const raw_open_pana = req.body.open_pana;
        if (!market_id || !date || raw_open_pana === undefined || raw_open_pana === null || String(raw_open_pana).trim() === '')
            return res.status(400).json({ error: 'market_id, date and open_pana are required' });
        const open_pana = String(raw_open_pana).padStart(3, '0');

        const panaRes = await client.query(
            'SELECT ank FROM valid_panas WHERE pana=$1',
            [open_pana]
        );
        if (!panaRes.rows.length)
            return res.status(400).json({ error: `Invalid pana: ${open_pana}` });
        const openAnk = panaRes.rows[0].ank;

        await client.query('BEGIN');

        // Upsert: if result row already exists for this market/date update it, else insert
        const { rows } = await client.query(
            `INSERT INTO results
               (market_id, result_date, open_pana, open_ank, status, declared_by, declared_at)
             VALUES ($1, $2, $3, $4, 'open_declared', $5, NOW())
             ON CONFLICT (market_id, result_date)
             DO UPDATE SET
               open_pana   = EXCLUDED.open_pana,
               open_ank    = EXCLUDED.open_ank,
               status      = 'open_declared',
               declared_by = EXCLUDED.declared_by,
               declared_at = NOW()
             RETURNING *`,
            [market_id, date, open_pana, openAnk, req.user.id]
        );
        const result = rows[0];

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'DECLARE_OPEN', 'results', $2, $3)`,
            [req.user.id, result.id, JSON.stringify({ market_id, date, open_pana, open_ank: openAnk })]
        );

        await client.query('COMMIT');

        req.app.get('io').emit('open_declared', { result_id: result.id, market_id, date, open_pana, open_ank: openAnk });

        res.status(201).json(result);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// POST /api/results/declare-close
router.post('/declare-close', verifyToken, requireBoss, async (req, res) => {
    const client = await pool.connect();
    try {
        const { result_id } = req.body;
        const close_pana = String(req.body.close_pana || '').padStart(3, '0');
        if (!result_id || !close_pana)
            return res.status(400).json({ error: 'result_id and close_pana are required' });

        const panaRes = await client.query(
            'SELECT ank FROM valid_panas WHERE pana=$1',
            [close_pana]
        );
        if (!panaRes.rows.length)
            return res.status(400).json({ error: `Invalid pana: ${close_pana}` });
        const closeAnk = panaRes.rows[0].ank;

        const resultRes = await client.query('SELECT * FROM results WHERE id=$1', [result_id]);
        if (!resultRes.rows.length) return res.status(404).json({ error: 'Result not found' });
        const result = resultRes.rows[0];
        if (result.status !== 'open_declared')
            return res.status(400).json({ error: 'Open must be declared before close' });

        const jodi = String(result.open_ank) + String(closeAnk);

        await client.query('BEGIN');

        await client.query(
            `UPDATE results
             SET close_pana=$1, close_ank=$2, jodi=$3, status='complete', declared_at=NOW()
             WHERE id=$4`,
            [close_pana, closeAnk, jodi, result_id]
        );

        // Fetch all non-cancelled entry items for this market/date
        const itemsRes = await client.query(`
            SELECT
                ei.id, ei.bet_type, ei.number, ei.amount, ei.potential_payout,
                eb.session, eb.broker_id
            FROM entry_items ei
            JOIN entry_batches eb ON ei.batch_id = eb.id
            WHERE eb.market_id   = $1
              AND eb.entry_date  = $2
              AND eb.status     != 'cancelled'
        `, [result.market_id, result.result_date]);

        // Determine winners and accumulate per-broker totals
        const brokerMap = {};

        for (const item of itemsRes.rows) {
            let isWinner = false;

            if (item.bet_type === 'single_ank') {
                const entryNum   = normalizeForCompare(item.number, 'single_ank');
                const openAnkStr = normalizeForCompare(result.open_ank, 'single_ank');
                const closeAnkStr= normalizeForCompare(closeAnk, 'single_ank');
                isWinner = entryNum === openAnkStr || entryNum === closeAnkStr;
            } else if (item.bet_type === 'jodi') {
                const entryJodi  = normalizeForCompare(item.number, 'jodi');
                const resultJodi = normalizeForCompare(jodi, 'jodi');
                isWinner = entryJodi === resultJodi;
            } else if (['single_pana', 'double_pana', 'triple_pana'].includes(item.bet_type)) {
                const targetPana = item.session === 'open' ? result.open_pana : close_pana;
                isWinner = normalizeForCompare(item.number, 'pana') ===
                           normalizeForCompare(targetPana, 'pana');
            }

            const actualPayout = isWinner ? safeFloat(item.potential_payout) : 0;

            await client.query(
                `UPDATE entry_items SET is_winner=$1, actual_payout=$2 WHERE id=$3`,
                [isWinner, actualPayout, item.id]
            );

            if (!brokerMap[item.broker_id]) {
                brokerMap[item.broker_id] = { totalCollection: 0, totalWinning: 0 };
            }
            brokerMap[item.broker_id].totalCollection += safeFloat(item.amount);
            if (isWinner) brokerMap[item.broker_id].totalWinning += actualPayout;
        }

        // Mark batches as settled
        await client.query(
            `UPDATE entry_batches SET status='settled'
             WHERE market_id=$1 AND entry_date=$2 AND status='confirmed'`,
            [result.market_id, result.result_date]
        );

        // Create settlement record per broker
        for (const [brokerId, data] of Object.entries(brokerMap)) {
            const totalCollection = safeFloat(data.totalCollection);
            const totalWinning    = safeFloat(data.totalWinning);
            const commission    = totalCollection * 0.10;
            const netCollection = totalCollection - commission;
            const netSettlement = netCollection - totalWinning;
            const settlementAmt = Math.abs(netSettlement);
            const settlementType = netSettlement >= 0 ? 'loss' : 'winning';

            const brokerRes = await client.query(
                'SELECT balance FROM brokers WHERE id=$1',
                [brokerId]
            );
            const balanceBefore = parseFloat(brokerRes.rows[0].balance);
            const balanceAfter  = netSettlement >= 0
                ? balanceBefore - settlementAmt
                : balanceBefore + settlementAmt;

            await client.query(
                `INSERT INTO settlements
                   (broker_id, settlement_date, settlement_type, amount,
                    balance_before, balance_after, notes, processed_by)
                 VALUES ($1, NOW()::date, $2, $3, $4, $5, $6, $7)`,
                [
                    brokerId, settlementType, settlementAmt,
                    balanceBefore, balanceAfter,
                    JSON.stringify({
                        result_id,
                        market_id:        result.market_id,
                        date:             result.result_date,
                        total_collection: totalCollection,
                        commission,
                        net_collection:   netCollection,
                        total_winning:    totalWinning,
                        net_settlement:   netSettlement,
                        direction:        netSettlement >= 0 ? 'broker_pays' : 'boss_pays',
                    }),
                    req.user.id,
                ]
            );

            await client.query(
                'UPDATE brokers SET balance=$1 WHERE id=$2',
                [balanceAfter, brokerId]
            );
        }

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'DECLARE_CLOSE', 'results', $2, $3)`,
            [req.user.id, result_id, JSON.stringify({ close_pana, close_ank: closeAnk, jodi })]
        );

        await client.query('COMMIT');

        req.app.get('io').emit('close_declared', {
            result_id, close_pana, close_ank: closeAnk, jodi,
            market_id: result.market_id,
        });

        res.json({ result_id, close_pana, close_ank: closeAnk, jodi });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PUT /api/results/:id/correct  (boss only — only if not complete)
router.put('/:id/correct', verifyToken, requireBoss, async (req, res) => {
    const client = await pool.connect();
    try {
        const { open_pana, close_pana } = req.body;

        const resultRes = await client.query('SELECT * FROM results WHERE id=$1', [req.params.id]);
        if (!resultRes.rows.length) return res.status(404).json({ error: 'Result not found' });
        const result = resultRes.rows[0];
        if (result.status === 'complete')
            return res.status(400).json({ error: 'Cannot correct a completed result' });

        await client.query('BEGIN');

        const updates = {};
        if (open_pana) {
            const pr = await client.query('SELECT ank FROM valid_panas WHERE pana=$1', [open_pana]);
            if (!pr.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Invalid pana: ${open_pana}` }); }
            updates.open_pana = open_pana;
            updates.open_ank  = pr.rows[0].ank;
        }
        if (close_pana) {
            const pr = await client.query('SELECT ank FROM valid_panas WHERE pana=$1', [close_pana]);
            if (!pr.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Invalid pana: ${close_pana}` }); }
            updates.close_pana = close_pana;
            updates.close_ank  = pr.rows[0].ank;
        }

        const newOpenAnk  = updates.open_ank  ?? result.open_ank;
        const newCloseAnk = updates.close_ank ?? result.close_ank;
        if (newOpenAnk !== null && newCloseAnk !== null)
            updates.jodi = String(newOpenAnk) + String(newCloseAnk);

        const setClauses = Object.keys(updates).map((k, i) => `${k}=$${i + 2}`).join(', ');
        const values     = [req.params.id, ...Object.values(updates)];

        const { rows } = await client.query(
            `UPDATE results
             SET ${setClauses},
                 correction_count = correction_count + 1,
                 previous_results = COALESCE(previous_results, '[]'::jsonb) || $${values.length + 1}::jsonb
             WHERE id=$1
             RETURNING *`,
            [...values, JSON.stringify(result)]
        );

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
             VALUES ($1, 'CORRECT_RESULT', 'results', $2, $3, $4)`,
            [req.user.id, req.params.id, JSON.stringify(result), JSON.stringify(updates)]
        );

        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// GET /api/results
router.get('/', verifyToken, async (req, res) => {
    try {
        const { market_id, date, from, to } = req.query;
        const conditions = [];
        const params     = [];
        let   p          = 1;

        if (market_id) { conditions.push(`r.market_id   = $${p++}`); params.push(market_id); }
        if (date)       { conditions.push(`r.result_date = $${p++}`); params.push(date); }
        if (from)       { conditions.push(`r.result_date >= $${p++}`); params.push(from); }
        if (to)         { conditions.push(`r.result_date <= $${p++}`); params.push(to); }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const { rows } = await pool.query(`
            SELECT r.*, m.name AS market_name, m.code AS market_code,
                   u.username AS declared_by_username
            FROM results r
            JOIN markets m ON r.market_id = m.id
            LEFT JOIN users u ON r.declared_by = u.id
            ${where}
            ORDER BY r.result_date DESC, m.open_time
        `, params);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
