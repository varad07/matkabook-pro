const express = require('express');
const pool    = require('../../database');
const { verifyToken }  = require('../middleware/auth');
const { requireBoss } = require('../middleware/roleCheck');

const router = express.Router();

// GET /api/search?token=&broker=&date=&market_id=&number=&bet_type=
router.get('/', verifyToken, requireBoss, async (req, res) => {
    try {
        const { token, broker, date, market_id, number, bet_type } = req.query;

        if (!token && !broker && !date && !market_id && !number && !bet_type)
            return res.status(400).json({ error: 'At least one search parameter is required' });

        const conditions = [];
        const params     = [];
        let   p          = 1;

        if (token) {
            conditions.push(`eb.token ILIKE $${p++}`);
            params.push(`%${token}%`);
        }
        if (broker) {
            conditions.push(`(b.broker_code ILIKE $${p} OR b.name ILIKE $${p})`);
            params.push(`%${broker}%`);
            p++;
        }
        if (date) {
            conditions.push(`eb.entry_date = $${p++}`);
            params.push(date);
        }
        if (market_id) {
            conditions.push(`eb.market_id = $${p++}`);
            params.push(market_id);
        }
        if (number) {
            conditions.push(`ei.number = $${p++}`);
            params.push(String(number));
        }
        if (bet_type) {
            conditions.push(`ei.bet_type = $${p++}`);
            params.push(bet_type);
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const { rows } = await pool.query(`
            SELECT
                eb.id AS batch_id,
                eb.token,
                eb.entry_date,
                eb.session,
                eb.status,
                eb.total_amount,
                b.broker_code,
                b.name AS broker_name,
                m.name AS market_name,
                m.code AS market_code,
                ei.id AS item_id,
                ei.bet_type,
                ei.number,
                ei.amount,
                ei.potential_payout,
                ei.actual_payout,
                ei.is_winner
            FROM entry_batches eb
            JOIN brokers    b  ON eb.broker_id = b.id
            JOIN markets    m  ON eb.market_id  = m.id
            JOIN entry_items ei ON ei.batch_id  = eb.id
            ${where}
            ORDER BY eb.entry_date DESC, eb.created_at DESC
            LIMIT 500
        `, params);

        res.json({ count: rows.length, results: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
