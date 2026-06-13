require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pino = require('pino');
const QR = require('qrcode');
const fs = require('fs');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const API_KEY = process.env.API_KEY;
const SESSION_DIR = './baileys';

app.use(session({
  secret: process.env.EXPRESS_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

let sock = null;
let lastQR = null;
let waStatus = 'STOPPED'; 

const toJid = p => `${String(p).replace(/\D/g, '').replace(/^0/, '62')}@s.whatsapp.net`;

const requireApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'] || req.query.apikey;
  if (key !== API_KEY) return res.status(401).json({ error: 'API Key tidak valid!' });
  next();
};

const requireLogin = (req, res, next) => {
  if (req.session.loggedIn) return next();
  res.redirect('/login');
};

async function startWA() {
  if (waStatus === 'CONNECTED' || waStatus === 'STARTING') return; 
  waStatus = 'STARTING';
  lastQR = null;
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Dashboard Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) lastQR = qr;
      
      if (connection === 'open') {
        waStatus = 'CONNECTED';
        lastQR = null;
        console.log('[WA] Tersambung & Siap!');
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        
        console.log(`[WA] Terputus. (Code: ${statusCode})`);
        
        sock = null;
        
        if (isLoggedOut) {
          waStatus = 'STOPPED';
          lastQR = null;
          clearSessionFolder(); 
        } else if (waStatus !== 'STOPPED') {
          waStatus = 'STOPPED'; 
          setTimeout(() => startWA(), 3000); 
        }
      }
    });
  } catch (err) {
    console.error('[WA Error]', err);
    waStatus = 'STOPPED';
  }
}

function stopWA() {
  waStatus = 'STOPPED';
  if (sock) {
    try { sock.ws.close(); } catch(e) {} 
    sock = null;
  }
}

function clearSessionFolder() {
  if (fs.existsSync(SESSION_DIR)) {
    try {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      console.log('[WA] Folder sesi berhasil dihapus.');
    } catch (e) {
      console.error('[WA] Gagal menghapus folder sesi (mungkin sedang dipakai):', e.message);
    }
  }
}

async function deleteSession() {
  if (sock) {
    try { await sock.logout(); } catch(e) {} 
  }
  stopWA();
  setTimeout(clearSessionFolder, 1000); 
  lastQR = null;
}

app.post('/api/send', requireApiKey, async (req, res) => {
  try {
    if (waStatus !== 'CONNECTED' || !sock) return res.status(503).json({ error: 'WhatsApp belum siap.' });
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: '"to" dan "text" wajib ada.' });

    const msg = await sock.sendMessage(toJid(to), { text });
    res.json({ ok: true, to: toJid(to), messageId: msg.key.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const renderHTML = (content, autoRefresh = false) => `
<!DOCTYPE html>
<html>
<head>
  <title>Bot Panel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${autoRefresh ? '<meta http-equiv="refresh" content="3">' : ''}
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7f6; color: #333; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
    input { width: 90%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; border-radius: 5px; }
    button { padding: 10px 15px; border: none; border-radius: 5px; cursor: pointer; color: white; font-weight: bold; width: 100%; margin-bottom: 10px; transition: 0.3s; }
    .btn-start { background: #28a745; } .btn-start:hover { background: #218838; }
    .btn-stop { background: #ffc107; color: black; } .btn-stop:hover { background: #e0a800; }
    .btn-danger { background: #dc3545; } .btn-danger:hover { background: #c82333; }
    .btn-secondary { background: #6c757d; } .btn-secondary:hover { background: #5a6268; }
    .status { font-size: 1.2em; font-weight: bold; margin: 15px 0; padding: 10px; border-radius: 5px; }
    .s-CONNECTED { background: #d4edda; color: #155724; }
    .s-STARTING { background: #fff3cd; color: #856404; }
    .s-STOPPED { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="card">${content}</div>
</body>
</html>
`;

app.get('/login', (req, res) => {
  if (req.session.loggedIn) return res.redirect('/');
  res.send(renderHTML(`
    <h2>Login Dashboard</h2>
    <form method="POST" action="/login">
      <input type="text" name="username" placeholder="Username" required />
      <input type="password" name="password" placeholder="Password" required />
      <button type="submit" class="btn-start">Login</button>
    </form>
  `));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.loggedIn = true;
    res.redirect('/');
  } else {
    res.send(renderHTML(`<h3>Login Gagal!</h3><br><a href="/login"><button class="btn-secondary">Coba Lagi</button></a>`));
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/', requireLogin, async (req, res) => {
  let qrHtml = '';
  let isAutoRefresh = false;

  if (waStatus === 'STARTING') {
    isAutoRefresh = true;
    if (lastQR) {
      const qrDataUrl = await QR.toDataURL(lastQR);
      qrHtml = `<p>Scan QR di bawah ini (Tunggu loading...)</p><img src="${qrDataUrl}" width="250" style="border: 1px solid #ccc; border-radius: 10px;" />`;
    } else {
      qrHtml = `<p>Sedang memuat sistem WhatsApp...</p>`;
    }
  }

  res.send(renderHTML(`
    <h2>Dashboard Bot</h2>
    <div class="status s-${waStatus}">Status: ${waStatus}</div>
    ${qrHtml}
    <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
    <form method="POST" action="/action"><button name="cmd" value="start" class="btn-start">Start Bot</button></form>
    <form method="POST" action="/action"><button name="cmd" value="stop" class="btn-stop">Stop Bot</button></form>
    <form method="POST" action="/action"><button name="cmd" value="restart" class="btn-secondary">Restart Bot</button></form>
    <form method="POST" action="/action" onsubmit="return confirm('Sesi akan dihapus dan WA logout. Lanjutkan?')"><button name="cmd" value="delete" class="btn-danger">Hapus Sesi (Logout)</button></form>
    <br><a href="/logout" style="color: #dc3545; text-decoration: none; font-size: 14px;">Logout Dashboard</a>
  `, isAutoRefresh));
});

app.post('/action', requireLogin, async (req, res) => {
  const { cmd } = req.body;
  
  if (cmd === 'start') startWA();
  if (cmd === 'stop') stopWA();
  if (cmd === 'restart') {
    stopWA();
    setTimeout(() => startWA(), 2000);
  }
  if (cmd === 'delete') await deleteSession();

  res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});
