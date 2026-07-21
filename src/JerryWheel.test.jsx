import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Replace the real wheel with a stub that reports a fixed index on click.
vi.mock('./AssignmentWheel.jsx', () => ({
  default: ({ title, onSpinEnd }) => (
    <div>
      <div>{title}</div>
      <button type="button" onClick={() => onSpinEnd(0)}>
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
      screen.getByText('— awaiting results of both wheels —'),
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
    // index 0 for both -> environments[0] and subjects[0]
    expect(screen.getByText('Kindergarten')).toBeInTheDocument()
    expect(screen.getByText('P.E.')).toBeInTheDocument()
    expect(
      screen.getByText(/^FILE SP-\d{4}-[A-HJ-NP-Z]{2}$/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('— awaiting results of both wheels —'),
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
      screen.getByText('— awaiting results of both wheels —'),
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
