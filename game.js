const { db, log } = require('./db');
const monsters = [
  ['Slime', 35, 8, 30], ['Goblin', 55, 12, 50], ['Wolf', 65, 14, 65],
  ['Skeleton', 75, 16, 80], ['Orc', 110, 22, 120], ['Dark Mage', 95, 28, 150],
  ['Wyvern', 180, 35, 250], ['Shadow Knight', 220, 42, 350], ['Dungeon Lord', 350, 55, 700]
];
function ensurePlayer(jid, name='Player') {
  db.prepare('INSERT OR IGNORE INTO players(jid,name) VALUES (?,?)').run(jid, name);
  return db.prepare('SELECT * FROM players WHERE jid=?').get(jid);
}
function profile(jid) {
  const p = db.prepare('SELECT * FROM players WHERE jid=?').get(jid);
  if (!p) return null;
  return `⚔️ *ASHIROU RPG*\nNama: ${p.name}\nLevel: ${p.level} | XP: ${p.xp}\nHP: ${p.hp}/${p.max_hp}\nMana: ${p.mana}/${p.max_mana}\nUang: $${p.money.toLocaleString('en-US')}\nDungeon: lantai ${p.floor}`;
}
function fight(jid) {
  const p = ensurePlayer(jid);
  if (p.hp <= 0) return 'HP kamu habis. Pulihkan dulu sebelum bertarung.';
  if (p.mana < 5) return 'Mana minimal 5 untuk masuk dungeon.';
  const floor = p.floor;
  const template = monsters[(floor - 1) % monsters.length];
  const [name, baseHp, attack, reward] = template;
  const monsterHp = baseHp + Math.floor(floor * 2.5);
  const damage = Math.max(5, 18 + p.level * 3 + Math.floor(Math.random()*12));
  const enemyDamage = Math.max(2, attack + Math.floor(floor/10) - Math.floor(p.level/3));
  const won = damage >= monsterHp || Math.random() < Math.min(0.8, damage / monsterHp);
  const hp = Math.max(0, p.hp - (won ? Math.floor(enemyDamage/2) : enemyDamage));
  const mana = Math.max(0, p.mana - 5);
  if (won) {
    const xp = 20 + floor * 2;
    const money = reward + floor * 10;
    const level = p.xp + xp >= p.level * 100 ? p.level + 1 : p.level;
    const xpNow = level > p.level ? 0 : p.xp + xp;
    const nextFloor = Math.min(9999, floor + 1);
    db.prepare('UPDATE players SET hp=?,mana=?,money=money+?,xp=?,level=?,floor=? WHERE jid=?')
      .run(hp, mana, money, xpNow, level, nextFloor, jid);
    log(jid, 'rpg_win', `${name}; floor=${floor}; reward=${money}`);
    return `🏆 Menang melawan *${name}*!\nDamage: ${damage}\nHadiah: $${money} dan ${xp} XP\n${level > p.level ? `⬆️ LEVEL UP! Level ${level}\n` : ''}Lantai berikutnya: ${nextFloor}\nHP: ${hp}/${p.max_hp} | Mana: ${mana}/${p.max_mana}`;
  }
  db.prepare('UPDATE players SET hp=?,mana=? WHERE jid=?').run(hp, mana, jid);
  log(jid, 'rpg_lose', `${name}; floor=${floor}`);
  return `💥 Kalah melawan *${name}*.\nHP: ${hp}/${p.max_hp} | Mana: ${mana}/${p.max_mana}\nCoba lagi setelah pulih.`;
}
function work(jid) {
  ensurePlayer(jid);
  const amount = 5000 + Math.floor(Math.random()*5001);
  db.prepare('UPDATE players SET money=money+? WHERE jid=?').run(amount, jid);
  log(jid, 'work', amount);
  return `💼 Kamu selesai bekerja dan mendapat $${amount.toLocaleString('en-US')}.`;
}
function transfer(from, to, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return 'Jumlah harus angka positif yang valid.';
  const run = db.transaction(() => {
    const sender = db.prepare('SELECT money FROM players WHERE jid=?').get(from);
    if (!sender || sender.money < amount) return false;
    ensurePlayer(to);
    db.prepare('UPDATE players SET money=money-? WHERE jid=?').run(amount, from);
    db.prepare('UPDATE players SET money=money+? WHERE jid=?').run(amount, to);
    db.prepare('INSERT INTO transactions(sender,recipient,amount,note) VALUES (?,?,?,?)').run(from,to,amount,'transfer');
    log(from, 'transfer', `${amount} to ${to}`);
    return true;
  });
  return run() ? `✅ Transfer $${amount.toLocaleString('en-US')} berhasil.` : 'Saldo tidak cukup.';
}
module.exports = { ensurePlayer, profile, fight, work, transfer, monsters };
