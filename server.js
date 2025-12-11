const express = require('express');
const mysql = require('mysql2'); // mysql 대신 mysql2 사용 권장
const cors = require('cors');
const app = express();

// 기본 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------------------------------------------
// [TiDB 연결 설정] - 여기를 수정했습니다!
// -------------------------------------------------------
const db = mysql.createConnection({
  host: 'gateway01.ap-northeast-1.prod.aws.tidbcloud.com', // 캡처해주신 주소
  port: 4000,
  user: 'e6cQX337dJBhNPN.root', // 캡처해주신 아이디
  password: 'cSed4pS4a41Rs1eQ', // ⭐ 아까 복사한 비밀번호를 여기에 꼭 넣으세요!
  database: 'test', // TiDB 기본 DB 이름
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

// DB 연결 확인
db.connect((err) => {
  if (err) {
    console.error('❌ DB 연결 실패:', err);
    return;
  }
  console.log('✅ TiDB 클라우드 데이터베이스 연결 성공!');
});

// -------------------------------------------------------
// [기존 API 코드들] - 아래 부분에 사용자님의 원래 코드를 유지하세요.
// -------------------------------------------------------

// 예시: 메인 페이지
app.get('/', (req, res) => {
  res.send('서버가 정상적으로 실행 중입니다!');
});

// 예시: 저금 내역 가져오기 (테스트용)
// 사용자님의 원래 코드가 있다면 그걸 쓰시고, 이건 참고만 하세요.
app.get('/logs', (req, res) => {
  const sql = 'SELECT * FROM Saving_Log'; // 테이블 이름 확인 필요
  db.query(sql, (err, results) => {
    if (err) {
        console.error(err);
        res.status(500).send('DB 오류');
    } else {
        res.json(results);
    }
  });
});

// --- API 코드 ---

// 1. 아이디 중복 확인 [DB 쿼리 로직으로 교체]
app.post('/api/check-id', (req, res) => {
    const { loginId } = req.body;
    const sql = 'SELECT login_id FROM users WHERE login_id = ?';

    db.query(sql, [loginId], (err, results) => {
        if (err) {
            console.error('아이디 중복 확인 DB 오류:', err);
            return res.status(500).json({ success: false, message: '서버 오류' });
        }
        // results.length가 0이면 사용 가능
        res.json({ available: results.length === 0 }); 
    });
});

// 2. 이메일 중복 확인 [DB 쿼리 로직으로 교체]
app.post('/api/check-email', (req, res) => {
    const { email } = req.body;
    const sql = 'SELECT email FROM users WHERE email = ?';

    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error('이메일 중복 확인 DB 오류:', err);
            return res.status(500).json({ success: false, message: '서버 오류' });
        }
        // results.length가 0이면 사용 가능
        res.json({ available: results.length === 0 }); 
    });
});

// 3. 회원가입
app.post('/api/signup', (req, res) => {
    const { loginId, password, nickname, email } = req.body;
    
    // 1. 아이디 중복 확인
    const checkSql = 'SELECT login_id FROM users WHERE login_id = ?';
    db.query(checkSql, [loginId], (err, results) => {
        if (results.length > 0) {
            return res.json({ success: false, message: '이미 존재하는 아이디입니다.' });
        }
        
        // 2. DB에 데이터 삽입 (Hashing은 보안상 권장되나 일단 평문으로 저장)
        const insertSql = 'INSERT INTO users (login_id, password, nickname, email) VALUES (?, ?, ?, ?)';
        db.query(insertSql, [loginId, password, nickname, email], (err, insertResult) => {
            if (err) {
                console.error('회원가입 DB 오류:', err);
                return res.status(500).json({ success: false, message: '서버 오류' });
            }
            res.json({ success: true, userId: insertResult.insertId });
        });
    });
});

