const express = require('express');
const pool    = require('../../database');
const { verifyToken }  = require('../middleware/auth');
const { requireBoss } = require('../middleware/roleCheck');

const router = express.Router();

// GET /api/audit?from=&to=&user_id=
router.get('/', verifyToken, requireBoss, async (req, res) => {
    try {
        const { from, to, user_id, action, table_name } = req.query;

        const conditions = [];
        const params     = [];
        let   p          = 1;

        if (from)       { conditions.push(`al.created_at >= $${p++}`); params.push(from); }
        if (to)         { conditions.push(`al.created_at <= $${p++}`); params.push(to + ' 23:59:59'); }
        if (user_id)    { conditions.push(`al.user_id    =  $${p++}`); params.push(user_id); }
        if (action)     { conditions.push(`al.action ILIKE $${p++}`);  params.push(`%${action}%`); }
        if (table_name) { conditions.push(`al.table_name = $${p++}`);  params.push(table_name); }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const { rows } = await pool.query(`
            SELECT
                al.id,
                al.action,
                al.table_name,
                al.record_id,
                al.old_values,
                al.new_values,
                al.ip_address,
                al.created_at,
                u.username,
                u.role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ${where}
            ORDER BY al.created_at DESC
            LIMIT 1000
        `, params);

        res.json({ count: rows.length, logs: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
