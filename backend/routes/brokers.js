const express = require('express');
const pool    = require('../../database');
const { verifyToken }  = require('../middleware/auth');
const { requireBoss } = require('../middleware/roleCheck');

const router = express.Router();

// GET /api/brokers
router.get('/', verifyToken, requireBoss, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT b.id, b.broker_code, b.name, b.phone, b.address,
                   b.credit_limit, b.balance, b.is_active,
                   b.created_at, u.username, u.is_active AS user_active
            FROM brokers b
            JOIN users u ON b.user_id = u.id
            ORDER BY b.broker_code
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/brokers
router.post('/', verifyToken, requireBoss, async (req, res) => {
    const client = await pool.connect();
    try {
        const { broker_code, name, username, password, phone, address, credit_limit } = req.body;
        if (!broker_code || !name || !username || !password)
            return res.status(400).json({ error: 'broker_code, name, username and password are required' });

        await client.query('BEGIN');

        const userRes = await client.query(
            `INSERT INTO users (username, password_hash, role)
             VALUES ($1, crypt($2, gen_salt('bf', 10)), 'broker')
             RETURNING id`,
            [username, password]
        );
        const userId = userRes.rows[0].id;

        const brokerRes = await client.query(
            `INSERT INTO brokers (user_id, broker_code, name, phone, address, credit_limit)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [userId, broker_code, name, phone || null, address || null, credit_limit || 0]
        );
        const broker = brokerRes.rows[0];

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'CREATE_BROKER', 'brokers', $2, $3)`,
            [req.user.id, broker.id, JSON.stringify({ broker_code, name, username })]
        );

        await client.query('COMMIT');
        res.status(201).json(broker);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505')
            return res.status(409).json({ error: 'Broker code or username already exists' });
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PUT /api/brokers/:id
router.put('/:id', verifyToken, requireBoss, async (req, res) => {
    try {
        const { name, phone, address, credit_limit } = req.body;
        const { rows } = await pool.query(
            `UPDATE brokers
             SET name=$1, phone=$2, address=$3, credit_limit=$4
             WHERE id=$5
             RETURNING *`,
            [name, phone || null, address || null, credit_limit, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Broker not found' });

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'UPDATE_BROKER', 'brokers', $2, $3)`,
            [req.user.id, req.params.id, JSON.stringify({ name, phone, address, credit_limit })]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/brokers/:id/disable  (toggles active status)
router.put('/:id/disable', verifyToken, requireBoss, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            'SELECT id, user_id, is_active FROM brokers WHERE id=$1',
            [req.params.id]
        );
        if (!rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Broker not found' });
        }

        const newStatus = !rows[0].is_active;
        await client.query('UPDATE brokers SET is_active=$1 WHERE id=$2', [newStatus, req.params.id]);
        await client.query('UPDATE users   SET is_active=$1 WHERE id=$2', [newStatus, rows[0].user_id]);

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
             VALUES ($1, $2, 'brokers', $3, $4, $5)`,
            [
                req.user.id,
                newStatus ? 'ENABLE_BROKER' : 'DISABLE_BROKER',
                req.params.id,
                JSON.stringify({ is_active: !newStatus }),
                JSON.stringify({ is_active: newStatus }),
            ]
        );

        await client.query('COMMIT');
        res.json({ id: req.params.id, is_active: newStatus });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PUT /api/brokers/:id/reset-password
router.put('/:id/reset-password', verifyToken, requireBoss, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'New password required' });

        const { rows } = await pool.query(
            'SELECT user_id FROM brokers WHERE id=$1',
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Broker not found' });

        await pool.query(
            `UPDATE users SET password_hash = crypt($1, gen_salt('bf', 10)) WHERE id=$2`,
            [password, rows[0].user_id]
        );

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id)
             VALUES ($1, 'RESET_BROKER_PASSWORD', 'users', $2)`,
            [req.user.id, rows[0].user_id]
        );

        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
