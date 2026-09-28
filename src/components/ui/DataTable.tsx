'use client'

import React, { useEffect, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingFn,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react'

// One table for every list screen: click a heading to sort, page through long
// lists. The page keeps its own search box and filters and hands the filtered
// rows in, so this only sorts and pages. Columns keep each page's own padding via
// `meta.thClassName` / `meta.tdClassName`, so screens look as they did.

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    thClassName?: string
    tdClassName?: string
  }
}

export const PAGE_SIZES = [10, 25, 50, 100] as const
const STORE_PREFIX = 'afms-table-size:'

function readPageSize(tableId: string, fallback: number): number {
  try {
    const v = Number(window.localStorage.getItem(STORE_PREFIX + tableId))
    return (PAGE_SIZES as readonly number[]).includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

function savePageSize(tableId: string, size: number) {
  try {
    window.localStorage.setItem(STORE_PREFIX + tableId, String(size))
  } catch {
    /* not remembered; the table still works */
  }
}

// Sorts a column by a fixed order (e.g. Critical, High, Medium, Low) rather than
// alphabetically. Values not in the list go last.
export function sortByOrder<T>(order: readonly string[]): SortingFn<T> {
  const rank = (v: unknown) => {
    const i = order.indexOf(String(v ?? ''))
    return i === -1 ? order.length : i
  }
  return (a, b, columnId) => rank(a.getValue(columnId)) - rank(b.getValue(columnId))
}

export const PRIORITY_ORDER = ['Critical', 'High', 'Medium', 'Low'] as const
export const WO_STATUS_ORDER = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'] as const

// A date column's sort value: sorts by the real moment, not the displayed text.
// Missing or unreadable dates give undefined; pair with `sortUndefined: 'last'`.
export function timeOf(value?: string | null): number | undefined {
  if (!value) return undefined
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? undefined : t
}

export interface DataTableProps<T> {
  data: T[]
  // Values are mixed per column (string, number, ...), so the column value type is left open.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[]
  // Remembers this table's page size in this browser.
  tableId: string
  getRowId?: (row: T) => string
  initialSorting?: SortingState
  defaultPageSize?: number
  // When this changes (e.g. the search text or a filter), go back to page 1.
  resetKey?: string
  emptyState?: React.ReactNode
  onRowClick?: (row: T) => void
  rowClassName?: string | ((row: T) => string)
  headerRowClassName?: string
  bodyClassName?: string
  tableClassName?: string
  // Padding etc. for every heading / cell; a column's meta overrides it.
  thClassName?: string
  tdClassName?: string
}

export function DataTable<T>({
  data,
  columns,
  tableId,
  getRowId,
  initialSorting = [],
  defaultPageSize = 25,
  resetKey,
  emptyState,
  onRowClick,
  rowClassName = 'hover:bg-slate-50/60 transition',
  headerRowClassName = 'text-slate-400 bg-slate-50/50 border-b border-slate-100 font-medium',
  bodyClassName = 'divide-y divide-slate-100',
  tableClassName = 'w-full text-left text-xs',
  thClassName = 'py-3.5 px-4',
  tdClassName = 'py-4 px-4',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: defaultPageSize })

  // The remembered size is read after mounting (the server has no localStorage).
  useEffect(() => {
    const size = readPageSize(tableId, defaultPageSize)
    if (size !== defaultPageSize) setPagination(p => ({ ...p, pageSize: size }))
  }, [tableId, defaultPageSize])

  // A new search or filter starts again at page 1. A live update (same filters,
  // refreshed rows) keeps the page the person is on.
  useEffect(() => {
    setPagination(p => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  }, [resetKey])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId: getRowId ? row => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    sortDescFirst: false,
  })

  const total = data.length
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize))

  // Rows removed (e.g. by a live update) can leave the page past the end.
  useEffect(() => {
    if (pagination.pageIndex > pageCount - 1) setPagination(p => ({ ...p, pageIndex: pageCount - 1 }))
  }, [pageCount, pagination.pageIndex])

  const first = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const last = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)
  const colCount = table.getVisibleLeafColumns().length

  return (
    <div>
      <div className="overflow-x-auto">
        <table className={tableClassName}>
          <thead>
            {table.getHeaderGroups().map(group => (
              <tr key={group.id} className={headerRowClassName}>
                {group.headers.map(header => {
                  const canSort = header.column.getCanSort()
                  const dir = header.column.getIsSorted()
                  const label = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())
                  return (
                    <th
                      key={header.id}
                      className={header.column.columnDef.meta?.thClassName ?? thClassName}
                      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={`inline-flex items-center gap-1 font-medium hover:text-slate-700 transition ${dir ? 'text-slate-700' : ''}`}
                          title="Sort"
                        >
                          {label}
                          {dir === 'asc' ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : dir === 'desc' ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        label
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className={bodyClassName}>
            {total === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-12 text-center text-slate-400">
                  {emptyState ?? 'No records.'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={`${typeof rowClassName === 'function' ? rowClassName(row.original) : rowClassName}${onRowClick ? ' cursor-pointer' : ''}`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={cell.column.columnDef.meta?.tdClassName ?? tdClassName}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Showing <b className="text-slate-700">{first}–{last}</b> of <b className="text-slate-700">{total}</b>
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span>Rows per page</span>
              <select
                value={pagination.pageSize}
                onChange={e => {
                  const size = Number(e.target.value)
                  savePageSize(tableId, size)
                  setPagination({ pageIndex: 0, pageSize: size })
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
              >
                {PAGE_SIZES.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <span>
              Page {pagination.pageIndex + 1} of {pageCount}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
