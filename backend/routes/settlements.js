const express = require('express');
const pool    = require('../../database');
const { verifyToken }                = require('../middleware/auth');
const { requireBoss, requireBroker } = require('../middleware/roleCheck');

const router = express.Router();

// Safely extract numeric value from notes JSON
function nn(field) {
    return `COALESCE((NULLIF(s.notes,''))::jsonb->>'${field}','0')::numeric`;
}

const commExpr = `COALESCE(
    (NULLIF(s.notes,''))::jsonb->>'commission_amount',
    (NULLIF(s.notes,''))::jsonb->>'commission',
    '0'
)::numeric`;

// ─── BOSS ROUTES ─────────────────────────────────────────────────────────────

// GET /api/settlements  (boss — grouped by broker, pending or all)
router.get('/', verifyToken, requireBoss, async (req, res) => {
    try {
        const { status = 'pending', date, from, to, broker_id } = req.query;

        const conditions = [];
        const params     = [];
        let   p          = 1;

        if (status === 'pending') conditions.push('s.is_cleared = false');
        if (status === 'cleared') conditions.push('s.is_cleared = true');

        if (date)      { conditions.push(`s.settlement_date = $${p++}`);  params.push(date); }
        else {
            if (from)  { conditions.push(`s.settlement_date >= $${p++}`); params.push(from); }
            if (to)    { conditions.push(`s.settlement_date <= $${p++}`); params.push(to); }
        }
        if (broker_id) { conditions.push(`s.broker_id = $${p++}`);        params.push(broker_id); }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const { rows } = await pool.query(`
            SELECT
                b.id          AS broker_id,
                b.broker_code,
                b.name        AS broker_name,
                COALESCE(SUM(${nn('total_collection')}), 0)  AS total_collection,
                COALESCE(SUM(${commExpr}), 0)                AS total_commission,
                COALESCE(SUM(${nn('net_collection')}), 0)    AS total_net_collection,
                COALESCE(SUM(${nn('total_winning')}), 0)     AS total_winning,
                COALESCE(SUM(${nn('net_settlement')}), 0)    AS net_settlement,
                CASE WHEN COALESCE(SUM(${nn('net_settlement')}), 0) >= 0
                     THEN 'broker_pays' ELSE 'boss_pays' END AS direction,
                json_agg(
                    json_build_object(
                        'settlement_id', s.id,
                        'date',          s.settlement_date,
                        'is_cleared',    s.is_cleared,
                        'market_name',   (SELECT name FROM markets WHERE id::text = (NULLIF(s.notes,''))::jsonb->>'market_id'),
                        'collection',    ${nn('total_collection')},
                        'commission',    ${commExpr},
                        'winning',       ${nn('total_winning')},
                        'net',           ${nn('net_settlement')}
                    ) ORDER BY s.settlement_date DESC, s.created_at DESC
                ) AS days
            FROM settlements s
            JOIN brokers b ON s.broker_id = b.id
            ${where}
            GROUP BY b.id, b.broker_code, b.name
            ORDER BY b.broker_code
        `, params);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/settlements/clearances  (boss — full clearance history)
router.get('/clearances', verifyToken, requireBoss, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                sc.*,
                b.broker_code, b.name AS broker_name,
                u.username            AS cleared_by_name
            FROM settlement_clearances sc
            JOIN brokers b ON sc.broker_id = b.id
            LEFT JOIN users u ON sc.cleared_by = u.id
            ORDER BY sc.cleared_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/settlements/clear/:broker_id  (boss — mark all pending as cleared)
router.post('/clear/:broker_id', verifyToken, requireBoss, async (req, res) => {
    const client = await pool.connect();
    try {
        const { broker_id } = req.params;
        const { note }      = req.body;

        const brokerRes = await client.query(
            'SELECT name, broker_code FROM brokers WHERE id=$1',
            [broker_id]
        );
        if (!brokerRes.rows.length)
            return res.status(404).json({ error: 'Broker not found' });
        const broker = brokerRes.rows[0];

        const pendingRes = await client.query(
            `SELECT id, ${nn('net_settlement')} AS net
             FROM settlements WHERE broker_id=$1 AND is_cleared=false`,
            [broker_id]
        );
        if (!pendingRes.rows.length)
            return res.status(400).json({ error: 'No pending settlements for this broker' });

        const totalNet = pendingRes.rows.reduce((s, r) => s + parseFloat(r.net || 0), 0);
        const direction = totalNet >= 0 ? 'broker_pays' : 'boss_pays';

        await client.query('BEGIN');

        await client.query(
            `UPDATE settlements
             SET is_cleared=true, cleared_at=NOW(), cleared_by=$1
             WHERE broker_id=$2 AND is_cleared=false`,
            [req.user.id, broker_id]
        );

        await client.query(
            `INSERT INTO settlement_clearances
               (broker_id, cleared_by, total_cleared_amount, note)
             VALUES ($1, $2, $3, $4)`,
            [broker_id, req.user.id, Math.abs(totalNet), note || null]
        );

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1,'SETTLEMENT_CLEARED','settlements',$2,$3)`,
            [req.user.id, broker_id, JSON.stringify({
                broker_name:  broker.name,
                broker_code:  broker.broker_code,
                amount:       Math.abs(totalNet),
                direction,
                count:        pendingRes.rows.length,
            })]
        );

        await client.query('COMMIT');

        res.json({
            success:       true,
            cleared_count: pendingRes.rows.length,
            total_cleared: Math.abs(totalNet),
            direction,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// ─── BROKER ROUTES ────────────────────────────────────────────────────────────

// GET /api/settlements/my/history  (broker — past clearances)
router.get('/my/history', verifyToken, requireBroker, async (req, res) => {
    try {
        const brokerRes = await pool.query('SELECT id FROM brokers WHERE user_id=$1', [req.user.id]);
        if (!brokerRes.rows.length) return res.status(404).json({ error: 'Broker not found' });
        const brokerId = brokerRes.rows[0].id;

        const { rows } = await pool.query(`
            SELECT sc.*, u.username AS cleared_by_name
            FROM settlement_clearances sc
            LEFT JOIN users u ON sc.cleared_by = u.id
            WHERE sc.broker_id = $1
            ORDER BY sc.cleared_at DESC
        `, [brokerId]);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/settlements/my  (broker — pending dues only)
router.get('/my', verifyToken, requireBroker, async (req, res) => {
    try {
        const brokerRes = await pool.query('SELECT id FROM brokers WHERE user_id=$1', [req.user.id]);
        if (!brokerRes.rows.length) return res.status(404).json({ error: 'Broker not found' });
        const brokerId = brokerRes.rows[0].id;

        const { from, to } = req.query;
        const conditions = ['s.broker_id = $1', 's.is_cleared = false'];
        const params     = [brokerId];
        let   p          = 2;

        if (from) { conditions.push(`s.settlement_date >= $${p++}`); params.push(from); }
        if (to)   { conditions.push(`s.settlement_date <= $${p++}`); params.push(to); }

        const { rows } = await pool.query(`
            SELECT
                s.*,
                ${nn('total_collection')}  AS total_collection,
                ${commExpr}                AS commission_amount,
                ${nn('net_collection')}    AS net_collection,
                ${nn('total_winning')}     AS total_winning,
                ${nn('net_settlement')}    AS net_settlement,
                COALESCE((NULLIF(s.notes,''))::jsonb->>'direction','broker_pays') AS direction,
                (SELECT name FROM markets WHERE id::text = (NULLIF(s.notes,''))::jsonb->>'market_id') AS market_name
            FROM settlements s
            WHERE ${conditions.join(' AND ')}
            ORDER BY s.settlement_date DESC, s.created_at DESC
        `, params);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
