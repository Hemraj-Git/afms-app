'use client'

import React, { useState } from 'react'
import {
  Bell, CalendarClock, ClipboardCheck, ClipboardList, Inbox, LogOut, Mail, MapPin, Package, Smartphone, TriangleAlert, Volume2, Wrench,
} from 'lucide-react'
import {
  ActiveRoomBanner, AppBar, BottomNav, Button, Card, CardTitle, CardSkeleton, ChecklistRow, CheckpointCard, ConfirmSheet, ContractPill,
  EmptyState, FilterChips, IconButton, OfflineBanner, PhotoCapture, PriorityPill, RequestRow, RequestStatusPill, ResultPill, RoomPill,
  SegmentedControl, SelectField, SettingRow, StickyActionBar, SummaryTile, TextAreaField, TextButton, TextField, Timeline, Toast, Toggle,
  WithVendorTag, OutsideRepairTag, WorkCard, WorkStatusPill, type CheckpointResult, type FieldRole, type FieldTab, type PhotoState,
} from '@/components/field'

function Specimen({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={wide ? 'min-w-0 md:col-span-2' : 'min-w-0'}>
      <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-fa-text-2">{title}</h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-fa-border bg-fa-bg p-4">{children}</div>
    </section>
  )
}

const ROLES: FieldRole[] = ['Technician', 'Housekeeping', 'Faculty', 'Guest']
const PHOTO_STATES: PhotoState[] = [
  { status: 'empty' },
  { status: 'uploading', percent: 64, detail: '1.1 of 1.8 MB' },
  { status: 'uploaded', at: '10:42' },
  { status: 'failed' },
]

