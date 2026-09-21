-- An asset's activity timeline shows a "Ref" for each event: the work order,
-- inspection or service request number it relates to. The app has always built that
-- reference when it records the event, but the table had no column for it, so it was
-- never saved -- after a reload every card showed a made-up "EVT-101, EVT-102, ..."
-- label instead (numbered by list position, so it even changed as events were added).
--
-- Store the real reference. Nullable and additive: existing rows simply have none,
-- and the code currently in production (which never reads or writes it) keeps working.
alter table public.asset_activity_logs
  add column if not exists reference_id text;

comment on column public.asset_activity_logs.reference_id is
  'The record this event relates to, as shown to people: a work order (WO-CR-2026-0001), inspection (INSP-2026-0001) or service request (SR-2026-0001) number. Null for events with no such record (asset created / updated).';
