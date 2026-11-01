-- AssetNXG database baseline: the whole schema, as of migration 0056.
--
-- Run once on a NEW, empty Supabase project for a new client, then every
-- migration after 0056 in supabase/migrations, in order. Never run it on a
-- database that already has the app (SoMS): it creates tables, and stops at
-- the first one that exists.
--
-- Structure only, no data, except the defaults the app needs (SLA hours and
-- the built-in room types). Copied from the SoMS database's catalog; see
-- docs/NEW-CLIENT.md.

set check_function_bodies = off;
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Extensions (uuid-ossp and pgcrypto come with every Supabase project)
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Number sequences (SR-, WO-CR-, WO-PM-, INSP-, AL-A, OSR-)
-- ---------------------------------------------------------------------------
create sequence public.service_requests_ticket_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;
create sequence public.work_orders_pm_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;
create sequence public.work_orders_cr_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;
create sequence public.inspections_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;
create sequence public.room_activity_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;
create sequence public.outside_repairs_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.asset_activity_logs (
  id text not null,
  asset_id text,
  action text not null,
  by_user text not null,
  "timestamp" text not null,
  source text not null,
  remarks text,
  timestamp_epoch bigint,
  reference_id text
);
create table public.assets (
  id text default gen_random_uuid() not null,
  asset_id text not null,
  name text not null,
  sub_category_id text,
  room_id text,
  manufacturer text,
  model_number text,
  serial_number text,
  price numeric default 0,
  purchase_date text,
  installation_date text not null,
  warranty_till text,
  maintenance_by text default 'In House'::text,
  maintenance_vendor_id text,
  amc_start_date text,
  amc_end_date text,
  purchase_vendor_id text,
  assigned_to_user_id text,
  assigned_to_user_name text,
  dynamic_specifications jsonb default '{}'::jsonb,
  image_url text,
  notes text,
  status text default 'Operational'::text,
  qr_code_url text,
  last_printed_at text,
  created_at text not null,
  last_serviced_date date,
  sla_priority text
);
create table public.buildings (
  id text default gen_random_uuid() not null,
  campus_id text,
  name text not null,
  code text not null,
  total_floors integer default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table public.campuses (
  id text default gen_random_uuid() not null,
  name text not null,
  code text not null,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table public.categories (
  id text default gen_random_uuid() not null,
  name text not null,
  code text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table public.checklist_templates (
  id text default gen_random_uuid() not null,
  title text not null,
  type text not null,
  description text,
  "interval" text,
  items jsonb default '[]'::jsonb not null,
  updated_at text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table public.departments (
  id text default gen_random_uuid() not null,
  name text not null,
  code text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  head_user_id uuid
);
create table public.documents (
  id text default (gen_random_uuid())::text not null,
  title text not null,
  category text not null,
  file_name text not null,
  file_type text not null,
  file_size_bytes bigint not null,
  file_url text not null,
  related_entity_type text,
  related_entity_id text,
  uploaded_by_user_name text not null,
  uploaded_at text not null,
  asset_id text,
  inventory_item_id text
);
create table public.inspections (
  id text default (gen_random_uuid())::text not null,
  inspection_number text not null,
  asset_id text,
  template_id text,
  template_version integer default 1,
  due_date text not null,
  status text default 'Scheduled'::text,
  result text,
  remarks text,
  checklist_snapshot jsonb default '[]'::jsonb,
  checklist_responses jsonb default '{}'::jsonb,
  conducted_by text,
  conducted_by_user_id text,
  conducted_at text,
  created_at text not null,
  photo_url text,
  item_photos jsonb,
  start_photo_url text,
  instructions text
);
create table public.inventory_items (
  id text not null,
  inventory_number text not null,
  name text not null,
  sub_category_id text,
  manufacturer text,
  model_number text,
  part_number text,
  quantity integer default 0,
  min_stock_level integer default 0,
  unit_cost numeric default 0,
  storage_location text,
  vendor_id text,
  created_at text not null,
  serial_number text,
  warranty_till date,
  purchase_date date,
  dynamic_specifications jsonb default '{}'::jsonb,
  image_url text,
  notes text,
  room_id text
);
create table public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type text not null,
  title text not null,
  body text,
  ref_table text,
  ref_id text,
  is_read boolean default false not null,
  created_at timestamp with time zone default now() not null,
  pushed_at timestamp with time zone
);
create table public.outside_repairs (
  id text default (gen_random_uuid())::text not null,
  repair_number text not null,
  work_order_id text not null,
  asset_id text,
  scope text not null,
  component_name text,
  fault_description text,
  sent_by text default 'Technician'::text not null,
  vendor_id text,
  sent_date date not null,
  expected_return_date date not null,
  dispatch_ref text,
  vendor_ref text,
  estimated_cost numeric,
  dispatch_photo_url text,
  status text default 'Out for Repair'::text not null,
  returned_date date,
  outcome text,
  actual_cost numeric,
  return_remarks text,
  return_photo_url text,
  recorded_by text,
  returned_by text,
  overdue_notified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.profiles (
  id uuid not null,
  email text,
  full_name text not null,
  role text not null,
  department text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table public.push_config (
  id boolean default true not null,
  vapid_public_key text not null,
  vapid_private_jwk jsonb not null,
  functions_url text,
  subject text,
  created_at timestamp with time zone default now() not null
);
create table public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone default now() not null,
  last_success_at timestamp with time zone,
  failure_count integer default 0 not null
);
create table public.reservations (
  id text not null,
  reservation_number text not null,
  room_id text,
  room_name text not null,
  user_id text not null,
  user_name text not null,
  user_role text,
  department_name text,
  date text not null,
  time_slot text not null,
  slot_hour integer not null,
  purpose text not null,
  status text default 'Confirmed'::text,
  group_booking_id text,
  created_at text not null
);
create table public.room_access_logs (
  id text not null,
  room_id text,
  user_id text not null,
  user_name text not null,
  user_role text,
  purpose text,
  check_in_time text not null,
  check_out_time text,
  check_in_date text not null,
  check_in_timestamp bigint not null,
  is_force_checkout boolean default false,
  auto_checkout_note text,
  activity_number text,
  check_out_timestamp bigint,
  guest_email text
);
create table public.room_types (
  name text not null,
  created_at timestamp with time zone default now() not null,
  created_by uuid
);
create table public.rooms (
  id text default gen_random_uuid() not null,
  building_id text,
  name text not null,
  room_number text not null,
  type text default 'Classroom'::text not null,
  floor text default 'Ground'::text,
  room_size_sqft numeric default 0,
  is_reservable boolean default true,
  qr_code_key text not null,
  status text default 'Available'::text not null,
  current_occupant text,
  last_printed_at text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table public.service_requests (
  id text default gen_random_uuid() not null,
  ticket_id text not null,
  title text not null,
  description text,
  priority text default 'Medium'::text,
  type text default 'Corrective'::text,
  room_id text,
  asset_id text,
  status text default 'Open'::text,
  requested_by_name text not null,
  requested_by_email text,
  requested_by_phone text,
  sla_due_date text,
  resolution_notes text,
  created_at text not null,
  assigned_to text,
  assigned_to_name text,
  work_order_number text,
  work_order_id text,
  work_order_type text,
  dismissal_reason text,
  dismissed_at timestamp with time zone,
  dismissed_by text,
  photo_urls text[] default '{}'::text[],
  requested_by_user_id uuid,
  push_queued_at timestamp with time zone default now(),
  push_sent_at timestamp with time zone,
  requested_by_role text,
  sla_hours integer
);
create table public.sla_settings (
  priority text not null,
  hours integer not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid
);
create table public.sub_categories (
  id text default gen_random_uuid() not null,
  category_id text,
  name text not null,
  code text not null,
  description text,
  sla_priority text default 'Medium'::text,
  metadata_fields jsonb default '[]'::jsonb,
  pm_template_ids text[] default '{}'::text[],
  inspection_template_ids text[] default '{}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create table public.vendors (
  id text default gen_random_uuid() not null,
  name text not null,
  category_supplied text,
  contact_person text,
  email text,
  phone text,
  address text,
  has_amc boolean default false,
  amc_contract_no text,
  amc_start_date text,
  amc_end_date text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  code text
);
create table public.work_orders (
  id text default gen_random_uuid() not null,
  wo_number text not null,
  type text not null,
  title text not null,
  asset_id text,
  room_id text,
  priority text default 'Medium'::text,
  source text default 'Scheduled'::text,
  source_ref_id text,
  frequency text,
  due_date text not null,
  assigned_technician_id text,
  assigned_technician_name text,
  status text default 'Scheduled'::text,
  issue_logged text,
  checklist_template_id text,
  checklist_snapshot jsonb default '[]'::jsonb,
  checklist_responses jsonb default '{}'::jsonb,
  technician_remarks text,
  solution_taken text,
  executed_by text default 'In House'::text,
  completion_photo_url text,
  completed_at text,
  created_at text not null,
  start_photo_url text,
  parts_replaced jsonb,
  vendor_id text,
  vendor_ticket_no text,
  vendor_tech_name text,
  vendor_tech_phone text,
  vendor_service_date text,
  vendor_job_sheet_url text,
  vendor_remarks text,
  vendor_cost numeric,
  instructions text,
  diagnosis text
);

-- ---------------------------------------------------------------------------
-- Keys and checks
-- ---------------------------------------------------------------------------
alter table public.asset_activity_logs add constraint asset_activity_logs_pkey PRIMARY KEY (id);
alter table public.assets add constraint assets_asset_id_key UNIQUE (asset_id);
alter table public.assets add constraint assets_maintenance_by_check CHECK ((maintenance_by = ANY (ARRAY['In House'::text, 'Vendor'::text])));
alter table public.assets add constraint assets_pkey PRIMARY KEY (id);
alter table public.assets add constraint assets_sla_priority_check CHECK (((sla_priority IS NULL) OR (sla_priority = ANY (ARRAY['Critical'::text, 'High'::text, 'Medium'::text, 'Low'::text]))));
alter table public.assets add constraint assets_status_check CHECK ((status = ANY (ARRAY['Operational'::text, 'Under Maintenance'::text, 'In Storage'::text, 'Retired'::text])));
alter table public.buildings add constraint buildings_code_key UNIQUE (code);
alter table public.buildings add constraint buildings_pkey PRIMARY KEY (id);
alter table public.campuses add constraint campuses_code_key UNIQUE (code);
alter table public.campuses add constraint campuses_pkey PRIMARY KEY (id);
alter table public.categories add constraint categories_code_key UNIQUE (code);
alter table public.categories add constraint categories_pkey PRIMARY KEY (id);
alter table public.checklist_templates add constraint checklist_templates_interval_check CHECK (("interval" = ANY (ARRAY['Weekly'::text, 'Monthly'::text, 'Quarterly'::text, 'Half-Yearly'::text, 'Annually'::text])));
alter table public.checklist_templates add constraint checklist_templates_pkey PRIMARY KEY (id);
alter table public.checklist_templates add constraint checklist_templates_type_check CHECK ((type = ANY (ARRAY['Preventive Maintenance'::text, 'Inspection'::text])));
alter table public.departments add constraint departments_code_key UNIQUE (code);
alter table public.departments add constraint departments_pkey PRIMARY KEY (id);
alter table public.documents add constraint documents_pkey PRIMARY KEY (id);
alter table public.inspections add constraint inspections_inspection_number_key UNIQUE (inspection_number);
alter table public.inspections add constraint inspections_pkey PRIMARY KEY (id);
alter table public.inspections add constraint inspections_result_check CHECK ((result = ANY (ARRAY['Pass'::text, 'Fail'::text])));
alter table public.inspections add constraint inspections_status_check CHECK ((status = ANY (ARRAY['Scheduled'::text, 'In Progress'::text, 'Completed'::text, 'Overdue'::text])));
alter table public.inventory_items add constraint inventory_items_inventory_number_key UNIQUE (inventory_number);
alter table public.inventory_items add constraint inventory_items_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table public.notifications add constraint notifications_type_check CHECK ((type = ANY (ARRAY['wo_assigned'::text, 'inspection_assigned'::text, 'auto_checkout'::text, 'vendor_handover'::text, 'outside_repair_sent'::text, 'outside_repair_overdue'::text, 'request_resolved'::text, 'request_escalated'::text, 'request_closed'::text, 'due_today'::text])));
alter table public.outside_repairs add constraint outside_repairs_actual_cost_check CHECK (((actual_cost IS NULL) OR (actual_cost >= (0)::numeric)));
alter table public.outside_repairs add constraint outside_repairs_component_named CHECK (((scope <> 'Component'::text) OR (COALESCE(btrim(component_name), ''::text) <> ''::text)));
alter table public.outside_repairs add constraint outside_repairs_estimated_cost_check CHECK (((estimated_cost IS NULL) OR (estimated_cost >= (0)::numeric)));
alter table public.outside_repairs add constraint outside_repairs_etd_not_before_sent CHECK ((expected_return_date >= sent_date));
alter table public.outside_repairs add constraint outside_repairs_outcome_check CHECK (((outcome IS NULL) OR (outcome = ANY (ARRAY['Repaired'::text, 'Replaced by vendor'::text, 'Not repairable'::text]))));
alter table public.outside_repairs add constraint outside_repairs_pkey PRIMARY KEY (id);
alter table public.outside_repairs add constraint outside_repairs_repair_number_key UNIQUE (repair_number);
alter table public.outside_repairs add constraint outside_repairs_return_complete CHECK (((status <> 'Returned'::text) OR ((returned_date IS NOT NULL) AND (outcome IS NOT NULL))));
alter table public.outside_repairs add constraint outside_repairs_return_not_before_sent CHECK (((returned_date IS NULL) OR (returned_date >= sent_date)));
alter table public.outside_repairs add constraint outside_repairs_scope_check CHECK ((scope = ANY (ARRAY['Component'::text, 'Complete Asset'::text])));
alter table public.outside_repairs add constraint outside_repairs_sent_by_check CHECK ((sent_by = ANY (ARRAY['Technician'::text, 'Vendor'::text])));
alter table public.outside_repairs add constraint outside_repairs_status_check CHECK ((status = ANY (ARRAY['Out for Repair'::text, 'Returned'::text])));
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['Admin'::text, 'Technician'::text, 'Faculty'::text, 'Housekeeping'::text, 'Guest'::text])));
alter table public.push_config add constraint push_config_id_check CHECK (id);
alter table public.push_config add constraint push_config_pkey PRIMARY KEY (id);
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);
alter table public.reservations add constraint reservations_pkey PRIMARY KEY (id);
alter table public.reservations add constraint reservations_reservation_number_key UNIQUE (reservation_number);
alter table public.reservations add constraint reservations_status_check CHECK ((status = ANY (ARRAY['Confirmed'::text, 'Completed'::text, 'Cancelled'::text])));
alter table public.room_access_logs add constraint room_access_logs_activity_number_key UNIQUE (activity_number);
alter table public.room_access_logs add constraint room_access_logs_pkey PRIMARY KEY (id);
alter table public.room_types add constraint room_types_name_check CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60)));
alter table public.room_types add constraint room_types_pkey PRIMARY KEY (name);
alter table public.rooms add constraint rooms_pkey PRIMARY KEY (id);
alter table public.rooms add constraint rooms_qr_code_key_key UNIQUE (qr_code_key);
alter table public.rooms add constraint rooms_room_number_key UNIQUE (room_number);
alter table public.rooms add constraint rooms_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Occupied'::text, 'Under Maintenance'::text])));
alter table public.service_requests add constraint service_requests_pkey PRIMARY KEY (id);
alter table public.service_requests add constraint service_requests_priority_check CHECK ((priority = ANY (ARRAY['Critical'::text, 'High'::text, 'Medium'::text, 'Low'::text])));
alter table public.service_requests add constraint service_requests_status_check CHECK ((status = ANY (ARRAY['Open'::text, 'In Progress'::text, 'Resolved'::text, 'Closed'::text, 'Escalated'::text])));
alter table public.service_requests add constraint service_requests_ticket_id_key UNIQUE (ticket_id);
alter table public.service_requests add constraint service_requests_type_check CHECK ((type = ANY (ARRAY['Corrective'::text, 'Housekeeping'::text, 'Inquiry'::text, 'Maintenance'::text, 'Cleaning'::text, 'IT Support'::text, 'General'::text])));
alter table public.sla_settings add constraint sla_settings_hours_check CHECK (((hours >= 1) AND (hours <= 720)));
alter table public.sla_settings add constraint sla_settings_pkey PRIMARY KEY (priority);
alter table public.sla_settings add constraint sla_settings_priority_check CHECK ((priority = ANY (ARRAY['Critical'::text, 'High'::text, 'Medium'::text, 'Low'::text])));
alter table public.sub_categories add constraint sub_categories_code_key UNIQUE (code);
alter table public.sub_categories add constraint sub_categories_pkey PRIMARY KEY (id);
alter table public.sub_categories add constraint sub_categories_sla_priority_check CHECK ((sla_priority = ANY (ARRAY['Critical'::text, 'High'::text, 'Medium'::text, 'Low'::text])));
alter table public.vendors add constraint vendors_code_key UNIQUE (code);
alter table public.vendors add constraint vendors_pkey PRIMARY KEY (id);
alter table public.work_orders add constraint work_orders_pkey PRIMARY KEY (id);
alter table public.work_orders add constraint work_orders_priority_check CHECK ((priority = ANY (ARRAY['Critical'::text, 'High'::text, 'Medium'::text, 'Low'::text])));
alter table public.work_orders add constraint work_orders_status_check CHECK ((status = ANY (ARRAY['Scheduled'::text, 'In Progress'::text, 'Completed'::text, 'Cancelled'::text, 'On Hold'::text])));
alter table public.work_orders add constraint work_orders_type_check CHECK ((type = ANY (ARRAY['Preventive'::text, 'Corrective'::text, 'Housekeeping'::text])));
alter table public.work_orders add constraint work_orders_wo_number_key UNIQUE (wo_number);

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------
alter table public.asset_activity_logs add constraint asset_activity_logs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
alter table public.assets add constraint assets_maintenance_vendor_id_fkey FOREIGN KEY (maintenance_vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;
alter table public.assets add constraint assets_purchase_vendor_id_fkey FOREIGN KEY (purchase_vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;
alter table public.assets add constraint assets_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;
alter table public.assets add constraint assets_sub_category_id_fkey FOREIGN KEY (sub_category_id) REFERENCES public.sub_categories(id) ON DELETE SET NULL;
alter table public.buildings add constraint buildings_campus_id_fkey FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE CASCADE;
alter table public.departments add constraint departments_head_user_id_fkey FOREIGN KEY (head_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
alter table public.documents add constraint documents_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
alter table public.documents add constraint documents_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;
alter table public.inspections add constraint inspections_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;
alter table public.inventory_items add constraint inventory_items_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;
alter table public.inventory_items add constraint inventory_items_sub_category_id_fkey FOREIGN KEY (sub_category_id) REFERENCES public.sub_categories(id) ON DELETE SET NULL;
alter table public.inventory_items add constraint inventory_items_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;
alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.outside_repairs add constraint outside_repairs_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;
alter table public.outside_repairs add constraint outside_repairs_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE SET NULL;
alter table public.outside_repairs add constraint outside_repairs_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
alter table public.reservations add constraint reservations_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;
alter table public.room_access_logs add constraint room_access_logs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;
alter table public.rooms add constraint rooms_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;
alter table public.service_requests add constraint service_requests_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;
alter table public.service_requests add constraint service_requests_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES auth.users(id);
alter table public.service_requests add constraint service_requests_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;
alter table public.sub_categories add constraint sub_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;
alter table public.work_orders add constraint work_orders_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;
alter table public.work_orders add constraint work_orders_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX outside_repairs_asset_idx ON public.outside_repairs USING btree (asset_id);
CREATE INDEX outside_repairs_open_idx ON public.outside_repairs USING btree (expected_return_date) WHERE (status = 'Out for Repair'::text);
CREATE INDEX outside_repairs_vendor_idx ON public.outside_repairs USING btree (vendor_id);
CREATE INDEX outside_repairs_work_order_idx ON public.outside_repairs USING btree (work_order_id);
CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email) WHERE (role <> 'Guest'::text);
CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions USING btree (user_id);
CREATE UNIQUE INDEX room_types_name_lower_key ON public.room_types USING btree (lower(name));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
-- add_field_vendor (from 0052_field_feedback.sql)
create or replace function public.add_field_vendor(p_name text, p_phone text, p_contact_person text, p_category text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  if coalesce(public.current_user_role(), '') not in ('Technician', 'Admin') then
    raise exception 'Only technicians can add a vendor from the field app';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Enter the vendor''s name';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Enter the vendor''s phone number';
  end if;
  insert into public.vendors (name, phone, contact_person, category_supplied, has_amc)
  values (trim(p_name), trim(p_phone), nullif(trim(p_contact_person), ''), nullif(trim(p_category), ''), false)
  returning id into v_id;
  return v_id;
end;
$$;

-- apply_invited_role (from 0048_role_never_self_chosen.sql)
create or replace function public.apply_invited_role()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_asked text := new.raw_user_meta_data->>'role';
begin
  if old.invited_at is null
     and new.invited_at is not null
     and v_asked in ('Admin', 'Faculty', 'Technician', 'Housekeeping') then
    update public.profiles set role = v_asked where id = new.id;
  end if;
  return null;
end;
$$;

-- block_completion_with_open_outside_repairs (from 0043_outside_repairs.sql)
create or replace function public.block_completion_with_open_outside_repairs()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_open text;
begin
  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    select string_agg(repair_number, ', ' order by repair_number) into v_open
    from public.outside_repairs
    where work_order_id = new.id and status = 'Out for Repair';
    if v_open is not null then
      raise exception 'This work order cannot be completed: % is still out for repair. Record its return first.', v_open;
    end if;
  end if;
  return new;
end;
$function$;

-- current_user_role (from 0029_profiles_room_access_logs_read_scoping.sql)
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- end_schedules_of_retired_asset (from 0053_asset_schedules.sql)
create or replace function public.end_schedules_of_retired_asset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gone text[];
begin
  if new.status = 'Retired' and old.status is distinct from 'Retired' then
    update public.work_orders set status = 'Cancelled'
      where asset_id = new.id and type = 'Preventive' and status = 'Scheduled';

    with gone as (
      delete from public.inspections
      where asset_id = new.id and coalesce(status, 'Scheduled') in ('Scheduled', 'Overdue')
      returning id
    )
    select array_agg(id) into v_gone from gone;
    if v_gone is not null then
      delete from public.notifications where ref_id = any (v_gone);
    end if;
  end if;
  return null;
end;
$$;

-- guard_room_types (from 0056_room_types.sql)
create or replace function public.guard_room_types()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.name := btrim(new.name);
    new.created_by := auth.uid();
    new.created_at := now();
    return new;
  end if;
  if exists (select 1 from public.rooms r where lower(btrim(r.type)) = lower(old.name)) then
    raise exception 'Rooms still use "%". Change those rooms'' type first.', old.name;
  end if;
  return old;
end;
$$;

-- inspection_follow_ups (from 0053_asset_schedules.sql)
create or replace function public.inspection_follow_ups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_every text;
  v_items jsonb;
  v_id text;
begin
  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    select t.interval, t.items into v_every, v_items from public.checklist_templates t where t.id = new.template_id;

    -- The next inspection, counted from this one's due date (none for a
    -- retired asset).
    if not exists (select 1 from public.assets a where a.id = new.asset_id and a.status = 'Retired') then
      insert into public.inspections (
        id, inspection_number, asset_id, template_id, template_version, due_date, status, checklist_snapshot, created_at
      ) values (
        gen_random_uuid()::text, 'PENDING', new.asset_id, new.template_id, coalesce(new.template_version, 1),
        to_char(public.next_schedule_date(coalesce(public.parse_stored_date(new.due_date), public.parse_stored_date(new.conducted_at), v_today), coalesce(v_every, 'Quarterly')), 'YYYY-MM-DD'),
        'Scheduled',
        case when jsonb_array_length(coalesce(new.checklist_snapshot, '[]'::jsonb)) > 0 then new.checklist_snapshot else coalesce(v_items, '[]'::jsonb) end,
        to_char(v_today, 'YYYY-MM-DD')
      );
    end if;

    if new.result = 'Fail' then
      -- A failure raises a corrective job for the maintenance team. It waits,
      -- unnumbered, for an Admin to assign a technician (which is also when
      -- the asset goes Under Maintenance).
      v_id := gen_random_uuid()::text;
      insert into public.work_orders (
        id, wo_number, title, type, asset_id, priority, source, source_ref_id, due_date, status, issue_logged, created_at
      ) values (
        v_id, 'PENDING-' || v_id, 'Corrective: Defect from ' || new.inspection_number, 'Corrective', new.asset_id, 'Medium',
        'Failed Inspection', new.inspection_number, to_char(v_today + 2, 'YYYY-MM-DD'), 'Scheduled',
        'Failed inspection item during inspection: ' || coalesce(new.remarks, ''), to_char(v_today, 'YYYY-MM-DD')
      );
    elsif new.result = 'Pass' and new.asset_id is not null then
      update public.assets set status = 'Operational'
        where id = new.asset_id and coalesce(status, '') not in ('Retired', 'In Storage');
    end if;
  end if;

  return null;
end;
$$;

-- is_admin (from 0004_role_scoped_rls_and_notifications.sql)
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Admin'
  );
$$;

-- is_push_endpoint (from 0044_web_push.sql)
create or replace function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)/'
     and length(p_endpoint) <= 1000
