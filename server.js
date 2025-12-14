const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise'); // mysql2 라이브러리 사용 (Promise 지원)

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// [TiDB Cloud 연결 설정]
// Render의 'Environment Variables'에 설정한 값들을 불러옵니다.
const pool = mysql.createPool({
    host: process.env.DB_HOST,         // TiDB Host
    user: process.env.DB_USER,         // TiDB User
    password: process.env.DB_PASSWORD, // TiDB Password
    database: process.env.DB_NAME || 'test', // DB 이름
    port: 4000,                        // TiDB 포트 (4000)
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true       // 필수 보안 설정
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 메인 화면 연결 (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API 코드 (DB 연동) ---

// 1. 아이디 중복 확인
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

// 2. 이메일 중복 확인
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

// 3. 회원가입
app.post('/api/signup', async (req, res) => {
    try {
        const { loginId, password, nickname, email } = req.body;

        // 아이디 중복 재확인 (보안)
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

// 4. 로그인
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

// 5. 아이디 찾기
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

// 6. 비밀번호 찾기
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

// 7. 비밀번호 변경
app.post('/api/user/change-pw', async (req, res) => {
    try {
        const { loginId, currentPassword, newPassword } = req.body;
        
        // 현재 비밀번호 확인
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

// 9. 유저 정보 조회
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

// 10. 유저 정보 수정 (닉네임)
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

// 11. 저금 내역 조회
app.get('/api/savings/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        // 최신순 정렬
        const [rows] = await pool.query('SELECT * FROM savings WHERE user_id = ? ORDER BY saved_date DESC', [userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});

// 12. 저금하기
app.post('/api/save', async (req, res) => {
    try {
        const { userId, category, subCategory, amount, memo, balance, dateStr } = req.body;
        
        const sql = `
            INSERT INTO savings (user_id, category, sub_category, amount, memo, balance, saved_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        // dateStr이 없으면 오늘 날짜 사용
        const date = dateStr ? dateStr : new Date();

        await pool.query(sql, [userId, category, subCategory, amount, memo, balance, date]);
        res.json({ success: true });
    } catch (err) {
        console.error('Save Error:', err);
        res.json({ success: false });
    }
});

// 13. 챌린지 생성
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

// 14. 챌린지 목록 조회
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

// 15. 챌린지 상태 업데이트
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

// 서버 실행 (Render 호환)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

module.exports = app;


// --- [진단 키트] DB 연결 테스트 페이지 ---
app.get('/db-test', async (req, res) => {
    try {
        // 1. DB 연결 시도
        const connection = await pool.getConnection();
        // 2. 간단한 쿼리 실행
        const [rows] = await connection.query('SELECT 1 as val');
        connection.release(); // 연결 반납
        
        // 3. 성공 시 메시지 출력
        res.send(`
            <h1>✅ DB 연결 성공!</h1>
            <p>TiDB와 정상적으로 연결되었습니다.</p>
            <p>테스트 값: ${rows[0].val}</p>
        `);
    } catch (err) {
        // 4. 실패 시 에러 내용 화면에 출력 (이걸 봐야 함!)
        res.status(500).send(`
            <h1>❌ DB 연결 실패 (에러 내용)</h1>
            <pre style="background:#eee; padding:10px; border:1px solid red;">${err.stack}</pre>
            <hr>
            <h3>[체크리스트]</h3>
            <ul>
                <li><strong>Host:</strong> ${process.env.DB_HOST} (뒤에 .co 가 아니라 .com 인지 확인)</li>
                <li><strong>User:</strong> ${process.env.DB_USER}</li>
                <li><strong>DB Name:</strong> ${process.env.DB_NAME}</li>
            </ul>
        `);
    }
});