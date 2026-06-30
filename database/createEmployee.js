require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const pool = require('./index');

async function createEmployee() {
    const userResult = await pool.query(
        `INSERT INTO users (username, password_hash, role)
         VALUES ($1, crypt($2, gen_salt('bf', 10)), 'employee') RETURNING id`,
        ['EMP001', 'emp123']
    );

    const userId = userResult.rows[0].id;

    await pool.query(
        `INSERT INTO employees (user_id, name, mobile, created_by)
         SELECT $1, $2, $3, id FROM users WHERE role='boss' LIMIT 1`,
        [userId, 'Suresh', '9999911111']
    );

    console.log('Employee created: EMP001 / emp123');
    process.exit(0);
}

createEmployee().catch(err => {
    console.error(err);
    process.exit(1);
});
