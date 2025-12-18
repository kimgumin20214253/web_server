const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise'); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));


const pool = mysql.createPool({
    host: process.env.DB_HOST,         
    user: process.env.DB_USER,        
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'test', 
    port: 4000,                        
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true     
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});




app.post('/api/check-id', async (req, res) => {
    try {
        const { loginId } = req.body;
        const [rows] = await pool.query('SELECT login_id FROM users WHERE login_id = ?', [loginId]);
        res.json({ available: rows.length === 0 });
    } catch (err) {
        console.error('Check-ID Error:', err);
        res.status(500).json({ error: 'DB Error' });
    }
});


app.post('/api/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        const [rows] = await pool.query('SELECT email FROM users WHERE email = ?', [email]);
        res.json({ available: rows.length === 0 });
    } catch (err) {
        console.error('Check-Email Error:', err);
        res.status(500).json({ error: 'DB Error' });
    }
});


app.post('/api/signup', async (req, res) => {
    try {
        const { loginId, password, nickname, email } = req.body;


        const [existing] = await pool.query('SELECT id FROM users WHERE login_id = ?', [loginId]);
        if (existing.length > 0) {
            return res.json({ success: false, message: '이미 존재하는 아이디입니다.' });
        }

        const sql = 'INSERT INTO users (login_id, password, nickname, email, created_at) VALUES (?, ?, ?, ?, NOW())';
        await pool.query(sql, [loginId, password, nickname, email]);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Signup Error:', err);
        res.json({ success: false, message: '회원가입 실패' });
    }
});


app.post('/api/login', async (req, res) => {
    try {
        const { loginId, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM users WHERE login_id = ? AND password = ?', [loginId, password]);
        
        if (rows.length > 0) {
            const user = rows[0];
            res.json({ success: true, user: user });
        } else {
            res.json({ success: false, message: '아이디 또는 비밀번호가 틀립니다.' });
        }
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: '서버 오류' });
    }
});


app.post('/api/find-id', async (req, res) => {
    try {
        const { email } = req.body;
        const [rows] = await pool.query('SELECT login_id FROM users WHERE email = ?', [email]);
        
        if (rows.length > 0) {
            res.json({ success: true, loginId: rows[0].login_id });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});


app.post('/api/find-pw', async (req, res) => {
    try {
        const { loginId, email } = req.body;
        const [rows] = await pool.query('SELECT password FROM users WHERE login_id = ? AND email = ?', [loginId, email]);
        
        if (rows.length > 0) {
            res.json({ success: true, password: rows[0].password });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});


app.post('/api/user/change-pw', async (req, res) => {
    try {
        const { loginId, currentPassword, newPassword } = req.body;
        

        const [rows] = await pool.query('SELECT id FROM users WHERE login_id = ? AND password = ?', [loginId, currentPassword]);
        
        if (rows.length > 0) {
            await pool.query('UPDATE users SET password = ? WHERE login_id = ?', [newPassword, loginId]);
            res.json({ success: true });
        } else {
            res.json({ success: false, message: '현재 비밀번호가 일치하지 않습니다.' });
        }
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: '오류 발생' });
    }
});


app.get('/api/user/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({});
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({});
    }
});


app.post('/api/user/update', async (req, res) => {
    try {
        const { id, nickname } = req.body;
        const [result] = await pool.query('UPDATE users SET nickname = ? WHERE id = ?', [nickname, id]);
        
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});


app.get('/api/savings/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const [rows] = await pool.query('SELECT * FROM savings WHERE user_id = ? ORDER BY saved_date DESC', [userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});


app.post('/api/save', async (req, res) => {
    try {
        const { userId, category, subCategory, amount, memo, balance, dateStr } = req.body;
        
        const sql = `
            INSERT INTO savings (user_id, category, sub_category, amount, memo, balance, saved_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const date = dateStr ? dateStr : new Date();

        await pool.query(sql, [userId, category, subCategory, amount, memo, balance, date]);
        res.json({ success: true });
    } catch (err) {
        console.error('Save Error:', err);
        res.json({ success: false });
    }
});


app.post('/api/challenge', async (req, res) => {
    try {
        const { userId, title, category, subCategory, targetAmount, startDate, endDate } = req.body;
        
        const sql = `
            INSERT INTO challenges (user_id, title, category, sub_category, target_amount, start_date, end_date, saved_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'ongoing')
        `;
        await pool.query(sql, [userId, title, category, subCategory, targetAmount, startDate, endDate]);
        res.json({ success: true });
    } catch (err) {
        console.error('Challenge Error:', err);
        res.json({ success: false });
    }
});


app.get('/api/challenges/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const [rows] = await pool.query('SELECT * FROM challenges WHERE user_id = ? ORDER BY id DESC', [userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});


app.post('/api/challenge/update', async (req, res) => {
    try {
        const { id, savedAmount, status } = req.body;
        
        let sql = 'UPDATE challenges SET saved_amount = ?';
        const params = [savedAmount];

        if (status) {
            sql += ', status = ?';
            params.push(status);
        }
        
        sql += ' WHERE id = ?';
        params.push(id);

        const [result] = await pool.query(sql, params);
        
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});




app.post('/api/savings/update', async (req, res) => {
    try {
        const { id, category, subCategory, amount, memo } = req.body;
        

        const sql = `
            UPDATE savings 
            SET category = ?, sub_category = ?, amount = ?, memo = ? 
            WHERE id = ?
        `;
        
        const [result] = await pool.query(sql, [category, subCategory, amount, memo, id]);
        
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: '해당 내역을 찾을 수 없습니다.' });
        }
    } catch (err) {
        console.error('Update Error:', err);
        res.status(500).json({ success: false });
    }
});


app.post('/api/savings/delete', async (req, res) => {
    try {
        const { id } = req.body;
        

        const [result] = await pool.query('DELETE FROM savings WHERE id = ?', [id]);
        
        if (result.affectedRows > 0) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: '삭제할 내역이 없습니다.' });
        }
    } catch (err) {
        console.error('Delete Error:', err);
        res.status(500).json({ success: false });
    }
});



if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app;



app.get('/db-test', async (req, res) => {
    try {

        const connection = await pool.getConnection();

        const [rows] = await connection.query('SELECT 1 as val');
        connection.release();
        

        res.send(`
            <h1>DB 연결 성공!</h1>
        `);
    } catch (err) {
        res.status(500).send(`
            <h1>DB 연결 실패 </h1>

        `);
    }
});