# 🚀 Panduan Deploy ke Neon + Railway + Vercel

Proyek ini sudah dikonfigurasi untuk menggunakan:
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Node.js + Express)
- **Database**: Neon (PostgreSQL)

---

## ⚙️ Tahap 1: Setup Neon Database

### 1.1 Buat Project di Neon
1. Buka https://console.neon.tech
2. Klik "Create Project"
3. Pilih lokasi (lebih dekat ke user = lebih cepat)
4. Tunggu project selesai dibuat

### 1.2 Copy Connection String
1. Di dashboard Neon, klik "Database" → pilih database Anda
2. Copy **Connection String** (format: `postgresql://user:password@host/db`)
3. Parse connection string:
   ```
   postgresql://neon_user:abc123xyz@ep-xxxxxx.region.neon.tech/neon_dbname
   ```
   - `DB_HOST` = `ep-xxxxxx.region.neon.tech`
   - `DB_USER` = `neon_user`
   - `DB_PASS` = `abc123xyz`
   - `DB_NAME` = `neon_dbname`
   - `DB_PORT` = `5432` (default PostgreSQL)

### 1.3 Update `.env.local` Lokal (untuk testing)
```bash
DB_HOST=ep-xxxxxx.region.neon.tech
DB_PORT=5432
DB_USER=neon_user
DB_PASS=abc123xyz
DB_NAME=neon_dbname
```

### 1.4 Apply Schema (create tables)
```bash
node backend/migrate-pg.js
```

Jika berhasil, output:
```
✅ Migrations completed successfully!

📊 Tables created:
  - users
  - classes
  - warehouses
  - racks
  - slots
  - equipment
  - placement_history
```

---

## 🚂 Tahap 2: Deploy Backend ke Railway

### 2.1 Setup Railway Project
1. Buka https://railway.app
2. Login dengan GitHub
3. Klik "New Project" → "Deploy from GitHub repo"
4. Pilih repository `RDW`

### 2.2 Setup Environment Variables di Railway
Di Railway dashboard → Variables tab, masukkan:

```
NODE_ENV=production
PORT=5000
FRONTEND_ORIGIN=https://sistem-penempatan-barang.vercel.app
SESSION_SECRET=your-random-secret-key-here-at-least-32-chars

DB_HOST=ep-xxxxxx.region.neon.tech
DB_PORT=5432
DB_USER=neon_user
DB_PASS=abc123xyz
DB_NAME=neon_dbname
```

### 2.3 Deploy
Railway akan auto-detect Node.js dan deploy backend Anda. Tunggu sampai status "Success".

### 2.4 Copy Backend URL
Setelah deploy, Railway beri Anda domain seperti:
```
https://sistem-rdw-backend.railway.app
```

Copy URL ini untuk step berikutnya.

---

## 🎨 Tahap 3: Update Vercel Frontend

### 3.1 Update Environment Variable
Di Vercel dashboard → Project Settings → Environment Variables:

```
NEXT_PUBLIC_API_BASE=https://sistem-rdw-backend.railway.app
```

### 3.2 Redeploy Frontend
Setelah update env variable, Vercel otomatis redeploy. Atau klik "Redeploy" di Deployments tab.

---

## ✅ Testing Connection

### Local Testing
```bash
# Test backend API
curl http://localhost:5000/api/health

# Output:
# {"status":"ok","db":true,"envLoaded":true}

# Test frontend
npm run dev
# Buka http://localhost:3000
```

### Production Testing
1. Buka https://sistem-penempatan-barang.vercel.app
2. Klik Network tab di DevTools
3. Akses API → check apakah response dari backend URL yang benar

---

## 🔧 Troubleshooting

### Error: "DB tidak terhubung"
**Solusi:**
- Check Database credentials di env variables
- Pastikan IP address Neon memperbolehkan koneksi (Settings → IP Whitelist)
- Test koneksi lokal dulu: `psql postgresql://...`

### Error: "Unauthorized" pada API call
**Solusi:**
- Check FRONTEND_ORIGIN di backend env variables
- Pastikan URL sesuai dengan Vercel domain

### Port 5000 sudah dipakai
**Solusi:**
- Set PORT=5001 di env variables Railway

---

## 📝 Struktur Database

```
users
├── user_id (PK)
├── username (UNIQUE)
├── password_hash
├── role (admin, frontdesk, teknisi, manager)
└── is_active

classes (Kategori Barang)
├── class_id (PK)
├── class_code (UNIQUE)
└── class_name

warehouses (Gudang)
├── warehouse_id (PK)
├── warehouse_code (UNIQUE)
└── warehouse_name

racks (Rak dalam Gudang)
├── rack_id (PK)
├── warehouse_id (FK)
└── rack_code

slots (Tempat di Rak)
├── slot_id (PK)
├── rack_id (FK)
└── slot_code

equipment (Barang)
├── equipment_id (PK)
├── equipment_code (UNIQUE)
├── class_id (FK)
├── current_slot_id (FK)
└── readiness_status

placement_history (Log Perpindahan)
├── history_id (PK)
├── equipment_id (FK)
├── from_slot_id (FK)
├── to_slot_id (FK)
└── created_at
```

---

## 🚀 Next Steps

1. ✅ Setup Neon database
2. ✅ Deploy backend ke Railway
3. ✅ Update Vercel frontend env variables
4. ✅ Test semua endpoints
5. 🔒 Secure credentials (jangan share di GitHub!)

---

## 📞 Support

Jika ada error, cek:
1. Backend logs di Railway dashboard
2. Vercel logs di Deployment tab
3. Neon query logs di console.neon.tech

Happy deploying! 🎉
