-- PostgreSQL Schema untuk RDW (Sistem Penempatan Barang)
-- Create sesuai urutan dependency tabel

-- ============================================================
-- Users (Account Management)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'frontdesk',
  is_active INTEGER DEFAULT 1,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Classes (Jenis/Kategori Barang)
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
  class_id SERIAL PRIMARY KEY,
  class_code VARCHAR(50) NOT NULL UNIQUE,
  class_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Warehouses (Gudang/Lokasi Utama)
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  warehouse_id SERIAL PRIMARY KEY,
  warehouse_code VARCHAR(50) NOT NULL UNIQUE,
  warehouse_name VARCHAR(255) NOT NULL,
  address TEXT,
  capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Racks (Rak dalam Gudang)
-- ============================================================
CREATE TABLE IF NOT EXISTS racks (
  rack_id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  rack_code VARCHAR(100) NOT NULL,
  zone VARCHAR(100),
  capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(warehouse_id, rack_code)
);

-- ============================================================
-- Slots (Slot/Tempat di Rak)
-- ============================================================
CREATE TABLE IF NOT EXISTS slots (
  slot_id SERIAL PRIMARY KEY,
  rack_id INTEGER NOT NULL REFERENCES racks(rack_id) ON DELETE CASCADE,
  slot_code VARCHAR(100) NOT NULL,
  slot_label VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(rack_id, slot_code)
);

-- ============================================================
-- Equipment (Barang/Alat)
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment (
  equipment_id SERIAL PRIMARY KEY,
  equipment_code VARCHAR(100) NOT NULL UNIQUE,
  equipment_name VARCHAR(255) NOT NULL,
  class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE RESTRICT,
  serial_number VARCHAR(255),
  brand VARCHAR(255),
  model VARCHAR(255),
  condition_note TEXT,
  readiness_status VARCHAR(50) DEFAULT 'Ready',
  current_slot_id INTEGER REFERENCES slots(slot_id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Placement History (Log Perpindahan Barang)
-- ============================================================
CREATE TABLE IF NOT EXISTS placement_history (
  history_id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(equipment_id) ON DELETE CASCADE,
  from_slot_id INTEGER REFERENCES slots(slot_id) ON DELETE SET NULL,
  to_slot_id INTEGER REFERENCES slots(slot_id) ON DELETE SET NULL,
  status_before VARCHAR(50),
  status_after VARCHAR(50),
  description TEXT,
  performed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Indexes untuk optimasi query (opsional tapi recommended)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_equipment_current_slot ON equipment(current_slot_id);
CREATE INDEX IF NOT EXISTS idx_equipment_class ON equipment(class_id);
CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(readiness_status);
CREATE INDEX IF NOT EXISTS idx_equipment_code ON equipment(equipment_code);

CREATE INDEX IF NOT EXISTS idx_racks_warehouse ON racks(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_slots_rack ON slots(rack_id);

CREATE INDEX IF NOT EXISTS idx_placement_equipment ON placement_history(equipment_id);
CREATE INDEX IF NOT EXISTS idx_placement_from_slot ON placement_history(from_slot_id);
CREATE INDEX IF NOT EXISTS idx_placement_to_slot ON placement_history(to_slot_id);
CREATE INDEX IF NOT EXISTS idx_placement_created ON placement_history(created_at);
