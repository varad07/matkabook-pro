const express = require('express');
const pool    = require('../../database');
const { verifyToken }  = require('../middleware/auth');
const { requireBoss } = require('../middleware/roleCheck');

const router = express.Router();

const SUMMARY_COLS = `
    COALESCE(SUM((s.notes::jsonb->>'total_collection')::numeric), 0) AS total_collection,
    COALESCE(SUM((s.notes::jsonb->>'commission')::numeric),        0) AS total_commission,
    COALESCE(SUM((s.notes::jsonb->>'total_winning')::numeric),     0) AS total_winning,
    COALESCE(SUM((s.notes::jsonb->>'net_settlement')::numeric),    0) AS net_settlement
`;

// GET /api/reports/daily?date=YYYY-MM-DD
router.get('/daily', verifyToken, requireBoss, async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'date is required' });

        const { rows } = await pool.query(`
            SELECT
                b.broker_code, b.name AS broker_name,
                ${SUMMARY_COLS}
            FROM settlements s
            JOIN brokers b ON s.broker_id = b.id
            WHERE s.settlement_date = $1
              AND s.settlement_type IN ('winning', 'loss')
            GROUP BY b.id, b.broker_code, b.name
            ORDER BY b.broker_code
        `, [date]);

        const totals = rows.reduce(
            (acc, r) => ({
                total_collection: acc.total_collection + parseFloat(r.total_collection),
                total_commission: acc.total_commission + parseFloat(r.total_commission),
                total_winning:    acc.total_winning    + parseFloat(r.total_winning),
                net_settlement:   acc.net_settlement   + parseFloat(r.net_settlement),
            }),
            { total_collection: 0, total_commission: 0, total_winning: 0, net_settlement: 0 }
        );

        res.json({ date, brokers: rows, totals });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/broker?broker_id=&from=&to=
router.get('/broker', verifyToken, requireBoss, async (req, res) => {
    try {
        const { broker_id, from, to } = req.query;
        if (!broker_id || !from || !to)
            return res.status(400).json({ error: 'broker_id, from and to are required' });

        const { rows } = await pool.query(`
            SELECT
                s.settlement_date,
                ${SUMMARY_COLS}
            FROM settlements s
            WHERE s.broker_id        = $1
              AND s.settlement_date >= $2
              AND s.settlement_date <= $3
              AND s.settlement_type IN ('winning', 'loss')
            GROUP BY s.settlement_date
            ORDER BY s.settlement_date
        `, [broker_id, from, to]);

        const brokerInfo = await pool.query(
            'SELECT broker_code, name, balance FROM brokers WHERE id=$1',
            [broker_id]
        );

        const totals = rows.reduce(
            (acc, r) => ({
                total_collection: acc.total_collection + parseFloat(r.total_collection),
                total_commission: acc.total_commission + parseFloat(r.total_commission),
                total_winning:    acc.total_winning    + parseFloat(r.total_winning),
                net_settlement:   acc.net_settlement   + parseFloat(r.net_settlement),
            }),
            { total_collection: 0, total_commission: 0, total_winning: 0, net_settlement: 0 }
        );

        res.json({ broker: brokerInfo.rows[0], from, to, daily: rows, totals });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/market?market_id=&from=&to=
router.get('/market', verifyToken, requireBoss, async (req, res) => {
    try {
        const { market_id, from, to } = req.query;
        if (!market_id || !from || !to)
            return res.status(400).json({ error: 'market_id, from and to are required' });

        const { rows } = await pool.query(`
            SELECT
                eb.entry_date,
                COUNT(DISTINCT eb.broker_id)          AS broker_count,
                COALESCE(SUM(ei.amount),           0) AS total_collection,
                COALESCE(SUM(ei.actual_payout)
                    FILTER (WHERE ei.is_winner),   0) AS total_winning,
                COALESCE(SUM(ei.amount) * 0.10,    0) AS total_commission
            FROM entry_batches eb
            JOIN entry_items ei ON ei.batch_id = eb.id
            WHERE eb.market_id    = $1
              AND eb.entry_date  >= $2
              AND eb.entry_date  <= $3
              AND eb.status      != 'cancelled'
            GROUP BY eb.entry_date
            ORDER BY eb.entry_date
        `, [market_id, from, to]);

        const marketInfo = await pool.query(
            'SELECT name, code FROM markets WHERE id=$1',
            [market_id]
        );

        const totals = rows.reduce(
            (acc, r) => ({
                total_collection: acc.total_collection + parseFloat(r.total_collection),
                total_commission: acc.total_commission + parseFloat(r.total_commission),
                total_winning:    acc.total_winning    + parseFloat(r.total_winning),
            }),
            { total_collection: 0, total_commission: 0, total_winning: 0 }
        );

        res.json({ market: marketInfo.rows[0], from, to, daily: rows, totals });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/range?from=&to=
router.get('/range', verifyToken, requireBoss, async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

        const { rows } = await pool.query(`
            SELECT
                s.settlement_date,
                ${SUMMARY_COLS}
            FROM settlements s
            WHERE s.settlement_date >= $1
              AND s.settlement_date <= $2
              AND s.settlement_type IN ('winning', 'loss')
            GROUP BY s.settlement_date
            ORDER BY s.settlement_date
        `, [from, to]);

        const totals = rows.reduce(
            (acc, r) => ({
                total_collection: acc.total_collection + parseFloat(r.total_collection),
                total_commission: acc.total_commission + parseFloat(r.total_commission),
                total_winning:    acc.total_winning    + parseFloat(r.total_winning),
                net_settlement:   acc.net_settlement   + parseFloat(r.net_settlement),
            }),
            { total_collection: 0, total_commission: 0, total_winning: 0, net_settlement: 0 }
        );

        res.json({ from, to, daily: rows, totals });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
