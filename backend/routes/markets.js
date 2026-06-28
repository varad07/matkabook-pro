const express = require('express');
const pool    = require('../../database');
const { verifyToken }  = require('../middleware/auth');
const { requireBoss } = require('../middleware/roleCheck');

const router = express.Router();

// GET /api/markets
router.get('/', verifyToken, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM markets ORDER BY open_time ASC`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/markets/:id
router.put('/:id', verifyToken, requireBoss, async (req, res) => {
    try {
        const { name, open_time, close_time, is_active } = req.body;

        const old = await pool.query('SELECT * FROM markets WHERE id=$1', [req.params.id]);
        if (!old.rows.length) return res.status(404).json({ error: 'Market not found' });

        const { rows } = await pool.query(
            `UPDATE markets
             SET name=$1, open_time=$2, close_time=$3, is_active=$4
             WHERE id=$5
             RETURNING *`,
            [name, open_time, close_time, is_active, req.params.id]
        );

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
             VALUES ($1, 'UPDATE_MARKET', 'markets', $2, $3, $4)`,
            [req.user.id, req.params.id, JSON.stringify(old.rows[0]), JSON.stringify(rows[0])]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

async function setMarketStatus(req, res, field, value, action) {
    try {
        const { rows } = await pool.query(
            `UPDATE markets SET ${field}=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
            [value, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Market not found' });

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, $2, 'markets', $3, $4)`,
            [req.user.id, action, req.params.id, JSON.stringify({ [field]: value })]
        );

        req.app.get('io').emit('market_status_changed', { market_id: req.params.id, [field]: value });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}

router.put('/:id/stop-open',   verifyToken, requireBoss, (req, res) => setMarketStatus(req, res, 'open_status',  'stopped',   'STOP_OPEN'));
router.put('/:id/stop-close',  verifyToken, requireBoss, (req, res) => setMarketStatus(req, res, 'close_status', 'stopped',   'STOP_CLOSE'));
router.put('/:id/start-open',  verifyToken, requireBoss, (req, res) => setMarketStatus(req, res, 'open_status',  'accepting', 'START_OPEN'));
router.put('/:id/start-close', verifyToken, requireBoss, (req, res) => setMarketStatus(req, res, 'close_status', 'accepting', 'START_CLOSE'));

// Enable / disable market  (called by Markets.jsx toggle button)
router.put('/:id/disable', verifyToken, requireBoss, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `UPDATE markets SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Market not found' });
        req.app.get('io').emit('market_status_changed', { market_id: req.params.id, is_active: false });
        res.json(rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id/enable', verifyToken, requireBoss, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `UPDATE markets SET is_active=TRUE, updated_at=NOW() WHERE id=$1 RETURNING *`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Market not found' });
        req.app.get('io').emit('market_status_changed', { market_id: req.params.id, is_active: true });
        res.json(rows[0]);
    } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
