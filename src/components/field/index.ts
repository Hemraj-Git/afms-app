// The field app's design system (the phone app at /mobile), built from the
// "AFMS Field Operations - Mobile redesign" canvas. Light theme; tokens are in
// globals.css (fa-*), fonts in src/lib/fieldFonts.ts. See /dev/field-kit.
export { cn } from './cn'
export { Button, IconButton, TextButton, type ButtonProps } from './Button'
export {
  Pill, Tag, WithVendorTag, OutsideRepairTag, PriorityPill, WorkStatusPill, RequestStatusPill, ResultPill, RoomPill, ContractPill,
  PRIORITY, WORK_STATUS, REQUEST_STATUS, RESULT, ROOM_STATE, CONTRACT, specFor, type PillTone,
} from './Pill'
export { FilterChips, SegmentedControl, Toggle, SettingRow, type Chip } from './Controls'
export { Card, CardTitle, IdText, MetaRow, SummaryTile, StickyActionBar, EmptyState, CardSkeleton, ListSkeleton, type TileTint } from './Surfaces'
export {
  AppBar, ActiveRoomBanner, OfflineBanner, Toast, BottomNav, navForRole, homeTab, ROLE_ACCENT, type FieldRole, type FieldTab,
} from './AppChrome'
export { TextField, TextAreaField, SelectField } from './Field'
export { PhotoCapture, type PhotoState } from './PhotoCapture'
export { Timeline, type TimelineStep } from './Timeline'
export { ChecklistRow, CheckpointCard, type CheckpointResult } from './Checklist'
export { WorkCard, RequestRow, type JobKind } from './Cards'
export { BottomSheet, ConfirmSheet, SHEET_OVERLAY } from './Sheet'
export { BrandMark, BrandBar, ScreenHeader, PasswordRules, ShowPasswordsCheck } from './Headers'
export { AccountFrame, AccountIcon, HelpLine } from './AccountFrame'
