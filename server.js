require('dotenv').config();
const express = require('express');
const path = require('path');
const { db, log, setting, setSetting } = require('./db');
const bot = require('./index');
const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
function auth(req,res,next) {
  const token = process.env.DASHBOARD_TOKEN;
  if (!token || token.length < 20) return res.status(503).json({ error: 'Atur DASHBOARD_TOKEN minimal 20 karakter di .env lalu restart.' });
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  if (got !== token) return res.status(401).json({ error: 'Token dashboard salah.' });
  next();
}
app.get('/api/status', auth, (req,res) => res.json({ ...bot.getStatus(), rentalCount: db.prepare('SELECT count(*) n FROM rentals').get().n, players: db.prepare('SELECT count(*) n FROM players').get().n }));
app.get('/api/settings', auth, (req,res) => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  res.json(Object.fromEntries(rows.map(r => [r.key,r.value])));
});
app.post('/api/settings', auth, (req,res) => {
  const allowed = new Set(['prefix','botName','rpgEnabled','rentalRpgOnly','theme','darkMode','animations']);
  for (const [key,value] of Object.entries(req.body || {})) {
    if (!allowed.has(key)) continue;
    if (typeof value !== 'string' && typeof value !== 'boolean') continue;
    if (key === 'prefix' && (String(value).length < 1 || String(value).length > 3)) return res.status(400).json({error:'Prefix harus 1-3 karakter.'});
    setSetting(key, String(value));
  }
  log('dashboard','settings_updated',Object.keys(req.body || {}).join(','));
  res.json({ ok:true });
});
app.get('/api/logs', auth, (req,res) => res.json(db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 100').all()));
app.get('/api/players', auth, (req,res) => res.json(db.prepare('SELECT jid,name,hp,mana,money,floor,level,xp FROM players ORDER BY money DESC LIMIT 100').all()));
app.get('/api/qr', auth, (req,res) => {
  const qr = bot.getQR();
  if (!qr) return res.json({ qr:null, message:'QR belum tersedia. Pastikan bot berjalan dan belum tertaut.' });
  res.json({ qr });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Dashboard tersedia di http://localhost:${port}`));
