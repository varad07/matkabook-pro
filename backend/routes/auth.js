const express = require('express');
const jwt     = require('jsonwebtoken');
const pool    = require('../../database');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            return res.status(400).json({ error: 'Username and password required' });

        const { rows } = await pool.query(
            `SELECT id, username, role
             FROM users
             WHERE username = $1
               AND password_hash = crypt($2, password_hash)
               AND is_active = TRUE`,
            [username, password]
        );

        if (!rows.length)
            return res.status(401).json({ error: 'Invalid credentials' });

        const user = rows[0];
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        await pool.query(
            `INSERT INTO audit_logs (user_id, action) VALUES ($1, 'LOGIN')`,
            [user.id]
        );

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
