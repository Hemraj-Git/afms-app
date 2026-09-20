import { useEffect, useRef } from 'react'

// Pages seed a form's default selection (e.g. "first room") from data that is
// still loading when the page first mounts: `useState(rooms[0]?.id || '')` runs
// once, sees an empty list on a hard refresh or deep link, captures '' and never
// updates -- so the form opens with nothing selected. This fills the default
// once, as soon as it becomes available, if nothing was chosen yet. After that
// it never touches the value again, so a later deliberate choice (including
// picking a "none" placeholder) is respected.
export function useDefaultSelection(value: string, setValue: (next: string) => void, defaultValue: string | undefined) {
  const settled = useRef(false)
  useEffect(() => {
    if (settled.current) return
    if (value) {
      settled.current = true
      return
    }
    if (defaultValue) {
      settled.current = true
      setValue(defaultValue)
    }
  }, [value, defaultValue, setValue])
}
