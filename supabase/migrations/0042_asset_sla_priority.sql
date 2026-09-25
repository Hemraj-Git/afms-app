-- SLA priority is moving from the sub-category to each asset: the person adding an
-- asset says how urgent a fault on it is. The client's equipment workbook already
-- asks for it per asset, so the loader needs somewhere to keep the answer.
--
-- Nothing in the app reads this column yet (maintenance requests still take the
-- sub-category's priority until that change is built), so this is safe to add first:
-- nullable, no default, and the code currently in production ignores it.
alter table public.assets
  add column if not exists sla_priority text
  check (sla_priority is null or sla_priority in ('Critical', 'High', 'Medium', 'Low'));

comment on column public.assets.sla_priority is
  'How urgent a fault on this asset is (Critical/High/Medium/Low). Set when the asset is added; will replace sub_categories.sla_priority as the priority a maintenance request is locked to. Null until then.';
