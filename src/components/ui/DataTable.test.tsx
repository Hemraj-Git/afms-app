import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataTable, PRIORITY_ORDER, sortByOrder } from './DataTable'

interface Row {
  id: string
  name: string
  priority: string
  cost: number
}

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'priority', header: 'Priority', sortingFn: sortByOrder(PRIORITY_ORDER) },
  { accessorKey: 'cost', header: 'Cost' },
  { id: 'actions', header: 'Actions', enableSorting: false, cell: () => 'edit' },
]

const make = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i + 1}`,
    name: `Item ${String(i + 1).padStart(3, '0')}`,
    priority: PRIORITY_ORDER[i % 4],
    cost: (i * 37) % 100,
  }))

// The text of the first cell in each body row, top to bottom.
const firstColumn = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[0].textContent)

const column = (i: number) =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[i].textContent)

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('DataTable', () => {
  it('shows the first page and the range in the footer', () => {
    render(<DataTable data={make(60)} columns={columns} tableId="t" getRowId={r => r.id} />)
    expect(firstColumn()).toHaveLength(25)
    expect(firstColumn()[0]).toBe('Item 001')
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 1–25 of 60')
    expect(screen.getByText('Page 1 of 3')).toBeTruthy()
  })

  it('pages forward and back, and disables the ends', () => {
    render(<DataTable data={make(60)} columns={columns} tableId="t" />)
    const prev = screen.getByLabelText('Previous page') as HTMLButtonElement
    const next = screen.getByLabelText('Next page') as HTMLButtonElement
    expect(prev.disabled).toBe(true)
    fireEvent.click(next)
    fireEvent.click(next)
    expect(firstColumn()).toHaveLength(10)
    expect(firstColumn()[0]).toBe('Item 051')
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 51–60 of 60')
    expect(next.disabled).toBe(true)
    fireEvent.click(prev)
    expect(firstColumn()[0]).toBe('Item 026')
  })

  it('sorts a column ascending, then descending, then back to the original order', () => {
    render(<DataTable data={make(5)} columns={columns} tableId="t" />)
    const header = screen.getByRole('button', { name: /Cost/ })
    fireEvent.click(header)
    expect(column(2)).toEqual(['0', '11', '37', '48', '74'])
    expect(screen.getAllByRole('columnheader')[2].getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(header)
    expect(column(2)).toEqual(['74', '48', '37', '11', '0'])
    fireEvent.click(header)
    expect(column(2)).toEqual(['0', '37', '74', '11', '48'])
  })

  it('sorts priority Critical to Low, not alphabetically', () => {
    const data = [
      { id: '1', name: 'a', priority: 'Low', cost: 1 },
      { id: '2', name: 'b', priority: 'Critical', cost: 1 },
      { id: '3', name: 'c', priority: 'Medium', cost: 1 },
      { id: '4', name: 'd', priority: 'High', cost: 1 },
      { id: '5', name: 'e', priority: '', cost: 1 },
    ]
    render(<DataTable data={data} columns={columns} tableId="t" />)
    fireEvent.click(screen.getByRole('button', { name: /Priority/ }))
    expect(column(1)).toEqual(['Critical', 'High', 'Medium', 'Low', ''])
  })

  it('does not offer sorting on a column that turns it off', () => {
    render(<DataTable data={make(3)} columns={columns} tableId="t" />)
    expect(screen.queryByRole('button', { name: /Actions/ })).toBeNull()
    expect(screen.getByText('Actions')).toBeTruthy()
  })

  it('changes the page size, goes back to page 1, and remembers it per table', () => {
    const { unmount } = render(<DataTable data={make(60)} columns={columns} tableId="assets" />)
    fireEvent.click(screen.getByLabelText('Next page'))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '50' } })
    expect(firstColumn()).toHaveLength(50)
    expect(firstColumn()[0]).toBe('Item 001')
    expect(window.localStorage.getItem('afms-table-size:assets')).toBe('50')
    unmount()

    render(<DataTable data={make(60)} columns={columns} tableId="assets" />)
    expect(firstColumn()).toHaveLength(50)
    cleanup()
    render(<DataTable data={make(60)} columns={columns} tableId="other" />)
    expect(firstColumn()).toHaveLength(25)
  })

  it('still works when the browser refuses storage', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<DataTable data={make(60)} columns={columns} tableId="t" />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '10' } })
    expect(firstColumn()).toHaveLength(10)
    get.mockRestore()
    set.mockRestore()
  })

  it('goes back to page 1 when the filters change, but not on a live refresh', () => {
    const data = make(60)
    const { rerender } = render(<DataTable data={data} columns={columns} tableId="t" resetKey="a" />)
    fireEvent.click(screen.getByLabelText('Next page'))
    rerender(<DataTable data={[...data]} columns={columns} tableId="t" resetKey="a" />)
    expect(firstColumn()[0]).toBe('Item 026')
    rerender(<DataTable data={data.slice(0, 40)} columns={columns} tableId="t" resetKey="b" />)
    expect(firstColumn()[0]).toBe('Item 001')
  })

  it('moves back to the last page when rows disappear under it', () => {
    const data = make(60)
    const { rerender } = render(<DataTable data={data} columns={columns} tableId="t" />)
    fireEvent.click(screen.getByLabelText('Next page'))
    fireEvent.click(screen.getByLabelText('Next page'))
    rerender(<DataTable data={data.slice(0, 30)} columns={columns} tableId="t" />)
    expect(screen.getByText('Page 2 of 2')).toBeTruthy()
    expect(firstColumn()[0]).toBe('Item 026')
  })

  it('shows the empty state across all columns and no footer', () => {
    render(<DataTable data={[]} columns={columns} tableId="t" emptyState="No assets match." />)
    const cell = screen.getByText('No assets match.')
    expect(cell.getAttribute('colspan')).toBe('4')
    expect(screen.queryByText(/Showing/)).toBeNull()
  })

  it('calls onRowClick with the row', () => {
    const onRowClick = vi.fn()
    render(<DataTable data={make(3)} columns={columns} tableId="t" onRowClick={onRowClick} />)
    fireEvent.click(screen.getByText('Item 002'))
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'r2' }))
  })

  it('uses the column class names when given', () => {
    const cols: ColumnDef<Row, unknown>[] = [
      { accessorKey: 'name', header: 'Name', meta: { thClassName: 'th-x', tdClassName: 'td-x' } },
    ]
    render(<DataTable data={make(1)} columns={cols} tableId="t" />)
    expect(screen.getByRole('columnheader').className).toBe('th-x')
    expect(screen.getByRole('cell').className).toBe('td-x')
  })

  it('prints every row in the current sort when printAllRows is set, then pages again', () => {
    render(<DataTable data={make(60)} columns={columns} tableId="t" printAllRows />)
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    fireEvent.click(screen.getByRole('button', { name: /Name/ }))
    expect(firstColumn()).toHaveLength(25)

    fireEvent(window, new Event('beforeprint'))
    expect(firstColumn()).toHaveLength(60)
    expect(firstColumn()[0]).toBe('Item 060')

    fireEvent(window, new Event('afterprint'))
    expect(firstColumn()).toHaveLength(25)
  })

  it('prints only the current page without printAllRows', () => {
    render(<DataTable data={make(60)} columns={columns} tableId="t" />)
    fireEvent(window, new Event('beforeprint'))
    expect(firstColumn()).toHaveLength(25)
  })
})