export function FieldKit() {
  const [chip, setChip] = useState<'all' | 'pm' | 'cm' | 'done'>('all')
  const [mode, setMode] = useState<'inhouse' | 'vendor'>('vendor')
  const [sound, setSound] = useState(true)
  const [push, setPush] = useState(false)
  const [checks, setChecks] = useState([true, false, false])
  const [results, setResults] = useState<CheckpointResult[]>([null, 'Fail'])
  const [tabs, setTabs] = useState<Record<FieldRole, FieldTab>>({ Technician: 'Tasks', Housekeeping: 'Cleaning', Faculty: 'Inspections', Guest: 'Requests' })
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8">
      <header className="mb-8">
        <h1 className="text-[26px] font-bold leading-tight">Field app kit</h1>
        <p className="mt-1 max-w-2xl text-base text-fa-text-2">
          The light-theme field app&apos;s building blocks, from the &quot;AFMS Field Operations - Mobile redesign&quot; canvas. Each specimen is
          phone width and works: press the chips, toggles, PASS / FAIL and checklist boxes.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Specimen title="Navigation per role" wide>
          <div className="grid grid-cols-1 justify-items-center gap-4 lg:grid-cols-2">
            {ROLES.map(role => (
              <div key={role} className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-fa-border bg-fa-surface">
                <AppBar role={role} unread={role === 'Technician' ? 3 : 0} onBell={() => {}} />
                <div className="h-20 bg-fa-bg" />
                <BottomNav
                  role={role}
                  active={tabs[role]}
                  onChange={t => setTabs(s => ({ ...s, [role]: t }))}
                  badges={role === 'Technician' ? { Tasks: 7, Inspections: 2 } : role === 'Housekeeping' ? { Cleaning: 4, Inspections: 1 } : role === 'Faculty' ? { Inspections: 3 } : {}}
                />
              </div>
            ))}
          </div>
        </Specimen>

        <Specimen title="Banners">
          <div className="-m-4 overflow-hidden rounded-2xl">
            <ActiveRoomBanner room="Catering Lab (R-0214)" onCheckOut={() => {}} />
            <OfflineBanner onRetry={() => {}} />
          </div>
          <Toast action="View" onAction={() => {}}>
            WO-BD-0031 completed and closed
          </Toast>
        </Specimen>

        <Specimen title="Buttons">
          <Button icon={Wrench}>Primary action</Button>
          <Button variant="secondary">Secondary action</Button>
          <Button variant="destructive" icon={LogOut}>
            Destructive
          </Button>
          <Button disabled>Disabled — reason shown nearby</Button>
          <Button loading>Saving</Button>
          <div className="flex items-center gap-2.5">
            <IconButton icon={Bell} label="Notifications" badge={3} />
            <TextButton>Forgot password?</TextButton>
          </div>
        </Specimen>

        <Specimen title="Pills and tags">
          <div className="flex flex-wrap gap-2">
            {['Critical', 'High', 'Medium', 'Low'].map(p => (
              <PriorityPill key={p} value={p} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Overdue'].map(s => (
              <WorkStatusPill key={s} value={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Open', 'In Progress', 'Resolved', 'Closed', 'Escalated'].map(s => (
              <RequestStatusPill key={s} value={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Pass', 'Fail', 'Pending'].map(s => (
              <ResultPill key={s} value={s} />
            ))}
            <RoomPill value="Available" />
            <RoomPill value="Occupied" />
          </div>
          <div className="flex flex-wrap gap-2">
            <WithVendorTag />
            <OutsideRepairTag />
            <ContractPill value="amc" />
            <ContractPill value="onDemand" />
          </div>
        </Specimen>

        <Specimen title="Filter chips, segmented control, switches">
          <FilterChips
            label="Filter work orders"
            value={chip}
            onChange={setChip}
            chips={[
              { value: 'all', label: 'All', count: 7 },
              { value: 'pm', label: 'Preventive', count: 3 },
              { value: 'cm', label: 'Corrective', count: 4 },
              { value: 'done', label: 'Completed', count: 12 },
            ]}
          />
          <SegmentedControl
            label="Who is fixing it?"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'inhouse', label: 'In-house', icon: Wrench },
              { value: 'vendor', label: 'Hand over to vendor', icon: Package },
            ]}
          />
          <Card>
            <SettingRow icon={Volume2} title="Sound for new alerts">
              <Toggle label="Sound for new alerts" checked={sound} onChange={setSound} />
            </SettingRow>
            <SettingRow icon={Smartphone} title="Alerts when the app is closed" description="Push notifications for new work and due inspections.">
              <Toggle label="Alerts when the app is closed" checked={push} onChange={setPush} />
            </SettingRow>
          </Card>
        </Specimen>

        <Specimen title="Summary tiles">
          <div className="grid grid-cols-2 gap-2.5">
            <SummaryTile count={7} label="Open work orders" icon={ClipboardList} tint="primary" onClick={() => {}} pressed />
            <SummaryTile count={3} label="PM due" icon={CalendarClock} tint="warning" onClick={() => {}} />
            <SummaryTile count={4} label="Breakdowns" icon={TriangleAlert} tint="danger" onClick={() => {}} />
            <SummaryTile count={12} label="Completed" icon={ClipboardCheck} tint="success" onClick={() => {}} />
          </div>
        </Specimen>

        <Specimen title="Work order card">
          <WorkCard
            id="WO-PM-0012"
            kind="Preventive"
            priority="High"
            title="Diesel Generator 125 kVA"
            assetId="AST-0042"
            location="DG Yard (R-0003) · Utility Block"
            due={{ text: 'Overdue by 2 days · was due 28 Sep', overdue: true }}
            badges={
              <>
                <WorkStatusPill value="Scheduled" />
                <WorkStatusPill value="Overdue" />
              </>
            }
            action={{ label: 'Start', onClick: () => {} }}
          />
          <WorkCard
            id="WO-BD-0029"
            kind="Breakdown"
            priority="High"
            title="CCTV Camera"
            assetId="AST-0207"
            location="Main Lobby (R-0001) · Admin Block"
            due={{ text: 'Due 2 Oct, 1:00 PM' }}
            badges={
              <>
                <WorkStatusPill value="In Progress" />
                <WithVendorTag />
              </>
            }
            action={{ label: 'Continue', onClick: () => {} }}
          />
        </Specimen>

        <Specimen title="Request row and empty state">
          <RequestRow
            id="SR-2026-0035"
            status={<RequestStatusPill value="Escalated" />}
            title="Wi-Fi keeps dropping"
            location="Seminar Hall 2 (R-0105)"
            sla={{ text: 'Overdue by 6 h', overdue: true }}
            onOpen={() => {}}
          />
          <EmptyState icon={Inbox} title="No requests yet" action={<Button block={false}>New request</Button>}>
            Scan a room or asset QR, or start a new request.
          </EmptyState>
        </Specimen>

        <Specimen title="Checklist rows">
          <Card>
            {['Check engine oil level and top up', 'Check coolant level', 'Clean or replace air filter'].map((label, i) => (
              <ChecklistRow
                key={label}
                label={label}
                done={checks[i]}
                onToggle={() => setChecks(c => c.map((v, k) => (k === i ? !v : v)))}
                note={i === 0 ? 'Topped up 0.5 L' : undefined}
                photoCount={i === 0 ? 1 : 0}
                onNote={() => {}}
                onPhoto={() => {}}
              />
            ))}
          </Card>
        </Specimen>

        <Specimen title="PASS / FAIL checkpoint">
          {['Pressure gauge needle in the green zone', 'Hose and horn free of cracks or blockage'].map((label, i) => (
            <CheckpointCard
              key={label}
              number={i === 0 ? 1 : 3}
              label={label}
              photoRequired={i === 0}
              result={results[i]}
              onResult={r => setResults(rs => rs.map((v, k) => (k === i ? r : v)))}
            >
              {results[i] === 'Fail' ? <TextAreaField label="What is wrong?" required rows={2} defaultValue="Hairline crack near horn coupling" /> : null}
              <PhotoCapture label="Photo of this checkpoint" state={i === 0 ? { status: 'empty' } : { status: 'uploaded', at: '10:42' }} required={i === 0} onTake={() => {}} />
            </CheckpointCard>
          ))}
        </Specimen>

        <Specimen title="Form fields">
          <Card>
            <TextField label="Title" required defaultValue="Ceiling fan making grinding noise" />
            <TextField label="Title" required placeholder="Short summary" error="Add a short title (at least 5 characters)" />
            <TextField label="Location" icon={MapPin} readOnly value="Catering Lab (R-0214)" hint="Filled in from your QR scan." />
            <SelectField label="Equipment" placeholder="Select the equipment" value="" onChange={() => {}} options={[{ value: 'a', label: 'Ceiling Fan · AST-0312' }]} />
            <TextField label="Work email" type="email" icon={Mail} placeholder="name@campus.example" />
          </Card>
        </Specimen>

        <Specimen title="Photo capture">
          {PHOTO_STATES.map(state => (
            <PhotoCapture key={state.status} label={state.status === 'failed' ? 'Job sheet' : 'Before cleaning photo'} state={state} required onTake={() => {}} onRetry={() => {}} onCancel={() => {}} />
          ))}
        </Specimen>

        <Specimen title="Timeline">
          <Card>
            <Timeline
              label="Outside repair"
              steps={[
                { title: 'Sent out · Compressor control PCB', detail: 'Today 11:20 AM · by Ravi Kumar', state: 'done' },
                { title: 'At vendor workshop', detail: 'Expected back 7 Oct', state: 'current' },
                {
                  title: 'Received back',
                  detail: 'Mark when back on site',
                  state: 'upcoming',
                  action: (
                    <Button size="md" variant="secondary" block={false}>
                      Mark received back
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </Specimen>

        <Specimen title="Card title, skeleton, sticky bar, confirmation">
          <Card>
            <CardTitle icon={ClipboardList} aside={<span className="text-[15px] text-fa-text-2">3 of 6</span>}>
              Checklist
            </CardTitle>
          </Card>
          <CardSkeleton />
          <div className="-mx-4 -mb-4 overflow-hidden rounded-b-2xl">
            <StickyActionBar>
              <Button variant="secondary">Save as in progress</Button>
              <Button onClick={() => setConfirm(true)}>Complete &amp; close</Button>
            </StickyActionBar>
          </div>
        </Specimen>
      </div>

      {confirm ? (
        <ConfirmSheet
          title="Complete and close this job?"
          body="WO-BD-0031 is marked complete and leaves your list. You can still see it under Completed."
          icon={ClipboardCheck}
          confirmLabel="Complete & close"
          onConfirm={() => setConfirm(false)}
          onCancel={() => setConfirm(false)}
        />
      ) : null}
    </div>
  )
}