// 4. 로그인
app.post('/api/login', (req, res) => {
    const { loginId, password } = req.body;
    const sql = 'SELECT id, login_id, nickname, email FROM users WHERE login_id = ? AND password = ?';
    
    db.query(sql, [loginId, password], (err, results) => {
        if (err) {
            console.error('로그인 DB 오류:', err);
            return res.status(500).json({ success: false, message: '서버 오류' });
        }
        
        if (results.length > 0) {
            // 로그인 성공 (DB ID와 함께 반환)
            res.json({ success: true, user: results[0] }); 
        } else {
            // 실패
            res.json({ success: false, message: '아이디 또는 비밀번호가 틀립니다.' });
        }
    });
});

// 5. 아이디 찾기 [DB 쿼리 로직으로 교체]
app.post('/api/find-id', (req, res) => {
    const { email } = req.body;
    const sql = 'SELECT login_id FROM users WHERE email = ?';

    db.query(sql, [email], (err, results) => {
        if (err) {
            console.error('아이디 찾기 DB 오류:', err);
            return res.status(500).json({ success: false, message: '서버 오류' });
        }
        
        if (results.length > 0) {
            // 아이디를 찾으면 반환
            res.json({ success: true, loginId: results[0].login_id }); 
        } else {
            // 못 찾으면 실패
            res.json({ success: false, message: '해당 이메일로 가입된 아이디를 찾을 수 없습니다.' });
        }
    });
});

// 6. 비밀번호 찾기 [DB 쿼리 로직으로 교체]
app.post('/api/find-pw', (req, res) => {
    const { loginId, email } = req.body;
    // 비밀번호를 조회하여 반환합니다. (보안을 위해 비밀번호를 변경하도록 유도하는 것이 좋습니다.)
    const sql = 'SELECT password FROM users WHERE login_id = ? AND email = ?';
    
    db.query(sql, [loginId, email], (err, results) => {
        if (err) {
            console.error('비밀번호 찾기 DB 오류:', err);
            return res.status(500).json({ success: false, message: '서버 오류' });
        }
        
        if (results.length > 0) {
            // 비밀번호를 찾으면 반환
            res.json({ success: true, password: results[0].password });
        } else {
            // 못 찾으면 실패
            res.json({ success: false, message: '아이디와 이메일이 일치하는 사용자를 찾을 수 없습니다.' });
        }
    });
});
// 7. 비밀번호 변경 [DB 쿼리 로직으로 교체]
app.post('/api/user/change-pw', (req, res) => {
    const { loginId, currentPassword, newPassword } = req.body;
    
    // 1. 현재 비밀번호가 맞는지 확인
    const checkSql = 'SELECT id FROM users WHERE login_id = ? AND password = ?';
    db.query(checkSql, [loginId, currentPassword], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: '서버 오류' });

        if (results.length === 0) {
            return res.json({ success: false, message: '아이디 또는 현재 비밀번호가 올바르지 않습니다.' });
        }

        // 2. 새 비밀번호로 업데이트
        const updateSql = 'UPDATE users SET password = ? WHERE login_id = ?';
        db.query(updateSql, [newPassword, loginId], (err) => {
            if (err) {
                console.error('비밀번호 변경 DB 오류:', err);
                return res.status(500).json({ success: false, message: '서버 오류' });
            }
            res.json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
        });
    });
});

// 9. 유저 정보 조회 [DB 쿼리 로직으로 교체]
app.get('/api/user/:id', (req, res) => {
    // userId는 문자열로 오므로 반드시 숫자로 변환합니다. (DB 테이블 users의 id는 INT입니다.)
    const userId = parseInt(req.params.id); 
    const sql = 'SELECT id, login_id, nickname, email, created_at FROM users WHERE id = ?';

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('유저 정보 조회 DB 오류:', err);
            return res.status(500).json({});
        }
        
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }
    });
});

// 10. 유저 정보 수정 (닉네임 수정으로 가정) [DB 쿼리 로직으로 교체]
app.post('/api/user/update', (req, res) => {
    const { id, nickname } = req.body;
    const sql = 'UPDATE users SET nickname = ? WHERE id = ?';

    db.query(sql, [nickname, id], (err) => {
        if (err) {
            console.error('유저 정보 수정 DB 오류:', err);
            return res.json({ success: false, message: '서버 오류' });
        }
        
        // 닉네임 수정 성공
        res.json({ success: true, message: '닉네임이 성공적으로 수정되었습니다.' });
    });
});


