import type { WorkOrder } from '@/types/afms'

// "Open" work: still to be done. A Completed order is finished and a Cancelled
// one was dropped, so neither belongs in a "how much is on my plate" count.
// (The mobile Tasks / Cleaning badges used to count every order ever assigned.)
export function isOpenWorkOrder(wo: Pick<WorkOrder, 'status'>): boolean {
  return wo.status !== 'Completed' && wo.status !== 'Cancelled'
}

// A Corrective order that has been handed to an outside vendor and is not yet
// finished. There is no separate "With vendor" status; it is In Progress with
// executedBy = 'Vendor'.
export function isWithVendor(wo: Pick<WorkOrder, 'type' | 'status' | 'executedBy'>): boolean {
  return wo.type === 'Corrective' && wo.executedBy === 'Vendor' && isOpenWorkOrder(wo)
}

// What a technician must provide when handing a job to a vendor. Saving it as
// In Progress needs the vendor; closing it also needs the vendor's own ticket /
// job number, so the paperwork can be matched to their invoice later.
// Returns the message to show, or null when the handover is complete enough.
export function validateVendorHandover(
  input: { vendorId?: string; vendorTicketNo?: string },
  status: 'In Progress' | 'Completed'
): string | null {
  if (!input.vendorId) return 'Please select the vendor this job is handed over to.'
  if (status === 'Completed' && !input.vendorTicketNo?.trim()) {
    return "Please enter the vendor's ticket / job number before completing this job."
  }
  return null
}