$$;

-- is_staff (from 0054_guest_scope_and_rate_limits.sql)
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role(), 'Guest') <> 'Guest'
$$;

-- keep_templates_in_use (from 0053_asset_schedules.sql)
create or replace function public.keep_templates_in_use()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.work_orders w
    where w.checklist_template_id = old.id and coalesce(w.status, 'Scheduled') not in ('Completed', 'Cancelled')
  ) or exists (
    select 1 from public.inspections i
    where i.template_id = old.id and coalesce(i.status, 'Scheduled') <> 'Completed'
  ) then
    raise exception '"%" is used by scheduled jobs and can''t be deleted', old.title;
  end if;
  return old;
end;
$$;

-- limit_service_requests (from 0054_guest_scope_and_rate_limits.sql)
create or replace function public.limit_service_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(public.current_user_role(), 'Guest');
  v_cap int := case when v_role = 'Guest' then 5 else 30 end;
  v_since text := to_char((now() at time zone 'utc') - interval '1 hour', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_count int;
begin
  -- The server's clock, not the browser's.
  new.created_at := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  if auth.uid() is null or v_role = 'Admin' then
    return new;
  end if;

  select count(*) into v_count
  from public.service_requests s
  where s.requested_by_user_id::text = auth.uid()::text and s.created_at >= v_since;

  if v_count >= v_cap then
    raise exception 'You have raised % requests in the last hour. Please wait a while before raising another.', v_count
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- mint_work_order_number (from 0021_numbering_ist_year.sql)
create or replace function public.mint_work_order_number()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if old.wo_number like 'PENDING-%'
     and new.assigned_technician_id is not null
     and new.type in ('Preventive', 'Corrective') then
    new.wo_number := (case when new.type = 'Preventive' then 'WO-PM-' else 'WO-CR-' end) ||
      extract(year from now() at time zone 'Asia/Kolkata')::text || '-' ||
      lpad(nextval(
        (case when new.type = 'Preventive'
          then 'public.work_orders_pm_seq'
          else 'public.work_orders_cr_seq'
        end)::regclass
      )::text, 4, '0');
  end if;
  return new;
end;
$$;

-- next_schedule_date (from 0050_completion_follow_ups.sql)
create or replace function public.next_schedule_date(base date, every text)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(every, '')) like '%week%' then base + 7
    when lower(coalesce(every, '')) like '%half%' then (base + interval '6 months')::date
    when lower(coalesce(every, '')) like '%month%' then (base + interval '1 month')::date
    when lower(coalesce(every, '')) like '%quat%' or lower(coalesce(every, '')) like '%quarter%' then (base + interval '3 months')::date
    when lower(coalesce(every, '')) like '%annual%' or lower(coalesce(every, '')) like '%year%' then (base + interval '1 year')::date
    else (base + interval '3 months')::date
  end
