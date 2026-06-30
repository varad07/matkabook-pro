const express = require('express');
const pool    = require('../../database');
const { verifyToken } = require('../middleware/auth');
const { requireBoss } = require('../middleware/roleCheck');

const router = express.Router();

// GET /api/rates — return all payout rates
router.get('/', verifyToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, bet_type, rate, is_active, updated_at FROM payout_rates ORDER BY bet_type`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/rates/pana-base — update pana base rate (boss only)
// body: { rate: <number> }
// Updates single_pana, double_pana (×2), triple_pana (×4) in one shot
router.put('/pana-base', verifyToken, requireBoss, async (req, res) => {
    try {
        const base = parseFloat(req.body.rate);
        if (!isFinite(base) || base <= 0)
            return res.status(400).json({ error: 'rate must be a positive number' });

        const updates = [
            { bet_type: 'single_pana', rate: base },
            { bet_type: 'double_pana', rate: base * 2 },
            { bet_type: 'triple_pana', rate: base * 4 },
        ];

        for (const { bet_type, rate } of updates) {
            await pool.query(
                `UPDATE payout_rates SET rate=$1, updated_at=NOW(), updated_by=$2 WHERE bet_type=$3`,
                [rate, req.user.id, bet_type]
            );
        }

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'UPDATE_RATES', 'payout_rates', NULL, $2)`,
            [req.user.id, JSON.stringify({ pana_base: base, single: base, double: base * 2, triple: base * 4 })]
        );

        const { rows } = await pool.query(
            `SELECT id, bet_type, rate, is_active, updated_at FROM payout_rates ORDER BY bet_type`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
