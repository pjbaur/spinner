import { useState } from 'react'

export function loadItems(key, defaultItems) {
  const raw = localStorage.getItem(key)
  if (!raw) return defaultItems
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
    return defaultItems
  } catch {
    return defaultItems
  }
}

export function useWheelItems(key, defaultItems) {
  const [items, setItemsState] = useState(() => loadItems(key, defaultItems))

  function setItems(nextItems) {
    setItemsState(nextItems)
    localStorage.setItem(key, JSON.stringify(nextItems))
  }

  return [items, setItems]
}
