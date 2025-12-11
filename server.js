const express = require('express');
const cors = require('cors');
const path = require('path');

// [중요] fs(파일시스템) 제거! 
// Vercel 에러 방지를 위해 변수에 저장합니다.
let users = [];       
let savings = [];     
let challenges = [];  

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 메인 화면 (index.html 연결)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API 코드 ---

// 1. 아이디 중복 확인
app.post('/api/check-id', (req, res) => {
    const { loginId } = req.body;
    res.json({ available: !users.find(u => u.loginId === loginId) });
});

// 2. 이메일 중복 확인
app.post('/api/check-email', (req, res) => {
    const { email } = req.body;
    res.json({ available: !users.find(u => u.email === email) });
});

// 3. 회원가입
app.post('/api/signup', (req, res) => {
    const { loginId, password, nickname, email } = req.body;
    if (users.find(u => u.loginId === loginId)) return res.json({ success: false, message: '이미 존재하는 아이디입니다.' });
    
    const newUser = { 
        id: Date.now(), 
        loginId, password, nickname, email, 
        created_at: new Date().toISOString() 
    };
    users.push(newUser);
    res.json({ success: true });
});

// 4. 로그인
app.post('/api/login', (req, res) => {
    const { loginId, password } = req.body;
    const user = users.find(u => u.loginId === loginId && u.password === password);
    if (user) res.json({ success: true, user: user });
    else res.json({ success: false, message: '아이디 또는 비밀번호가 틀립니다.' });
});

// 5. 아이디 찾기
app.post('/api/find-id', (req, res) => {
    const { email } = req.body;
    const user = users.find(u => u.email === email);
    if (user) res.json({ success: true, loginId: user.loginId });
    else res.json({ success: false });
});

// 6. 비밀번호 찾기
app.post('/api/find-pw', (req, res) => {
    const { loginId, email } = req.body;
    const user = users.find(u => u.loginId === loginId && u.email === email);
    if (user) res.json({ success: true, password: user.password });
    else res.json({ success: false });
});

// 7. 비밀번호 변경
app.post('/api/user/change-pw', (req, res) => {
    const { loginId, currentPassword, newPassword } = req.body;
    const index = users.findIndex(u => u.loginId === loginId);
    if (index !== -1 && users[index].password === currentPassword) {
        users[index].password = newPassword;
        res.json({ success: true });
    } else {
        res.json({ success: false, message: '정보가 올바르지 않습니다.' });
    }
});

// 9. 유저 정보 조회
app.get('/api/user/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const user = users.find(u => u.id === userId);
    if (user) res.json(user); else res.status(404).json({});
});

// 10. 유저 정보 수정
app.post('/api/user/update', (req, res) => {
    const { id, nickname } = req.body;
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
        users[index].nickname = nickname;
        res.json({ success: true });
    } else res.json({ success: false });
});

// 11. 저금 내역 조회
app.get('/api/savings/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    res.json(savings.filter(s => s.userId === userId));
});

// 12. 저금하기
app.post('/api/save', (req, res) => {
    const { userId, category, subCategory, amount, memo, balance } = req.body;
    const newSave = { id: Date.now(), userId, category, sub_category: subCategory, amount, balance, memo, saved_date: new Date().toISOString() };
    savings.push(newSave);
    res.json({ success: true });
});

// 13. 챌린지 생성
app.post('/api/challenge', (req, res) => {
    const { userId, title, category, subCategory, targetAmount, startDate, endDate } = req.body;
    const newChallenge = { id: Date.now(), user_id: userId, title, category, sub_category: subCategory, target_amount: targetAmount, saved_amount: 0, start_date: startDate, end_date: endDate, status: 'ongoing' };
    challenges.push(newChallenge);
    res.json({ success: true });
});

// 14. 챌린지 목록 조회
app.get('/api/challenges/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    res.json(challenges.filter(c => c.user_id === userId).sort((a, b) => b.id - a.id));
});

// 15. 챌린지 상태 업데이트
app.post('/api/challenge/update', (req, res) => {
    const { id, savedAmount, status } = req.body;
    const index = challenges.findIndex(c => c.id === id);
    if (index !== -1) {
        challenges[index].saved_amount = savedAmount;
        if (status) challenges[index].status = status;
        res.json({ success: true });
    } else res.json({ success: false });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});