$$;

-- notify_auto_checkout (from 0004_role_scoped_rls_and_notifications.sql)
create or replace function public.notify_auto_checkout()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.is_force_checkout is true
     and new.user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (old.is_force_checkout is distinct from new.is_force_checkout) then
    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    values (
      new.user_id::uuid,
      'auto_checkout',
      'Automatically checked out',
      coalesce(new.auto_checkout_note, 'You were checked out of ' || new.room_id || ' at end of day.'),
      'room_access_logs',
      new.id
    );
  end if;
  return new;
end;
$$;

-- notify_due_today (from 0051_requester_updates_and_due_today.sql)
create or replace function public.notify_due_today()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today text := to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD');
  v_since timestamptz := ((now() at time zone 'Asia/Kolkata')::date)::timestamp at time zone 'Asia/Kolkata';
  r record;
begin
  for r in
    with due as (
      select w.assigned_technician_id as uid, 'work_orders' as tbl, w.id, w.wo_number as num,
             coalesce(a.name, w.title) as what, 1 as is_pm, 0 as is_insp
      from public.work_orders w
      left join public.assets a on a.id = w.asset_id
      where w.type = 'Preventive' and w.due_date = v_today
        and coalesce(w.status, '') not in ('Completed', 'Cancelled')
        and w.assigned_technician_id is not null
      union all
      select i.conducted_by_user_id, 'inspections', i.id, i.inspection_number,
             coalesce(a.name, 'Inspection'), 0, 1
      from public.inspections i
      left join public.assets a on a.id = i.asset_id
      where i.due_date = v_today and coalesce(i.status, '') <> 'Completed'
        and i.conducted_by_user_id is not null
    )
    select d.uid,
           sum(d.is_pm) as pms,
           sum(d.is_insp) as insps,
           count(*) as total,
           string_agg(d.num || ' ' || d.what, '; ' order by d.num) as items,
           min(d.tbl) as one_tbl,
           min(d.id) as one_id
    from due d
    join public.profiles p on p.id::text = d.uid
    where not exists (
      select 1 from public.notifications n
      where n.user_id = p.id and n.type = 'due_today' and n.created_at >= v_since
    )
    group by d.uid
  loop
    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    values (
      r.uid::uuid,
      'due_today',
      'Due today: ' || concat_ws(', ',
        case when r.pms = 1 then '1 preventive job' when r.pms > 1 then r.pms || ' preventive jobs' end,
        case when r.insps = 1 then '1 inspection' when r.insps > 1 then r.insps || ' inspections' end),
      left(r.items, 300),
      case when r.total = 1 then r.one_tbl end,
      case when r.total = 1 then r.one_id end
    );
  end loop;
