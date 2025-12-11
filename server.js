const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 데이터 파일 경로 설정
const DATA_FILE = path.join(__dirname, 'users.json');
const SAVINGS_FILE = path.join(__dirname, 'savings.json');
const CHALLENGES_FILE = path.join(__dirname, 'challenges.json');

// 파일이 없으면 빈 배열로 생성
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
if (!fs.existsSync(SAVINGS_FILE)) fs.writeFileSync(SAVINGS_FILE, JSON.stringify([]));
if (!fs.existsSync(CHALLENGES_FILE)) fs.writeFileSync(CHALLENGES_FILE, JSON.stringify([]));

// --- API 정의 ---

// 1. 아이디 중복 확인
app.post('/api/check-id', (req, res) => {
    const { loginId } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    res.json({ available: !users.find(u => u.loginId === loginId) });
});

// 2. 이메일 중복 확인
app.post('/api/check-email', (req, res) => {
    const { email } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    res.json({ available: !users.find(u => u.email === email) });
});

// 3. 회원가입
app.post('/api/signup', (req, res) => {
    const { loginId, password, nickname, email } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    if (users.find(u => u.loginId === loginId)) return res.json({ success: false, message: '이미 존재하는 아이디입니다.' });
    
    const newUser = { 
        id: Date.now(), 
        loginId, password, nickname, email, 
        created_at: new Date().toISOString() 
    };
    users.push(newUser);
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
});

// 4. 로그인
app.post('/api/login', (req, res) => {
    const { loginId, password } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    const user = users.find(u => u.loginId === loginId && u.password === password);
    if (user) res.json({ success: true, user: user });
    else res.json({ success: false, message: '실패' });
});

// 5. 아이디 찾기
app.post('/api/find-id', (req, res) => {
    const { email } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    const user = users.find(u => u.email === email);
    if (user) res.json({ success: true, loginId: user.loginId });
    else res.json({ success: false });
});

// 6. 비밀번호 찾기
app.post('/api/find-pw', (req, res) => {
    const { loginId, email } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    const user = users.find(u => u.loginId === loginId && u.email === email);
    if (user) res.json({ success: true, password: user.password });
    else res.json({ success: false });
});

// 7. 비밀번호 변경 (로그인 전용)
app.post('/api/user/change-pw', (req, res) => {
    const { loginId, currentPassword, newPassword } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    const index = users.findIndex(u => u.loginId === loginId);

    if (index !== -1) {
        if (users[index].password === currentPassword) {
            users[index].password = newPassword;
            fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
            res.json({ success: true });
        } else {
            res.json({ success: false, message: '기존 비밀번호가 틀렸습니다.' });
        }
    } else {
        res.json({ success: false, message: '존재하지 않는 아이디입니다.' });
    }
});

// 8. 비밀번호 변경 (마이페이지용)
app.post('/api/user/password', (req, res) => {
    const { id, currentPassword, newPassword } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    const index = users.findIndex(u => u.id === id);
    if (index !== -1 && users[index].password === currentPassword) {
        users[index].password = newPassword;
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
        res.json({ success: true });
    } else res.json({ success: false, message: '오류' });
});

// 9. 유저 정보 조회
app.get('/api/user/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    const user = users.find(u => u.id === userId);
    if (user) res.json(user); else res.status(404).json({});
});

// 10. 유저 정보 수정 (닉네임)
app.post('/api/user/update', (req, res) => {
    const { id, nickname } = req.body;
    const users = JSON.parse(fs.readFileSync(DATA_FILE));
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
        users[index].nickname = nickname;
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
        res.json({ success: true });
    } else res.json({ success: false });
});

// 11. 저금 내역 조회
app.get('/api/savings/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const allSavings = JSON.parse(fs.readFileSync(SAVINGS_FILE));
    res.json(allSavings.filter(s => s.userId === userId));
});

// 12. 저금하기
app.post('/api/save', (req, res) => {
    const { userId, category, subCategory, amount, memo, balance } = req.body;
    const allSavings = JSON.parse(fs.readFileSync(SAVINGS_FILE));
    const newSave = { id: Date.now(), userId, category, sub_category: subCategory, amount, balance, memo, saved_date: new Date().toISOString() };
    allSavings.push(newSave);
    fs.writeFileSync(SAVINGS_FILE, JSON.stringify(allSavings, null, 2));
    res.json({ success: true });
});

// 13. 챌린지 생성
app.post('/api/challenge', (req, res) => {
    const { userId, title, category, subCategory, targetAmount, startDate, endDate } = req.body;
    const challenges = JSON.parse(fs.readFileSync(CHALLENGES_FILE));
    const newChallenge = { id: Date.now(), user_id: userId, title, category, sub_category: subCategory, target_amount: targetAmount, saved_amount: 0, start_date: startDate, end_date: endDate, status: 'ongoing' };
    challenges.push(newChallenge);
    fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(challenges, null, 2));
    res.json({ success: true });
});

// 14. 챌린지 목록 조회
app.get('/api/challenges/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const challenges = JSON.parse(fs.readFileSync(CHALLENGES_FILE));
    res.json(challenges.filter(c => c.user_id === userId).sort((a, b) => b.id - a.id));
});

// 15. 챌린지 상태 업데이트
app.post('/api/challenge/update', (req, res) => {
    const { id, savedAmount, status } = req.body;
    const challenges = JSON.parse(fs.readFileSync(CHALLENGES_FILE));
    const index = challenges.findIndex(c => c.id === id);
    if (index !== -1) {
        challenges[index].saved_amount = savedAmount;
        if (status) challenges[index].status = status;
        fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(challenges, null, 2));
        res.json({ success: true });
    } else res.json({ success: false });
});

// 서버 시작
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});