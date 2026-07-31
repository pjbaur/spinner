import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssignmentReel from './AssignmentReel.jsx'

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

function stubSound() {
  return { ensureAudio: vi.fn(), tick: vi.fn(), ding: vi.fn(), stamp: vi.fn() }
}

function renderReel(overrides = {}) {
  const props = {
    title: 'TEST REEL',
    labels: LABELS,
    windowBg: '#111',
    hasResult: false,
    sound: stubSound(),
    onSpinEnd: vi.fn(),
    randomFn: () => 0,
    ...overrides,
  }
  render(<AssignmentReel {...props} />)
  return props
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AssignmentReel hint text', () => {
  it('shows "tap to pull" before a result', () => {
    renderReel({ hasResult: false })
    expect(screen.getByText('tap to pull')).toBeInTheDocument()
  })

  it('shows "tap to re-pull" once a result exists', () => {
    renderReel({ hasResult: true })
    expect(screen.getByText('tap to re-pull')).toBeInTheDocument()
  })
})

describe('AssignmentReel spinning', () => {
  it('disables the cabinet and shows "assigning…" while a pull is in flight', async () => {
    // requestAnimationFrame stores the callback but never invokes it -> pull never completes
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    const user = userEvent.setup()
    const props = renderReel()
    await user.click(
      screen.getByRole('button', { name: 'Pull the TEST REEL reel' }),
    )
    expect(screen.getByText('assigning…')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pull the TEST REEL reel' }),
    ).toBeDisabled()
    expect(props.sound.ensureAudio).toHaveBeenCalledTimes(1)
    expect(props.onSpinEnd).not.toHaveBeenCalled()
  })

  it('reports the forced target index when the pull completes', async () => {
    // invoke the rAF callback once with a timestamp far past the duration -> p=1 -> completes
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(1e9)
      return 1
    })
    const user = userEvent.setup()
    const props = renderReel({ randomFn: () => 0 }) // targetIndex = floor(0*6) = 0
    await user.click(
      screen.getByRole('button', { name: 'Pull the TEST REEL reel' }),
    )
    expect(props.onSpinEnd).toHaveBeenCalledWith(0)
    expect(props.sound.ding).toHaveBeenCalledTimes(1)
  })

  it('starts a pull from keyboard activation', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    const user = userEvent.setup()
    renderReel()
    const button = screen.getByRole('button', {
      name: 'Pull the TEST REEL reel',
    })
    button.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('assigning…')).toBeInTheDocument()
  })
})