end;
$$;

-- notify_inspection_assignment (from 0004_role_scoped_rls_and_notifications.sql)
create or replace function public.notify_inspection_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.conducted_by_user_id is not null
     and new.conducted_by_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (tg_op = 'INSERT' or new.conducted_by_user_id is distinct from old.conducted_by_user_id)
     and new.status <> 'Completed' then
    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    values (
      new.conducted_by_user_id::uuid,
      'inspection_assigned',
      'Inspection assigned: ' || new.inspection_number,
      'Due ' || new.due_date,
      'inspections',
      new.id
    );
  end if;
  return new;
end;
$$;

-- notify_outside_repair_sent (from 0043_outside_repairs.sql)
create or replace function public.notify_outside_repair_sent()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
  select p.id, 'outside_repair_sent', 'Sent for outside repair: ' || new.repair_number,
         public.outside_repair_summary(new), 'outside_repairs', new.id
  from public.profiles p
  where p.role = 'Admin' and p.id is distinct from auth.uid();
  return new;
end;
$function$;

-- notify_overdue_outside_repairs (from 0043_outside_repairs.sql)
create or replace function public.notify_overdue_outside_repairs()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r public.outside_repairs;
  v_tech text;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  for r in
    select * from public.outside_repairs
    where status = 'Out for Repair'
      and expected_return_date < v_today
      and overdue_notified_at is null
  loop
    select assigned_technician_id into v_tech from public.work_orders where id = r.work_order_id;

    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    select p.id, 'outside_repair_overdue', 'Overdue return: ' || r.repair_number,
           public.outside_repair_summary(r), 'outside_repairs', r.id
    from public.profiles p
    where p.role = 'Admin' or p.id::text = v_tech;

    update public.outside_repairs set overdue_notified_at = now() where id = r.id;
  end loop;
end;
$function$;

-- notify_requester (from 0051_requester_updates_and_due_today.sql)
create or replace function public.notify_requester()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_title text;
  v_body text;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'Resolved' then
    v_type := 'request_resolved';
    v_title := 'Resolved: ' || new.ticket_id;
    v_body := new.title || ' — ' || coalesce(nullif(new.resolution_notes, ''), 'The facilities team has marked it fixed.');
  elsif new.status = 'Escalated' then
    v_type := 'request_escalated';
    v_title := 'Escalated: ' || new.ticket_id;
    v_body := new.title || ' — raised to a supervisor for urgent attention.';
  elsif new.status = 'Closed' and old.status is distinct from 'Resolved' then
    -- Closed straight away (not after being resolved): usually dismissed.
    v_type := 'request_closed';
    v_title := 'Closed: ' || new.ticket_id;
    v_body := new.title || coalesce(' — ' || nullif(coalesce(new.dismissal_reason, new.resolution_notes), ''), '');
  else
    return null;
  end if;

  -- The person who raised it -- and, for a guest, their later visits too (a
  -- returning guest signs in as a new account each time, matched by email).
  -- Not whoever made this change: nobody is told what they just did.
  insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
  select p.id, v_type, v_title, v_body, 'service_requests', new.id
  from public.profiles p
  where (p.id = new.requested_by_user_id
         or (p.role = 'Guest' and new.requested_by_email is not null and lower(p.email) = lower(new.requested_by_email)))
    and p.id is distinct from auth.uid();

  return null;
end;
$$;

-- notify_vendor_handover (from 0039_vendor_handover_notification.sql)
create or replace function public.notify_vendor_handover()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_vendor_name text;
begin
  if new.executed_by = 'Vendor'
     and new.status not in ('Completed', 'Cancelled')
     and (tg_op = 'INSERT' or old.executed_by is distinct from 'Vendor') then

    select name into v_vendor_name from public.vendors where id = new.vendor_id;

    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    select p.id,
           'vendor_handover',
           'Handed to vendor: ' || new.wo_number,
           coalesce(v_vendor_name, 'Vendor not selected yet') || ' - ' || coalesce(new.title, new.type || ' work order'),
           'work_orders',
           new.id
    from public.profiles p
    where p.role = 'Admin'
      and p.id is distinct from auth.uid();
  end if;
  return new;
end;
$function$;