// 11. 저금 내역 조회 [DB 쿼리 로직으로 교체]
app.get('/api/savings/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    // 가장 최신 저금 내역이 먼저 보이도록 내림차순 정렬
    const sql = 'SELECT * FROM savings WHERE user_id = ? ORDER BY saved_date DESC'; 

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('저금 내역 조회 DB 오류:', err);
            return res.status(500).json({ message: '서버 오류' });
        }
        res.json(results);
    });
});

// 12. 저금하기 [DB 쿼리 로직으로 교체]
app.post('/api/save', (req, res) => {
    // balance는 클라이언트에서 계산해서 보내는 것으로 가정 (서버에서 계산하는 것이 더 안전함)
    const { userId, category, subCategory, amount, memo, balance } = req.body; 
    
    const sql = `
        INSERT INTO savings (user_id, category, sub_category, amount, memo, balance, saved_date)
        VALUES (?, ?, ?, ?, ?, ?, NOW()) 
    `;
    const params = [userId, category, subCategory, amount, memo, balance];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('저금하기 DB 오류:', err);
            return res.json({ success: false, message: '서버 오류' });
        }
        res.json({ success: true, newSaveId: result.insertId });
    });
});


// 13. 챌린지 생성 [DB 쿼리 로직으로 교체]
app.post('/api/challenge', (req, res) => {
    const { userId, title, category, subCategory, targetAmount, startDate, endDate } = req.body;
    
    // saved_amount와 status는 SQL에서 기본값(DEFAULT)을 사용합니다.
    const sql = `
        INSERT INTO challenges (user_id, title, category, sub_category, target_amount, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [userId, title, category, subCategory, targetAmount, startDate, endDate];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('챌린지 생성 DB 오류:', err);
            return res.json({ success: false, message: '서버 오류' });
        }
        res.json({ success: true, newChallengeId: result.insertId });
    });
});

// 14. 챌린지 목록 조회 [DB 쿼리 로직으로 교체]
app.get('/api/challenges/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const sql = 'SELECT * FROM challenges WHERE user_id = ? ORDER BY id DESC'; 

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('챌린지 목록 조회 DB 오류:', err);
            return res.status(500).json({ message: '서버 오류' });
        }
        res.json(results);
    });
});

// 15. 챌린지 상태 업데이트 [DB 쿼리 로직으로 교체]
app.post('/api/challenge/update', (req, res) => {
    // 챌린지 ID와 업데이트할 금액, 상태를 받습니다.
    const { id, savedAmount, status } = req.body; 
    
    let sql;
    let params;

    if (status) {
        // savedAmount와 status 둘 다 업데이트
        sql = 'UPDATE challenges SET saved_amount = ?, status = ? WHERE id = ?';
        params = [savedAmount, status, id];
    } else {
        // savedAmount만 업데이트
        sql = 'UPDATE challenges SET saved_amount = ? WHERE id = ?';
        params = [savedAmount, id];
    }

    db.query(sql, params, (err) => {
        if (err) {
            console.error('챌린지 업데이트 DB 오류:', err);
            return res.json({ success: false, message: '서버 오류' });
        }
        res.json({ success: true, message: '챌린지 정보가 성공적으로 업데이트되었습니다.' });
    });
});

// -------------------------------------------------------
// [서버 실행 및 포트 설정] - 최종 수정
// -------------------------------------------------------

// Render 환경에서는 process.env.PORT를 사용해야 합니다.
// 로컬 환경을 위해 기본값 3000 (혹은 8080)을 줍니다.
const PORT = process.env.PORT || 3000; 

// 1. 로컬 또는 Render 환경에서 실행될 때
app.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
    // 로컬 환경에서만 확인되는 로그
    if (PORT !== process.env.PORT) {
        console.log(`Server running at http://localhost:${PORT}`);
    }
});

// 2. Vercel 환경에서 사용 가능하도록 모듈 내보내기 (선택 사항)
module.exports = app;