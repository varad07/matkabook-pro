const express = require('express');
const pool    = require('../../database');
const { verifyToken }  = require('../middleware/auth');
const { requireBoss }  = require('../middleware/roleCheck');

const router = express.Router();

// GET /api/employees  (boss only)
router.get('/', verifyToken, requireBoss, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT e.id, e.name, e.mobile, e.is_active, e.created_at,
                   u.username, u.is_active AS user_active
            FROM employees e
            JOIN users u ON e.user_id = u.id
            ORDER BY e.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/employees  (boss only)
router.post('/', verifyToken, requireBoss, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, mobile, username, password } = req.body;
        if (!name || !username || !password)
            return res.status(400).json({ error: 'name, username and password are required' });

        await client.query('BEGIN');

        const userRes = await client.query(
            `INSERT INTO users (username, password_hash, role)
             VALUES ($1, crypt($2, gen_salt('bf', 10)), 'employee')
             RETURNING id`,
            [username, password]
        );
        const userId = userRes.rows[0].id;

        const empRes = await client.query(
            `INSERT INTO employees (user_id, name, mobile, created_by)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [userId, name, mobile || null, req.user.id]
        );
        const employee = empRes.rows[0];

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'employee_created', 'employees', $2, $3)`,
            [req.user.id, employee.id, JSON.stringify({ name, username, mobile })]
        );

        await client.query('COMMIT');
        res.status(201).json({ ...employee, username });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505')
            return res.status(409).json({ error: 'Username already exists' });
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PUT /api/employees/:id  (boss only)
router.put('/:id', verifyToken, requireBoss, async (req, res) => {
    try {
        const { name, mobile } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });

        const { rows } = await pool.query(
            `UPDATE employees SET name=$1, mobile=$2 WHERE id=$3 RETURNING *`,
            [name, mobile || null, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Employee not found' });

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_values)
             VALUES ($1, 'employee_updated', 'employees', $2, $3)`,
            [req.user.id, req.params.id, JSON.stringify({ name, mobile })]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/employees/:id/disable  (boss only — toggles active)
router.put('/:id/disable', verifyToken, requireBoss, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            'SELECT id, user_id, is_active FROM employees WHERE id=$1',
            [req.params.id]
        );
        if (!rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Employee not found' });
        }

        const newStatus = !rows[0].is_active;
        await client.query('UPDATE employees SET is_active=$1 WHERE id=$2', [newStatus, req.params.id]);
        await client.query('UPDATE users   SET is_active=$1 WHERE id=$2', [newStatus, rows[0].user_id]);

        await client.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values)
             VALUES ($1, $2, 'employees', $3, $4, $5)`,
            [
                req.user.id,
                newStatus ? 'employee_enabled' : 'employee_disabled',
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

// PUT /api/employees/:id/reset-password  (boss only)
router.put('/:id/reset-password', verifyToken, requireBoss, async (req, res) => {
    try {
        const { new_password } = req.body;
        if (!new_password) return res.status(400).json({ error: 'new_password is required' });

        const { rows } = await pool.query('SELECT user_id FROM employees WHERE id=$1', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Employee not found' });

        await pool.query(
            `UPDATE users SET password_hash = crypt($1, gen_salt('bf', 10)) WHERE id=$2`,
            [new_password, rows[0].user_id]
        );

        await pool.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id)
             VALUES ($1, 'employee_password_reset', 'users', $2)`,
            [req.user.id, rows[0].user_id]
        );

        res.json({ message: 'Password reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
