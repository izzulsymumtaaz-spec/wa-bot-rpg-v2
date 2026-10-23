# ASHIROU BOT V1 — starter project

Project ini adalah **starter yang bisa dijalankan**, bukan implementasi penuh semua butir checklist. Sudah ada Baileys, koneksi WhatsApp, SQLite persisten, menu, RPG dasar, dungeon/monster sederhana, pekerjaan, transfer, sistem sewa grup, role Owner/Admin dasar, API dashboard, dan UI responsif.

## Yang belum lengkap
Belum ada lebih dari 50 monster yang didesain seimbang; Black Smith, rumah/listrik/mining, quest, AFK, pernikahan/keluarga, bank lengkap, gift, mini-game, gambar+lagu menu, role ekonomi tanpa batas, deployer khusus, dan banyak aturan RPG masih belum dibuat. Jangan anggap semua item checklist sudah selesai.

## Kebutuhan
- Node.js 20 atau lebih baru
- npm
- Koneksi internet
- WhatsApp di ponsel untuk menautkan perangkat

## Instalasi lokal / Termux
1. Ekstrak ZIP, lalu masuk ke folder project.
2. Pasang Node.js 20+ di Termux: `pkg update && pkg upgrade`, lalu `pkg install nodejs-lts unzip`.
3. Salin `.env.example` menjadi `.env`.
   - Linux/macOS/Termux: `cp .env.example .env`
   - Windows PowerShell: `Copy-Item .env.example .env`
4. Edit `.env`, ganti `DASHBOARD_TOKEN` dengan rahasia acak panjang minimal 20 karakter. Atur `OWNER_NUMBERS` dengan nomor WhatsApp format internasional tanpa `+`, misalnya `62812...`.
5. Jalankan `npm install`.
6. Jalankan `npm start`. **Satu proses ini menjalankan dashboard API dan koneksi bot WhatsApp**.
7. Buka `http://127.0.0.1:3000` di browser perangkat yang sama. Masukkan token dashboard, tekan **Tampilkan QR**, lalu scan lewat WhatsApp > Perangkat tertaut > Tautkan perangkat.
8. Coba `.menu`, `.rpg`, `.dungeon`, `.work` di chat WhatsApp.

## Deploy ke VPS / hosting Node.js
1. Upload dan ekstrak project ke server.
2. Pastikan Node.js 20+ tersedia.
3. Buat `.env` dari `.env.example`, lalu atur token rahasia, nomor owner, dan port.
4. Jalankan `npm install`.
5. Jalankan `npm start`. Untuk VPS, gunakan PM2 agar hidup lagi setelah crash:
   - `npm install -g pm2`
   - `pm2 start src/server.js --name ashirou-bot`
   - `pm2 save`
6. Akses dashboard lewat HTTPS/reverse proxy. Jangan mengekspos dashboard langsung ke internet tanpa HTTPS dan token yang kuat.
7. Simpan folder `auth_info/` dan `database.sqlite` pada storage persisten dan lakukan backup berkala. Jangan jalankan salinan bot kedua dengan folder autentikasi yang sama.

## Perintah yang tersedia
- `.menu`
- `.rpg`
- `.dungeon` / `.dgn`
- `.work` / `.job`
- `.transfer @tag jumlah`
- `.sewa`
- `.ceksewa` (di grup)
- `.addsewa jumlah_hari` (Owner, di grup)
- `.addadmin @tag` / `.deladmin @tag` (Owner)
- `.admin`
- `.owner`

## Database
File `database.sqlite` dibuat otomatis. Tabel pemain, setting, sewa, admin, log, dan transaksi tersimpan di sana. Jangan hapus file itu kalau ingin mempertahankan data.

## Keamanan
- Ganti `DASHBOARD_TOKEN` sebelum membuka dashboard ke jaringan.
- Gunakan HTTPS/reverse proxy dan firewall.
- Folder `auth_info/` adalah kredensial login WhatsApp: jangan bagikan.
- Fitur ini menggunakan Baileys (library pihak ketiga tidak resmi). Koneksi bisa putus dan penggunaan otomatisasi dapat memiliki risiko akun. Patuhi ketentuan WhatsApp.
- Jangan gunakan uang Owner/Admin tak terbatas untuk transaksi pemain biasa; mekanisme ekonomi admin khusus belum diimplementasikan di starter ini.
