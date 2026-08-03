import { useEffect, useState } from 'react'
import { validateWheelConfig } from '../../shared/wheelConfig.mjs'
import { loadConfig, saveConfig, ConfigSaveError } from './configApi.js'

export default function ConfigEditor({ idToken, onAuthExpired }) {
  const [lists, setLists] = useState(null)
  const [status, setStatus] = useState({ kind: 'idle' })

  useEffect(() => {
    let cancelled = false
    loadConfig().then((config) => {
      if (!cancelled) {
        setLists({
          environments: config.environments,
          subjects: config.subjects,
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (lists === null) return <p>Loading config…</p>

  const candidate = { version: 1, ...lists }
  const validation = validateWheelConfig(candidate)

  function updateList(name, items) {
    setStatus({ kind: 'idle' })
    setLists((prev) => ({ ...prev, [name]: items }))
  }

  async function handleSave() {
    setStatus({ kind: 'saving' })
    try {
      await saveConfig(candidate, idToken)
      setStatus({ kind: 'saved' })
    } catch (err) {
      if (
        err instanceof ConfigSaveError &&
        (err.status === 401 || err.status === 403)
      ) {
        setStatus({ kind: 'idle' })
        onAuthExpired()
      } else if (err instanceof ConfigSaveError) {
        setStatus({ kind: 'error', errors: err.errors })
      } else {
        setStatus({ kind: 'error', errors: ['save failed; try again'] })
      }
    }
  }

  return (
    <main>
      <h1>Wheel config</h1>
      <ListEditor
        name="environments"
        label="Teaching environments"
        addLabel="Add environment entry"
        items={lists.environments}
        onChange={(items) => updateList('environments', items)}
      />
      <ListEditor
        name="subjects"
        label="Teaching subjects"
        addLabel="Add subject entry"
        items={lists.subjects}
        onChange={(items) => updateList('subjects', items)}
      />
      {!validation.ok && (
        <ul>
          {validation.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {status.kind === 'error' && (
        <ul>
          {status.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {status.kind === 'saved' && <p>Saved.</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={!validation.ok || status.kind === 'saving'}
      >
        {status.kind === 'saving' ? 'Saving…' : 'Save'}
      </button>
    </main>
  )
}

function ListEditor({ name, label, addLabel, items, onChange }) {
  function setItem(index, value) {
    onChange(items.map((item, i) => (i === index ? value : item)))
  }
  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }
  function move(index, delta) {
    const next = [...items]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return (
    <section>
      <h2>{label}</h2>
      <ol>
        {items.map((item, i) => (
          // Index keys are acceptable here: entries are plain strings with
          // no identity, and edits are input-driven.
          <li key={i}>
            <input
              type="text"
              value={item}
              aria-label={`${name} entry ${i + 1}`}
              onChange={(e) => setItem(i, e.target.value)}
            />
            <button
              type="button"
              aria-label={`Remove ${name} entry ${i + 1}`}
              onClick={() => removeItem(i)}
            >
              ✕
            </button>
            <button
              type="button"
              aria-label={`Move ${name} entry ${i + 1} up`}
              onClick={() => move(i, -1)}
              disabled={i === 0}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${name} entry ${i + 1} down`}
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => onChange([...items, ''])}>
        {addLabel}
      </button>
    </section>
  )
}
