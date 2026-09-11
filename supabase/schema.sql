-- AFMS (Asset & Facility Management System) Master Database Schema
-- Compatible with Supabase PostgreSQL (Postgres 15+)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations & Hierarchy
CREATE TABLE IF NOT EXISTS campuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campus_id UUID REFERENCES campuses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    total_floors INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    room_number VARCHAR(50) NOT NULL,
    type VARCHAR(50) DEFAULT 'General', -- Classroom, Simulator, Office, Engine Room, Workshop, Dining
    is_reservable BOOLEAN DEFAULT FALSE,
    qr_code_key VARCHAR(100) UNIQUE,
    current_occupant_id UUID,
    status VARCHAR(50) DEFAULT 'Available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users & Roles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Faculty', 'Technician', 'Inspector', 'Housekeeping')),
    department VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Asset Taxonomy & Dynamic Schema
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sub_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    
    -- Dynamic specification metadata fields JSON array
    metadata_fields JSONB DEFAULT '[]'::jsonb,
    
    -- Inspection schedule configuration
    inspection_enabled BOOLEAN DEFAULT FALSE,
    inspection_template_id UUID,
    inspection_interval VARCHAR(50) DEFAULT 'Quarterly',
    
    -- PM schedule configuration
    pm_enabled BOOLEAN DEFAULT FALSE,
    pm_template_id UUID,
    pm_interval VARCHAR(50) DEFAULT 'Monthly',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (category_id, code)
);

-- 4. Vendors & Contracts
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category_supplied VARCHAR(255),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    has_amc BOOLEAN DEFAULT FALSE,
    amc_contract_no VARCHAR(100),
    amc_start_date DATE,
    amc_end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Checklist Templates & Versioning (ISO 9001 audit integrity)
CREATE TABLE IF NOT EXISTS checklist_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Preventive Maintenance', 'Inspection')),
    description TEXT,
    version INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Archived')),
    items JSONB DEFAULT '[]'::jsonb, -- Array of questions, tolerances, input types
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Physical Assets
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. AST001 / MUM-AC-0042
    name VARCHAR(255) NOT NULL,
    sub_category_id UUID REFERENCES sub_categories(id) ON DELETE RESTRICT,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    
    manufacturer VARCHAR(255),
    model_number VARCHAR(255),
    serial_number VARCHAR(255),
    price NUMERIC(12, 2),
    purchase_date DATE,
    installation_date DATE NOT NULL,
    warranty_till DATE,
    
    maintenance_by VARCHAR(50) DEFAULT 'In House' CHECK (maintenance_by IN ('In House', 'Vendor')),
    maintenance_vendor_id UUID REFERENCES vendors(id),
    purchase_vendor_id UUID REFERENCES vendors(id),
    
    dynamic_specifications JSONB DEFAULT '{}'::jsonb,
    image_url TEXT,
    notes TEXT,
    
    status VARCHAR(50) DEFAULT 'Operational' CHECK (status IN ('Operational', 'Under Maintenance', 'Under Inspection', 'Retired')),
    qr_code_url TEXT,
    last_printed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Document Library (Many-to-Many Decoupled Storage)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('Invoice', 'Warranty', 'User Guide', 'AMC Contract', 'Other')),
    file_url TEXT NOT NULL,
    file_size_kb INT,
    uploaded_by UUID REFERENCES user_profiles(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_documents (
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, document_id)
);

-- 8. Service Requests
CREATE TABLE IF NOT EXISTS service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id VARCHAR(50) UNIQUE NOT NULL, -- e.g. SCT001
    title VARCHAR(255) NOT NULL,
    description TEXT,
    request_type VARCHAR(50) DEFAULT 'Maintenance' CHECK (request_type IN ('Maintenance', 'Cleaning', 'IT Support', 'General')),
    
    room_id UUID REFERENCES rooms(id),
    asset_id UUID REFERENCES assets(id),
    
    requested_by UUID REFERENCES user_profiles(id),
    assigned_to UUID REFERENCES user_profiles(id),
    
    status VARCHAR(50) DEFAULT 'Open' CHECK (status IN ('Open', 'Technician Assigned', 'In Progress', 'Resolved', 'Overdue', 'Closed')),
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    sla_due_date TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    photo_urls JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Work Orders (Preventive & Corrective Maintenance)
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wo_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. WO-PM-2026-001
    type VARCHAR(50) NOT NULL CHECK (type IN ('Preventive', 'Corrective')),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    source VARCHAR(50) DEFAULT 'Scheduled', -- Scheduled, Service Request, Failed Inspection
    source_reference_id VARCHAR(100),
    
    frequency VARCHAR(50), -- Monthly, Quarterly, Yearly
    due_date DATE NOT NULL,
    
    assigned_technician_id UUID REFERENCES user_profiles(id),
    vendor_id UUID REFERENCES vendors(id),
    
    status VARCHAR(50) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Technician Assigned', 'In Progress', 'Completed', 'Cancelled')),
    
    checklist_template_id UUID REFERENCES checklist_templates(id),
    checklist_snapshot JSONB, -- Frozen checklist items at assignment
    checklist_responses JSONB, -- Answers recorded
    
    issue_logged TEXT,
    solution_taken TEXT,
    technician_remarks TEXT,
    evidence_photos JSONB DEFAULT '[]'::jsonb,
    
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Inspections (ISO 9001 Compliance Evidence)
CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. INSP-2026-0042
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    template_id UUID REFERENCES checklist_templates(id),
    template_version INT DEFAULT 1,
    
    assigned_inspector_id UUID REFERENCES user_profiles(id),
    due_date DATE NOT NULL,
    
    status VARCHAR(50) DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Inspector Assigned', 'In Progress', 'Completed')),
    result VARCHAR(20) CHECK (result IN ('Pass', 'Fail', 'Not Applicable')),
    
    checklist_snapshot JSONB,
    checklist_responses JSONB,
    inspector_remarks TEXT,
    evidence_photos JSONB DEFAULT '[]'::jsonb,
    
    created_corrective_wo_id UUID REFERENCES work_orders(id),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Room Access & Purpose Logs (Tamper-evident)
CREATE TABLE IF NOT EXISTS room_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    check_out_time TIMESTAMP WITH TIME ZONE,
    purpose VARCHAR(100) NOT NULL, -- Training, Maintenance, Inspection, Meeting, Self-Study
    is_force_checkout BOOLEAN DEFAULT FALSE,
    notes TEXT
);

-- 12. Asset Activity Timeline / Audit Trail (Immutable ISO 9001 Audit Trail)
CREATE TABLE IF NOT EXISTS asset_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id),
    action VARCHAR(100) NOT NULL, -- Asset Created, Location Changed, Details Edited, Service Request Raised, Under Maintenance, Marked Operational, etc.
    old_value JSONB,
    new_value JSONB,
    remarks TEXT,
    reference_id VARCHAR(100),
    source VARCHAR(50) DEFAULT 'System', -- Manual / System
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Room Reservations (Optional / Reservable Area Grid)
CREATE TABLE IF NOT EXISTS room_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    reserved_by UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_hour INT NOT NULL CHECK (start_hour >= 0 AND start_hour <= 23),
    end_hour INT NOT NULL CHECK (end_hour >= 1 AND end_hour <= 24),
    title VARCHAR(255) NOT NULL,
    purpose TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