-- notify_work_order_assignment (from 0004_role_scoped_rls_and_notifications.sql)
create or replace function public.notify_work_order_assignment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Only real Supabase Auth users (real uuids) can receive a notification.
  -- assigned_technician_id can hold a non-uuid legacy/local-only id (e.g. an
  -- admin-created user never provisioned in Supabase Auth) — skip those
  -- rather than raising and blocking the work order write.
  if new.assigned_technician_id is not null
     and new.assigned_technician_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (tg_op = 'INSERT' or new.assigned_technician_id is distinct from old.assigned_technician_id) then
    insert into public.notifications (user_id, type, title, body, ref_table, ref_id)
    values (
      new.assigned_technician_id::uuid,
      'wo_assigned',
      'Work order assigned: ' || new.wo_number,
      coalesce(new.title, new.type || ' work order'),
      'work_orders',
      new.id
    );
  end if;
  return new;
end;
$$;

-- outside_repair_summary (from 0043_outside_repairs.sql)
create or replace function public.outside_repair_summary(r public.outside_repairs)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    (case when r.scope = 'Component' then r.component_name || ' of ' else '' end)
    || coalesce((select name from public.assets where id = r.asset_id), 'asset')
    || ' → ' || coalesce((select name from public.vendors where id = r.vendor_id), 'vendor not named')
    || ' · back by ' || to_char(r.expected_return_date, 'DD-MM-YYYY')
    || coalesce(' (' || (select wo_number from public.work_orders where id = r.work_order_id
                         and wo_number not like 'PENDING-%') || ')', '')
$function$;

-- outside_repairs_before_insert (from 0043_outside_repairs.sql)
create or replace function public.outside_repairs_before_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_type text;
  v_status text;
  v_asset text;
begin
  select type, status, asset_id into v_type, v_status, v_asset
  from public.work_orders where id = new.work_order_id;

  if v_type is distinct from 'Corrective' then
    raise exception 'Only a corrective work order can send something outside for repair.';
  end if;
  if v_status in ('Completed', 'Cancelled') then
    raise exception 'This work order is already %; nothing more can be sent out on it.', lower(v_status);
  end if;

  new.repair_number := 'OSR-' || extract(year from (now() at time zone 'Asia/Kolkata'))::text || '-' ||
    lpad(nextval('public.outside_repairs_seq')::text, 4, '0');
  new.asset_id := coalesce(new.asset_id, v_asset);
  new.status := 'Out for Repair';
  new.overdue_notified_at := null;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$function$;

-- outside_repairs_before_update (from 0043_outside_repairs.sql)
create or replace function public.outside_repairs_before_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.repair_number := old.repair_number;
  new.work_order_id := old.work_order_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  if new.expected_return_date is distinct from old.expected_return_date then
    new.overdue_notified_at := null;
  end if;
  return new;
end;
$function$;

