require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode');
const {
  default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { db, log, setting } = require('./db');
const { ensurePlayer, profile, fight, work, transfer } = require('./game');

const OWNER_NUMBERS = (process.env.OWNER_NUMBERS || '').split(',').map(x => x.trim()).filter(Boolean);
let sock;
let connected = false;
let qrDataUrl = null;
let reconnecting = false;
const status = () => ({ connected, botName: setting('botName'), prefix: setting('prefix'), qrAvailable: Boolean(qrDataUrl) });
async function startBot() {
  if (reconnecting) return;
  reconnecting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({ version, auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: false, browser: ['ASHIROU BOT V1','Chrome','1.0.0'] });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        try { qrDataUrl = await qrcode.toDataURL(qr); console.log('QR baru tersedia. Buka dashboard untuk melihat QR atau cek terminal.'); } catch {}
        console.log('Scan QR dari WhatsApp > Perangkat tertaut.');
      }
      if (connection === 'open') { connected = true; qrDataUrl = null; log('system','whatsapp_connected'); console.log('WhatsApp tersambung.'); }
      if (connection === 'close') {
        connected = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        log('system','whatsapp_disconnected', code || '');
        if (code !== DisconnectReason.loggedOut) setTimeout(() => { reconnecting = false; startBot(); }, 3000);
      }
    });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        if (!m.message || m.key.fromMe) continue;
        const jid = m.key.remoteJid;
        if (jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || '';
        const prefix = setting('prefix') || '.';
        if (!text.startsWith(prefix)) continue;
        const args = text.slice(prefix.length).trim().split(/\s+/);
        const command = (args.shift() || '').toLowerCase();
        const sender = m.key.participant || jid;
        const userJid = sender;
        const number = userJid.split('@')[0].split(':')[0];
        const isOwner = OWNER_NUMBERS.includes(number);
        const isAdmin = Boolean(db.prepare('SELECT 1 FROM admins WHERE jid=?').get(userJid));
        const isGroup = jid.endsWith('@g.us');
        const reply = async body => sock.sendMessage(jid, { text: body }, { quoted: m });
        try {
          if (['menu','help'].includes(command)) {
            await reply(`🌌 *${setting('botName')}*\n\n${prefix}menu — menu utama\n${prefix}rpg — status karakter\n${prefix}dungeon / ${prefix}dgn — lawan monster\n${prefix}work — bekerja\n${prefix}transfer @tag jumlah — transfer uang\n${prefix}sewa — info sewa grup\n${prefix}ceksewa — cek masa sewa\n${prefix}addsewa hari — owner tambah sewa grup\n${prefix}owner — info owner\n\nBot versi starter; cek README untuk fitur yang sudah tersedia.`);
          } else if (command === 'rpg') {
            if (setting('rpgEnabled') !== 'true') { await reply('Fitur RPG sedang dinonaktifkan owner.'); continue; }
            if (isGroup && setting('rentalRpgOnly') === 'true' && !isOwner) {
              const rental = db.prepare('SELECT expires_at FROM rentals WHERE group_jid=?').get(jid);
              if (!rental || new Date(rental.expires_at) <= new Date()) { await reply('Grup ini belum menyewa atau masa sewanya habis.'); continue; }
            }
            ensurePlayer(userJid, m.pushName || 'Player');
            await reply(profile(userJid));
          } else if (['dungeon','dgn'].includes(command)) {
            if (setting('rpgEnabled') !== 'true') { await reply('Fitur RPG sedang dinonaktifkan owner.'); continue; }
            if (isGroup && setting('rentalRpgOnly') === 'true' && !isOwner) {
              const rental = db.prepare('SELECT expires_at FROM rentals WHERE group_jid=?').get(jid);
              if (!rental || new Date(rental.expires_at) <= new Date()) { await reply('Grup ini belum menyewa atau masa sewanya habis.'); continue; }
            }
            ensurePlayer(userJid, m.pushName || 'Player');
            await reply(fight(userJid));
          } else if (command === 'work' || command === 'job') {
            ensurePlayer(userJid, m.pushName || 'Player'); await reply(work(userJid));
          } else if (command === 'transfer') {
            const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const target = mentioned[0];
            const amount = Number(args[args.length-1]);
            if (!target) { await reply(`Format: ${prefix}transfer @tag jumlah`); continue; }
            ensurePlayer(userJid, m.pushName || 'Player');
            await reply(transfer(userJid, target, amount));
          } else if (command === 'sewa') {
            await reply(`📦 *Sistem Sewa Grup*\n${prefix}ceksewa — cek status grup\nOwner: ${prefix}addsewa jumlah_hari (di grup)`);
          } else if (command === 'ceksewa') {
            if (!isGroup) { await reply('Jalankan perintah ini di grup WhatsApp.'); continue; }
            const r = db.prepare('SELECT expires_at FROM rentals WHERE group_jid=?').get(jid);
            await reply(!r ? 'Grup ini belum memiliki sewa.' : new Date(r.expires_at) > new Date() ? `✅ Sewa aktif sampai ${new Date(r.expires_at).toLocaleString('id-ID')}` : `❌ Sewa habis pada ${new Date(r.expires_at).toLocaleString('id-ID')}`);
          } else if (command === 'addsewa') {
            if (!isOwner) { await reply('Perintah ini khusus Owner.'); continue; }
            if (!isGroup) { await reply('Jalankan perintah ini di grup target.'); continue; }
            const days = Number(args[0]);
            if (!Number.isInteger(days) || days < 1 || days > 3650) { await reply(`Format: ${prefix}addsewa 30`); continue; }
            const old = db.prepare('SELECT expires_at FROM rentals WHERE group_jid=?').get(jid);
            const start = old && new Date(old.expires_at) > new Date() ? new Date(old.expires_at) : new Date();
            start.setDate(start.getDate() + days);
            db.prepare('INSERT INTO rentals(group_jid,expires_at,updated_by) VALUES (?,?,?) ON CONFLICT(group_jid) DO UPDATE SET expires_at=excluded.expires_at,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP').run(jid,start.toISOString(),userJid);
            log(userJid,'rental_add',`${jid} ${days} days`);
            await reply(`✅ Sewa grup ditambahkan ${days} hari.\nBerakhir: ${start.toLocaleString('id-ID')}`);
          } else if (command === 'owner') {
            await reply(`Owner number: ${OWNER_NUMBERS.length ? OWNER_NUMBERS.map(n=>'+'+n).join(', ') : 'Belum diatur di .env'}`);
          } else if (command === 'addadmin') {
            if (!isOwner) { await reply('Khusus Owner.'); continue; }
            const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!mentioned[0]) { await reply(`Format: ${prefix}addadmin @tag`); continue; }
            db.prepare('INSERT OR IGNORE INTO admins(jid,added_by) VALUES (?,?)').run(mentioned[0],userJid);
            log(userJid,'add_admin',mentioned[0]); await reply('Admin berhasil ditambahkan.');
          } else if (command === 'deladmin') {
            if (!isOwner) { await reply('Khusus Owner.'); continue; }
            const mentioned = m.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (!mentioned[0]) { await reply(`Format: ${prefix}deladmin @tag`); continue; }
            db.prepare('DELETE FROM admins WHERE jid=?').run(mentioned[0]);
            log(userJid,'delete_admin',mentioned[0]); await reply('Admin dihapus.');
          } else if (command === 'admin') {
            await reply(isOwner || isAdmin ? 'Role kamu: ' + (isOwner ? 'Owner' : 'Admin') : 'Kamu bukan Owner/Admin.');
          }
        } catch (e) { console.error('Command error:', e); log(userJid,'command_error',e.message); await reply('Terjadi error saat menjalankan perintah. Coba lagi nanti.'); }
      }
    });
  } catch (e) { console.error('Gagal memulai bot:', e); log('system','startup_error',e.message); }
  finally { reconnecting = false; }
}
function getStatus() { return status(); }
function getQR() { return qrDataUrl; }
startBot();
module.exports = { getStatus, getQR };
