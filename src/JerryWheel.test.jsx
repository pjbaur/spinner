// JerryWheel now fetches /config/jerry.json on mount; fail the fetch so
// tests exercise the built-in default lists.
// NOTE: This stub is applied once at module load. If restoreMocks or
// unstubGlobals is added to the vitest config, this will silently stop
// protecting tests.
vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Replace the real reel with a stub that reports the first label on click,
// mirroring the real component's onSpinEnd(label) contract.
vi.mock('./AssignmentReel.jsx', () => ({
  default: ({ title, labels, onSpinEnd }) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={() => onSpinEnd(labels[0])}>
        spin {title}
      </button>
    </div>
  ),
}))

import JerryWheel from './JerryWheel.jsx'

describe('JerryWheel', () => {
  it('shows the banner and the awaiting line before both wheels resolve', () => {
    render(<JerryWheel />)
    expect(screen.getByText('What will Jerry teach next?')).toBeInTheDocument()
    expect(screen.getByText('TEACHING ENVIRONMENT')).toBeInTheDocument()
    expect(screen.getByText('TEACHING SUBJECT')).toBeInTheDocument()
    expect(
      screen.getByText('— awaiting results of both reels —'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('INTERIM ASSIGNMENT NOTICE'),
    ).not.toBeInTheDocument()
  })

  it('renders the memo with a file number once both wheels resolve', async () => {
    const user = userEvent.setup()
    render(<JerryWheel />)
    await user.click(screen.getByText('spin TEACHING ENVIRONMENT'))
    await user.click(screen.getByText('spin TEACHING SUBJECT'))
    expect(screen.getByText('INTERIM ASSIGNMENT NOTICE')).toBeInTheDocument()
    // stub lands on labels[0] for both -> environments[0] and subjects[0]
    expect(screen.getByText('Kindergarten')).toBeInTheDocument()
    expect(screen.getByText('P.E.')).toBeInTheDocument()
    expect(
      screen.getByText(/^FILE SP-\d{4}-[A-HJ-NP-Z]{2}$/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('— awaiting results of both reels —'),
    ).not.toBeInTheDocument()
  })

  it('clears the memo when FILE NEW REQUEST is clicked', async () => {
    const user = userEvent.setup()
    render(<JerryWheel />)
    await user.click(screen.getByText('spin TEACHING ENVIRONMENT'))
    await user.click(screen.getByText('spin TEACHING SUBJECT'))
    await user.click(screen.getByRole('button', { name: 'FILE NEW REQUEST' }))
    expect(
      screen.queryByText('INTERIM ASSIGNMENT NOTICE'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('— awaiting results of both reels —'),
    ).toBeInTheDocument()
  })

  it('toggles the mute control', async () => {
    const user = userEvent.setup()
    render(<JerryWheel />)
    const toggle = screen.getByRole('button', { name: /sound/i })
    expect(toggle).toHaveTextContent(/on/i)
    await user.click(toggle)
    expect(toggle).toHaveTextContent(/off/i)
  })
})