-- parse_stored_date (from 0050_completion_follow_ups.sql)
create or replace function public.parse_stored_date(v text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v ~ '^\d{4}-\d{2}-\d{2}' then return left(v, 10)::date; end if;
  if v ~ '^\d{2}-\d{2}-\d{4}' then return to_date(left(v, 10), 'DD-MM-YYYY'); end if;
  return null;
exception when others then
  return null;
end;
$$;

-- prevent_self_role_change (from 0028_prevent_self_role_change.sql)
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an Admin can change a user''s role.';
  end if;
  return new;
end;
$$;

-- push_new_notification (from 0044_web_push.sql)
create or replace function public.push_new_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    perform public.queue_push('notification', new.id::text);
  end if;
  return null;
end;
$$;

-- push_new_service_request (from 0046_no_push_for_e2e.sql)
create or replace function public.push_new_service_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.title like '[E2E]%' then
    return null;
  end if;
  if exists (
    select 1
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id
    where p.role = 'Admin'
      and s.user_id is distinct from new.requested_by_user_id
  ) then
    perform public.queue_push('service_request', new.id);
  end if;
  return null;
end;
$$;

-- qr_target_label (from 0054_guest_scope_and_rate_limits.sql)
create or replace function public.qr_target_label(p_type text, p_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'room' then (select r.name || coalesce(' (' || nullif(r.room_number, '') || ')', '') from public.rooms r where r.id = p_id)
    when 'asset' then (select a.name || coalesce(' (' || nullif(a.asset_id, '') || ')', '') from public.assets a where a.id = p_id)
  end
$$;

-- run_auto_checkouts (from 0018_room_check_out_timestamp.sql)
create or replace function public.run_auto_checkouts()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  freed_room_ids text[];
begin
  with closed as (
    update public.room_access_logs
    set
      check_out_time = to_char(now() at time zone 'Asia/Kolkata', 'HH12:MI AM'),
      check_out_timestamp = (extract(epoch from now()) * 1000)::bigint,
      is_force_checkout = true,
      auto_checkout_note = 'System Auto Check-Out at 11:59 PM (End of Day Cutoff)'
    where check_out_time is null
      and date(to_timestamp(check_in_timestamp / 1000.0) at time zone 'Asia/Kolkata')
          <= (now() at time zone 'Asia/Kolkata')::date
    returning room_id
  )
  select array_agg(distinct room_id) into freed_room_ids from closed;

  if freed_room_ids is not null then
    update public.rooms
    set status = 'Available', current_occupant = null
    where id = any(freed_room_ids);
  end if;
end;
$$;

-- schedule_asset_maintenance (from 0053_asset_schedules.sql)
create or replace function public.schedule_asset_maintenance(
  p_asset_ids text[],
  p_template_id text,
  p_mode text,
  p_first_due date default null
)
returns table (asset_id text, due_date text, status text, reason text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_latest date := ((now() at time zone 'Asia/Kolkata')::date + interval '2 years')::date;
  v_t record;
  v_a record;
  v_aid text;
  v_install date;
  v_due date;
  v_id text;
  v_why text;
begin
  if coalesce(public.current_user_role(), '') <> 'Admin' then
    raise exception 'Only an Admin can schedule PM or inspections';
  end if;
  if coalesce(p_mode, '') not in ('installation', 'today', 'date') then
    raise exception 'Choose how the first date is set';
  end if;
  if p_mode = 'date' and p_first_due is null then
    raise exception 'Pick the date of the first job';
  end if;

  select t.id, t.title, t.type, t.interval, t.items into v_t
  from public.checklist_templates t where t.id = p_template_id;
  if not found then
    raise exception 'That template no longer exists';
  end if;
  if v_t.type not in ('Preventive Maintenance', 'Inspection') then
    raise exception 'Only PM and inspection templates can be scheduled';
  end if;
  if coalesce(v_t.interval, '') = '' then
    raise exception 'Set how often "%" repeats before scheduling it', v_t.title;
  end if;
  if jsonb_typeof(v_t.items) is distinct from 'array' or jsonb_array_length(v_t.items) = 0 then
    raise exception 'Add checklist items to "%" before scheduling it', v_t.title;
  end if;
  if coalesce(array_length(p_asset_ids, 1), 0) > 500 then
    raise exception 'Schedule at most 500 assets at a time';
  end if;

  for v_aid in select distinct x from unnest(coalesce(p_asset_ids, '{}')) x where x is not null loop
    asset_id := v_aid;
    due_date := null;
    status := 'skipped';
    reason := null;

    -- One schedule per asset and template, even with two Admins at once.
    perform pg_advisory_xact_lock(hashtext('asset-schedule:' || v_aid || ':' || p_template_id));

    select a.id, a.status, a.room_id, a.installation_date into v_a from public.assets a where a.id = v_aid;
    if not found then
      reason := 'The asset no longer exists';
      return next;
      continue;
    end if;
    if v_a.status = 'Retired' then
      reason := 'The asset is retired';
      return next;
      continue;
    end if;

    if (v_t.type = 'Preventive Maintenance' and exists (
          select 1 from public.work_orders w
          where w.asset_id = v_aid and w.type = 'Preventive' and w.checklist_template_id = p_template_id
            and coalesce(w.status, 'Scheduled') not in ('Completed', 'Cancelled')))
       or (v_t.type = 'Inspection' and exists (
          select 1 from public.inspections i
          where i.asset_id = v_aid and i.template_id = p_template_id
            and coalesce(i.status, 'Scheduled') <> 'Completed')) then
      reason := 'Already scheduled';
      return next;
      continue;
    end if;

    v_install := public.parse_stored_date(v_a.installation_date);
    v_due := case p_mode
      when 'installation' then public.next_schedule_date(v_install, v_t.interval)
      when 'today' then public.next_schedule_date(v_today, v_t.interval)
      else p_first_due
    end;

    v_why := case
      when v_due is null then 'The asset has no installation date — pick a date or count from today'
      when v_due < v_today and p_mode = 'installation' then 'Installed too long ago — pick a date or count from today'
      when v_due < v_today then 'The first date can''t be in the past'
      when v_due > v_latest then 'The first date can''t be more than 2 years ahead'
      when v_install is not null and v_due < v_install then
        'The first date can''t be before the installation date (' || to_char(v_install, 'DD-MM-YYYY') || ')'
    end;
    if v_why is not null then
      reason := v_why;
      return next;
      continue;
    end if;

    if v_t.type = 'Preventive Maintenance' then
      -- Unnumbered until a technician is assigned (0014), like every PM job.
      v_id := gen_random_uuid()::text;
      insert into public.work_orders (
        id, wo_number, title, type, asset_id, room_id, priority, source, frequency, due_date, status,
        checklist_template_id, checklist_snapshot, created_at
      ) values (
        v_id, 'PENDING-' || v_id, v_t.title || ' (' || v_t.interval || ')', 'Preventive', v_aid, v_a.room_id,
        'Medium', 'Scheduled', v_t.interval, to_char(v_due, 'YYYY-MM-DD'), 'Scheduled',
        v_t.id, v_t.items, to_char(v_today, 'YYYY-MM-DD')
      );
    else
      -- The number is minted by trg_set_inspection_number.
      insert into public.inspections (
        id, inspection_number, asset_id, template_id, template_version, due_date, status, checklist_snapshot, created_at
      ) values (
        gen_random_uuid()::text, 'PENDING', v_aid, v_t.id, 1, to_char(v_due, 'YYYY-MM-DD'), 'Scheduled',
        v_t.items, to_char(v_today, 'YYYY-MM-DD')
      );
    end if;

    due_date := to_char(v_due, 'YYYY-MM-DD');
    status := 'scheduled';
    return next;
  end loop;
end;
$$;

-- set_asset_status (from 0023_set_asset_status_rpc.sql)
create or replace function public.set_asset_status(p_asset_id text, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_status not in ('Operational', 'Under Maintenance', 'In Storage', 'Retired') then
    raise exception 'Invalid asset status: %', p_status;
  end if;

  if not (
    public.is_admin()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'Technician')
  ) then
    raise exception 'Not authorized to change asset status';
  end if;

  update public.assets
  set status = p_status
  where id = p_asset_id;
end;
$$;

-- set_inspection_number (from 0021_numbering_ist_year.sql)
create or replace function public.set_inspection_number()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  new.inspection_number := 'INSP-' || extract(year from now() at time zone 'Asia/Kolkata')::text || '-' ||
    lpad(nextval('public.inspections_seq')::text, 4, '0');
  return new;
end;
$$;

-- set_requester_role (from 0052_field_feedback.sql)
create or replace function public.set_requester_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.requested_by_user_id is not null then
    new.requested_by_role := coalesce(
      (select p.role from public.profiles p where p.id = new.requested_by_user_id),
      new.requested_by_role
    );
  end if;
  return new;
end;
$$;

-- set_service_request_sla (from 0055_sla_settings.sql)
create or replace function public.set_service_request_sla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours integer;
begin
  select s.hours into v_hours from public.sla_settings s where s.priority = coalesce(new.priority, 'Medium');
  v_hours := coalesce(v_hours, 24);
  new.sla_hours := v_hours;
  -- From the server's clock, in the same text format as created_at.
  new.sla_due_date := to_char((now() at time zone 'utc') + make_interval(hours => v_hours), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  return new;
end;
$$;

-- set_service_request_ticket_id (from 0021_numbering_ist_year.sql)
create or replace function public.set_service_request_ticket_id()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  new.ticket_id := 'SR-' || extract(year from now() at time zone 'Asia/Kolkata')::text || '-' ||
    lpad(nextval('public.service_requests_ticket_seq')::text, 4, '0');
  return new;
end;
$$;

-- skip_duplicate_follow_up (from 0050_completion_follow_ups.sql)
create or replace function public.skip_duplicate_follow_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'work_orders' then
    if new.source = 'Failed Inspection' and new.source_ref_id is not null and exists (
      select 1 from public.work_orders w where w.source = 'Failed Inspection' and w.source_ref_id = new.source_ref_id
    ) then
      return null;
    end if;
    if new.type = 'Preventive' and coalesce(new.status, 'Scheduled') = 'Scheduled' and new.assigned_technician_id is null
      and new.asset_id is not null and exists (
        select 1 from public.work_orders w
        where w.type = 'Preventive' and w.asset_id = new.asset_id
          and coalesce(w.checklist_template_id, '') = coalesce(new.checklist_template_id, '')
          and w.due_date = new.due_date and coalesce(w.status, '') not in ('Completed', 'Cancelled')
      ) then
      return null;
    end if;
  elsif tg_table_name = 'inspections' then
    if coalesce(new.status, 'Scheduled') = 'Scheduled' and new.conducted_by_user_id is null and new.asset_id is not null and exists (
      select 1 from public.inspections i
      where i.asset_id = new.asset_id and coalesce(i.template_id, '') = coalesce(new.template_id, '')
        and i.due_date = new.due_date and coalesce(i.status, '') <> 'Completed'
    ) then
      return null;
    end if;
  end if;
  return new;
end;
$$;

-- stamp_sla_settings (from 0055_sla_settings.sql)
create or replace function public.stamp_sla_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- try_timestamptz (from 0055_sla_settings.sql)
create or replace function public.try_timestamptz(v text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  return v::timestamptz;
exception when others then
  return null;
end;
$$;

-- work_order_follow_ups (from 0053_asset_schedules.sql)
create or replace function public.work_order_follow_ups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_every text;
  v_done date;
  v_id text;
begin
  -- The asset's status follows the work on it (never a retired or stored one).
  if new.asset_id is not null then
    if new.status = 'Completed' and old.status is distinct from 'Completed' then
      update public.assets set status = 'Operational'
        where id = new.asset_id and coalesce(status, '') not in ('Retired', 'In Storage');
    elsif new.status = 'In Progress' and old.status is distinct from 'In Progress' then
      update public.assets set status = 'Under Maintenance'
        where id = new.asset_id and coalesce(status, '') not in ('Retired', 'In Storage');
    elsif new.type = 'Corrective' and new.status not in ('Completed', 'Cancelled')
      and old.wo_number like 'PENDING-%' and new.wo_number not like 'PENDING-%' then
      -- A breakdown's first assignment takes the asset out of service.
      update public.assets set status = 'Under Maintenance'
        where id = new.asset_id and coalesce(status, '') not in ('Retired', 'In Storage');
    end if;
  end if;

  -- A finished preventive job schedules the next one, counted from the day it
  -- was actually done (a late one must not push every later cycle back).
  -- Only a scheduled one (it has a frequency or a checklist template): a
  -- one-off preventive job is just that. Never for a retired asset.
  if new.type = 'Preventive' and new.status = 'Completed' and old.status is distinct from 'Completed'
    and (nullif(new.frequency, '') is not null or new.checklist_template_id is not null)
    and not exists (select 1 from public.assets a where a.id = new.asset_id and a.status = 'Retired') then
    v_every := coalesce(
      nullif(new.frequency, ''),
      (select t.interval from public.checklist_templates t where t.id = new.checklist_template_id),
      'Quarterly'
    );
    v_done := coalesce(public.parse_stored_date(new.completed_at), v_today);
    v_id := gen_random_uuid()::text;
    insert into public.work_orders (
      id, wo_number, title, type, asset_id, room_id, priority, source, frequency, due_date, status,
      checklist_template_id, checklist_snapshot, created_at
    ) values (
      v_id, 'PENDING-' || v_id, coalesce(nullif(new.title, ''), 'Preventive Maintenance (' || v_every || ')'), 'Preventive',
      new.asset_id, new.room_id, 'Medium', 'Scheduled', v_every,
      to_char(public.next_schedule_date(v_done, v_every), 'YYYY-MM-DD'), 'Scheduled',
      new.checklist_template_id, new.checklist_snapshot, to_char(v_done, 'YYYY-MM-DD')
    );
  end if;

  return null;
end;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_app_role text := new.raw_app_meta_data->>'role';
  v_role     text;
begin
  if coalesce(new.is_anonymous, false) then
    v_role := 'Guest';
  elsif v_app_role in ('Admin', 'Faculty', 'Technician', 'Housekeeping', 'Guest') then
    v_role := v_app_role;
  else
    v_role := 'Guest';
  end if;

  insert into public.profiles (id, email, full_name, role, department, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Staff Member'),
    v_role,
    coalesce(new.raw_user_meta_data->>'department', 'Facility Operations'),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.queue_push(p_kind text, p_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_url text;
begin
  select functions_url into v_url from public.push_config where id;
  if v_url is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/send-push',
    body := jsonb_build_object('kind', p_kind, 'id', p_id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'push not queued for % %: %', p_kind, p_id, sqlerrm;
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in to turn on alerts';
  end if;
  if not public.is_push_endpoint(p_endpoint) then
    raise exception 'This browser''s push service is not supported';
  end if;
  if p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'Invalid push subscription keys';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now(),
        failure_count = 0;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.room_check_in(p_id text, p_room_id text, p_activity_number text, p_purpose text, p_user_name text, p_user_role text, p_check_in_time text, p_check_in_date text, p_check_in_timestamp bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_guest_email text;
begin
  if p_user_role = 'Guest' then
    select email into v_guest_email from public.profiles where id = auth.uid();
  end if;

  insert into public.room_access_logs (
    id, activity_number, room_id, user_id, user_name, user_role,
    check_in_time, check_in_date, check_in_timestamp, purpose, is_force_checkout,
    guest_email
  ) values (
    p_id,
    'AL-A' || lpad(nextval('public.room_activity_seq')::text, 4, '0'),
    p_room_id, (auth.uid())::text, p_user_name, p_user_role,
    p_check_in_time, p_check_in_date, p_check_in_timestamp, p_purpose, false,
    v_guest_email
  );

  update public.rooms
  set status = 'Occupied', current_occupant = p_user_name
  where id = p_room_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.room_check_out(p_room_id text, p_check_out_time text, p_check_out_timestamp bigint, p_is_force_checkout boolean DEFAULT false, p_auto_checkout_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_role text;
  v_email text;
  v_remaining_occupant text;
begin
  select role, email into v_role, v_email from public.profiles where id = auth.uid();

  update public.room_access_logs
  set check_out_time = p_check_out_time,
      check_out_timestamp = p_check_out_timestamp,
      is_force_checkout = p_is_force_checkout,
      auto_checkout_note = p_auto_checkout_note
  where room_id = p_room_id
    and check_out_time is null
    and (
      user_id = (auth.uid())::text
      or (v_role = 'Guest' and v_email is not null and lower(guest_email) = lower(v_email))
    );

  select user_name into v_remaining_occupant
  from public.room_access_logs
  where room_id = p_room_id and check_out_time is null
  order by check_in_timestamp desc
  limit 1;

  if v_remaining_occupant is null then
    update public.rooms set status = 'Available', current_occupant = null where id = p_room_id;
  else
    update public.rooms set status = 'Occupied', current_occupant = v_remaining_occupant where id = p_room_id;
  end if;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_end_schedules_of_retired_asset AFTER UPDATE OF status ON public.assets FOR EACH ROW EXECUTE FUNCTION public.end_schedules_of_retired_asset();
CREATE TRIGGER trg_keep_templates_in_use BEFORE DELETE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.keep_templates_in_use();
CREATE TRIGGER trg_0_skip_duplicate_follow_up BEFORE INSERT ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.skip_duplicate_follow_up();
CREATE TRIGGER trg_inspection_follow_ups AFTER UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.inspection_follow_ups();
CREATE TRIGGER trg_notify_inspection_assignment AFTER INSERT OR UPDATE ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.notify_inspection_assignment();
CREATE TRIGGER trg_set_inspection_number BEFORE INSERT ON public.inspections FOR EACH ROW EXECUTE FUNCTION public.set_inspection_number();
CREATE TRIGGER notifications_push_after_insert AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.push_new_notification();
CREATE TRIGGER trg_notify_outside_repair_sent AFTER INSERT ON public.outside_repairs FOR EACH ROW EXECUTE FUNCTION public.notify_outside_repair_sent();
CREATE TRIGGER trg_outside_repairs_before_insert BEFORE INSERT ON public.outside_repairs FOR EACH ROW EXECUTE FUNCTION public.outside_repairs_before_insert();
CREATE TRIGGER trg_outside_repairs_before_update BEFORE UPDATE ON public.outside_repairs FOR EACH ROW EXECUTE FUNCTION public.outside_repairs_before_update();
CREATE TRIGGER trg_prevent_self_role_change BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();
CREATE TRIGGER trg_notify_auto_checkout AFTER UPDATE ON public.room_access_logs FOR EACH ROW EXECUTE FUNCTION public.notify_auto_checkout();
CREATE TRIGGER trg_guard_room_types BEFORE INSERT OR DELETE ON public.room_types FOR EACH ROW EXECUTE FUNCTION public.guard_room_types();
CREATE TRIGGER service_requests_push_after_insert AFTER INSERT ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.push_new_service_request();
CREATE TRIGGER trg_limit_service_requests BEFORE INSERT ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.limit_service_requests();
CREATE TRIGGER trg_notify_requester AFTER UPDATE OF status ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.notify_requester();
CREATE TRIGGER trg_set_requester_role BEFORE INSERT ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.set_requester_role();
CREATE TRIGGER trg_set_service_request_ticket_id BEFORE INSERT ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.set_service_request_ticket_id();
CREATE TRIGGER trg_sla_due_date BEFORE INSERT ON public.service_requests FOR EACH ROW EXECUTE FUNCTION public.set_service_request_sla();
CREATE TRIGGER trg_stamp_sla_settings BEFORE UPDATE ON public.sla_settings FOR EACH ROW EXECUTE FUNCTION public.stamp_sla_settings();
CREATE TRIGGER trg_0_skip_duplicate_follow_up BEFORE INSERT ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.skip_duplicate_follow_up();
CREATE TRIGGER trg_block_completion_with_open_outside_repairs BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.block_completion_with_open_outside_repairs();
CREATE TRIGGER trg_mint_work_order_number BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.mint_work_order_number();
CREATE TRIGGER trg_notify_vendor_handover AFTER INSERT OR UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.notify_vendor_handover();
CREATE TRIGGER trg_notify_work_order_assignment AFTER INSERT OR UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.notify_work_order_assignment();
CREATE TRIGGER trg_work_order_follow_ups AFTER UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.work_order_follow_ups();

-- New sign-ups get a profile; an invitation sets the invited role.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_invited AFTER UPDATE OF invited_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.apply_invited_role();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.asset_activity_logs enable row level security;
alter table public.assets enable row level security;
alter table public.buildings enable row level security;
alter table public.campuses enable row level security;
alter table public.categories enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.departments enable row level security;
alter table public.documents enable row level security;
alter table public.inspections enable row level security;
alter table public.inventory_items enable row level security;
alter table public.notifications enable row level security;
alter table public.outside_repairs enable row level security;
alter table public.profiles enable row level security;
alter table public.push_config enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reservations enable row level security;
alter table public.room_access_logs enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms enable row level security;
alter table public.service_requests enable row level security;
alter table public.sla_settings enable row level security;
alter table public.sub_categories enable row level security;
alter table public.vendors enable row level security;
alter table public.work_orders enable row level security;

create policy "Admin all on asset_activity_logs" on public.asset_activity_logs as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Authenticated insert asset_activity_logs" on public.asset_activity_logs as PERMISSIVE for INSERT to authenticated with check (true);
create policy "Staff read asset_activity_logs" on public.asset_activity_logs as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy "Admin all on assets" on public.assets as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Authenticated read assets" on public.assets as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admin all on buildings" on public.buildings as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Authenticated read buildings" on public.buildings as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admin all on campuses" on public.campuses as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Authenticated read campuses" on public.campuses as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admin all on categories" on public.categories as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Authenticated read categories" on public.categories as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admin all on checklist_templates" on public.checklist_templates as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Staff read checklist_templates" on public.checklist_templates as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy "Admin all on departments" on public.departments as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Staff read departments" on public.departments as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy "Admin all on documents" on public.documents as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Staff read documents" on public.documents as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy "Admin all on inspections" on public.inspections as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Assignee read own inspections" on public.inspections as PERMISSIVE for SELECT to authenticated using ((conducted_by_user_id = (( SELECT auth.uid() AS uid))::text));
create policy "Assignee update own inspections" on public.inspections as PERMISSIVE for UPDATE to authenticated using ((conducted_by_user_id = (( SELECT auth.uid() AS uid))::text)) with check ((conducted_by_user_id = (( SELECT auth.uid() AS uid))::text));
create policy "Admin all on inventory_items" on public.inventory_items as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Staff read inventory_items" on public.inventory_items as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy "Mark own notifications read" on public.notifications as PERMISSIVE for UPDATE to authenticated using ((user_id = ( SELECT auth.uid() AS uid))) with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Read own notifications" on public.notifications as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Admin all on outside_repairs" on public.outside_repairs as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Assignee insert outside_repairs" on public.outside_repairs as PERMISSIVE for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM work_orders w
  WHERE ((w.id = outside_repairs.work_order_id) AND (w.assigned_technician_id = (( SELECT auth.uid() AS uid))::text)))));
create policy "Assignee read outside_repairs" on public.outside_repairs as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM work_orders w
  WHERE ((w.id = outside_repairs.work_order_id) AND (w.assigned_technician_id = (( SELECT auth.uid() AS uid))::text)))));
create policy "Assignee update outside_repairs" on public.outside_repairs as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM work_orders w
  WHERE ((w.id = outside_repairs.work_order_id) AND (w.assigned_technician_id = (( SELECT auth.uid() AS uid))::text))))) with check ((EXISTS ( SELECT 1
   FROM work_orders w
  WHERE ((w.id = outside_repairs.work_order_id) AND (w.assigned_technician_id = (( SELECT auth.uid() AS uid))::text)))));
create policy "Allow user to update own profile" on public.profiles as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = id));
create policy "Staff read all profiles, guests read own" on public.profiles as PERMISSIVE for SELECT to authenticated using (((id = ( SELECT auth.uid() AS uid)) OR (( SELECT current_user_role() AS current_user_role) <> 'Guest'::text)));
create policy "Own push subscriptions: delete" on public.push_subscriptions as PERMISSIVE for DELETE to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Own push subscriptions: read" on public.push_subscriptions as PERMISSIVE for SELECT to authenticated using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "Admin all on reservations" on public.reservations as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Staff read reservations" on public.reservations as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy "Admin all on room_access_logs" on public.room_access_logs as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Authenticated insert own room_access_logs" on public.room_access_logs as PERMISSIVE for INSERT to authenticated with check ((user_id = (( SELECT auth.uid() AS uid))::text));
create policy "Authenticated update own room_access_logs" on public.room_access_logs as PERMISSIVE for UPDATE to authenticated using ((user_id = (( SELECT auth.uid() AS uid))::text)) with check ((user_id = (( SELECT auth.uid() AS uid))::text));
create policy "Staff read all access logs, guests read own or same email" on public.room_access_logs as PERMISSIVE for SELECT to authenticated using (((user_id = (( SELECT auth.uid() AS uid))::text) OR (( SELECT current_user_role() AS current_user_role) <> 'Guest'::text) OR ((guest_email IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'Guest'::text) AND (lower(p.email) = lower(room_access_logs.guest_email))))))));
create policy "Admin add room_types" on public.room_types as PERMISSIVE for INSERT to authenticated with check (( SELECT is_admin() AS is_admin));
create policy "Admin remove room_types" on public.room_types as PERMISSIVE for DELETE to authenticated using (( SELECT is_admin() AS is_admin));
create policy "Staff read room_types" on public.room_types as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy "Admin all on rooms" on public.rooms as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Authenticated read rooms" on public.rooms as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admin all on service_requests" on public.service_requests as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Guest read same-email service_requests" on public.service_requests as PERMISSIVE for SELECT to authenticated using (((requested_by_email IS NOT NULL) AND (requested_by_role = 'Guest'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'Guest'::text) AND (lower(p.email) = lower(service_requests.requested_by_email)))))));
create policy "Linked work order assignee can read service_requests" on public.service_requests as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM work_orders w
  WHERE ((w.source_ref_id = service_requests.ticket_id) AND (w.assigned_technician_id = (( SELECT auth.uid() AS uid))::text)))));
