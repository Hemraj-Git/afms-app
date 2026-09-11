-- AFMS Baseline Master Data Seed Script
-- Run this in Supabase SQL Editor

-- 0. Ensure default timestamp on created_at for all tables
ALTER TABLE IF EXISTS departments ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE IF EXISTS campuses ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE IF EXISTS buildings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE IF EXISTS rooms ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE IF EXISTS categories ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE IF EXISTS sub_categories ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE IF EXISTS assets ALTER COLUMN created_at SET DEFAULT NOW();

-- 1. Departments
INSERT INTO departments (id, name, code, description, created_at) VALUES
  ('DEP-0001', 'Facility Operations', 'FAC', 'Campus facilities, utilities and premises management', NOW()),
  ('DEP-0002', 'Engineering & Maintenance', 'ENG', 'Technical and mechanical maintenance operations', NOW()),
  ('DEP-0003', 'Academic Operations', 'ACAD', 'Faculty, curriculum and simulator training blocks', NOW()),
  ('DEP-0004', 'Quality & Safety', 'QA', 'Quality compliance and safety inspections', NOW()),
  ('DEP-0005', 'Facilities & Hygiene', 'HYG', 'Sanitization and housekeeping management', NOW())
ON CONFLICT DO NOTHING;

-- 2. Campuses
INSERT INTO campuses (id, name, code, address, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Hemraj Marine Academy Main Campus', 'HMA-MAIN', 'Plot 42, Maritime Knowledge Park, Navi Mumbai', NOW())
ON CONFLICT DO NOTHING;

-- 3. Buildings
INSERT INTO buildings (id, campus_id, name, code, total_floors, created_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Simulator & Engineering Complex', 'SEC', 4, NOW()),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Maritime Administration & Academic Wing', 'MAW', 3, NOW())
ON CONFLICT DO NOTHING;

-- 4. Rooms
INSERT INTO rooms (id, building_id, name, room_number, type, is_reservable, qr_code_key, status, created_at) VALUES
  ('r0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Bridge Simulator Room A', 'SEC-101', 'Simulator', true, 'ROOM-SEC-101', 'Available', NOW()),
  ('r0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Engine Simulator Room B', 'SEC-102', 'Simulator', true, 'ROOM-SEC-102', 'Available', NOW()),
  ('r0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Heavy Marine Workshop', 'SEC-W01', 'Workshop', false, 'ROOM-SEC-W01', 'Available', NOW()),
  ('r0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Nautical Science Lecture Hall', 'MAW-201', 'Classroom', true, 'ROOM-MAW-201', 'Available', NOW()),
  ('r0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Central Server & Telecom Room', 'MAW-S01', 'Server Room', false, 'ROOM-MAW-S01', 'Available', NOW())
ON CONFLICT DO NOTHING;

-- 5. Categories
INSERT INTO categories (id, name, code, description, created_at) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Marine Navigation & Simulation', 'NAV', 'Navigational aids, radar, bridge systems and full-mission simulators', NOW()),
  ('c0000000-0000-0000-0000-000000000002', 'Marine Engineering & Propulsion', 'ENG', 'Diesel engines, auxiliary boilers, pumps and mechanical plant equipment', NOW()),
  ('c0000000-0000-0000-0000-000000000003', 'HVAC & Climate Systems', 'HVAC', 'Central chillers, air handling units and ducting equipment', NOW()),
  ('c0000000-0000-0000-0000-000000000004', 'Power Generation & Electrical', 'ELEC', 'Generators, switchboards, UPS units and electrical distribution', NOW())
ON CONFLICT DO NOTHING;

-- 6. Subcategories
INSERT INTO sub_categories (id, category_id, name, code, description, created_at) VALUES
  ('s0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Full Mission Bridge Simulators', 'FMBS', 'High-fidelity marine bridge training console', NOW()),
  ('s0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'Marine Diesel Engine Trainers', 'MDET', '4-stroke maritime diesel engine instructional testbeds', NOW()),
  ('s0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Precision Air Handling Units', 'AHU', 'Industrial clean air delivery and humidity control', NOW()),
  ('s0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'Emergency Diesel Generators', 'EDG', 'Backup power diesel genset systems', NOW())
ON CONFLICT DO NOTHING;

-- 7. Sample Assets
INSERT INTO assets (id, asset_id, name, sub_category_id, room_id, manufacturer, model_number, serial_number, price, installation_date, status, qr_code_url, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'AST-NAV-001', 'Kongsberg K-Sim Bridge Console', 's0000000-0000-0000-0000-000000000001', 'r0000000-0000-0000-0000-000000000001', 'Kongsberg Maritime', 'K-Sim Bridge 5', 'KB-2024-8891', 12500000.00, '2024-03-15', 'Operational', 'AST-NAV-001', NOW()),
  ('e0000000-0000-0000-0000-000000000002', 'AST-ENG-002', 'Wartsila 6L20 Instructional Engine', 's0000000-0000-0000-0000-000000000002', 'r0000000-0000-0000-0000-000000000003', 'Wartsila Marine', '6L20 Marine Gen', 'WAR-99021', 8400000.00, '2023-11-20', 'Operational', 'AST-ENG-002', NOW()),
  ('e0000000-0000-0000-0000-000000000003', 'AST-HVAC-003', 'Daikin Variable Air Volume AHU-01', 's0000000-0000-0000-0000-000000000003', 'r0000000-0000-0000-0000-000000000001', 'Daikin Applied', 'D-AHU-500', 'DKN-2023-019', 1200000.00, '2023-08-10', 'Operational', 'AST-HVAC-003', NOW()),
  ('e0000000-0000-0000-0000-000000000004', 'AST-ELEC-004', 'Cummins Onan 250kVA Emergency Genset', 's0000000-0000-0000-0000-000000000004', 'r0000000-0000-0000-0000-000000000005', 'Cummins Power', 'C250-D5B', 'CUM-887410', 3100000.00, '2022-06-01', 'Operational', 'AST-ELEC-004', NOW())
ON CONFLICT DO NOTHING;