create policy "Linked work order assignee can update service_requests" on public.service_requests as PERMISSIVE for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM work_orders w
  WHERE ((w.source_ref_id = service_requests.ticket_id) AND (w.assigned_technician_id = (( SELECT auth.uid() AS uid))::text))))) with check ((EXISTS ( SELECT 1
   FROM work_orders w
  WHERE ((w.source_ref_id = service_requests.ticket_id) AND (w.assigned_technician_id = (( SELECT auth.uid() AS uid))::text)))));
create policy "Requester insert own service_requests" on public.service_requests as PERMISSIVE for INSERT to authenticated with check ((requested_by_user_id = ( SELECT auth.uid() AS uid)));
create policy "Requester read own service_requests" on public.service_requests as PERMISSIVE for SELECT to authenticated using ((requested_by_user_id = ( SELECT auth.uid() AS uid)));
create policy "Requester update own service_requests" on public.service_requests as PERMISSIVE for UPDATE to authenticated using ((requested_by_user_id = ( SELECT auth.uid() AS uid))) with check ((requested_by_user_id = ( SELECT auth.uid() AS uid)));
create policy "Admin update sla_settings" on public.sla_settings as PERMISSIVE for UPDATE to authenticated using (( SELECT is_admin() AS is_admin)) with check (( SELECT is_admin() AS is_admin));
create policy "Signed-in read sla_settings" on public.sla_settings as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admin all on sub_categories" on public.sub_categories as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Authenticated read sub_categories" on public.sub_categories as PERMISSIVE for SELECT to authenticated using (true);
create policy "Admin all on vendors" on public.vendors as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Staff read vendors" on public.vendors as PERMISSIVE for SELECT to authenticated using (( SELECT is_staff() AS is_staff));
create policy "Admin all on work_orders" on public.work_orders as PERMISSIVE for ALL to authenticated using (is_admin()) with check (is_admin());
create policy "Assignee read own work_orders" on public.work_orders as PERMISSIVE for SELECT to authenticated using ((assigned_technician_id = (( SELECT auth.uid() AS uid))::text));
create policy "Assignee update own work_orders" on public.work_orders as PERMISSIVE for UPDATE to authenticated using ((assigned_technician_id = (( SELECT auth.uid() AS uid))::text)) with check ((assigned_technician_id = (( SELECT auth.uid() AS uid))::text));

-- ---------------------------------------------------------------------------
-- Grants (the API roles reach tables only through the policies above)
-- ---------------------------------------------------------------------------
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
revoke insert, update on public.push_subscriptions from anon, authenticated;
revoke all on public.push_config from anon, authenticated;
revoke all on public.room_types from anon;
revoke update, truncate on public.room_types from authenticated;
revoke all on public.sla_settings from anon;
revoke insert, delete, truncate on public.sla_settings from authenticated;

-- Functions: only the ones the app calls are open to signed-in users; trigger
-- and job functions run as their owner and are callable by the service role only.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.next_schedule_date(date, text) to public, anon, authenticated;
grant execute on function public.is_push_endpoint(text) to public, anon, authenticated;
grant execute on function public.parse_stored_date(text) to public, anon, authenticated;
grant execute on function public.is_admin() to public, anon, authenticated;
grant execute on function public.try_timestamptz(text) to public, anon, authenticated;
grant execute on function public.qr_target_label(text, text) to anon, authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.room_check_in(text, text, text, text, text, text, text, text, bigint) to authenticated;
grant execute on function public.room_check_out(text, text, bigint, boolean, text) to authenticated;
grant execute on function public.add_field_vendor(text, text, text, text) to authenticated;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.schedule_asset_maintenance(text[], text, text, date) to authenticated;
grant execute on function public.set_asset_status(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- File storage (public read by URL; uploads by signed-in users only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('asset-images', 'asset-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', true, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('facility-documents', 'facility-documents', true, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('work-order-evidence', 'work-order-evidence', true, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "Signed-in users can upload to app buckets" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'work-order-evidence'::text) OR ((bucket_id = ANY (ARRAY['asset-images'::text, 'documents'::text, 'facility-documents'::text])) AND ( SELECT is_staff() AS is_staff))));
create policy "Uploaders can read their own uploads" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = ANY (ARRAY['asset-images'::text, 'documents'::text, 'facility-documents'::text, 'work-order-evidence'::text])) AND (owner_id = (( SELECT auth.uid() AS uid))::text)));
create policy "Uploaders can replace their own uploads" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = ANY (ARRAY['asset-images'::text, 'documents'::text, 'facility-documents'::text, 'work-order-evidence'::text])) AND (owner_id = (( SELECT auth.uid() AS uid))::text))) with check (((bucket_id = ANY (ARRAY['asset-images'::text, 'documents'::text, 'facility-documents'::text, 'work-order-evidence'::text])) AND (owner_id = (( SELECT auth.uid() AS uid))::text)));

-- ---------------------------------------------------------------------------
-- Live updates
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.rooms, public.assets, public.service_requests, public.work_orders, public.inspections,
  public.room_access_logs, public.asset_activity_logs, public.notifications, public.outside_repairs;

-- ---------------------------------------------------------------------------
-- Daily jobs (times are UTC: 23:59, 09:00 and 08:00 India time)
-- ---------------------------------------------------------------------------
select cron.schedule('afms-auto-checkout', '29 18 * * *', 'select public.run_auto_checkouts();');
select cron.schedule('afms-outside-repair-overdue', '30 3 * * *', 'select public.notify_overdue_outside_repairs();');
select cron.schedule('afms-due-today', '30 2 * * *', 'select public.notify_due_today();');

-- ---------------------------------------------------------------------------
-- Defaults the app needs (the client's Admin can change them)
-- ---------------------------------------------------------------------------
insert into public.sla_settings (priority, hours) values
  ('Critical', 4), ('High', 12), ('Medium', 24), ('Low', 48)
on conflict (priority) do nothing;

insert into public.room_types (name)
select t from unnest(array[
  'Classroom', 'Simulator Block', 'Engine Room', 'Workshop', 'Office',
  'Common Area', 'Dining Area', 'Laboratory', 'Conference Hall'
]) as t
on conflict do nothing;

-- Every new table in public gets row level security, as on SoMS.
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
exception when others then
  raise notice 'ensure_rls not created (%); the tables above already have RLS on', sqlerrm;
end $$;
