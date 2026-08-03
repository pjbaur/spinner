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

  it('reports the landed label when the pull completes', async () => {
    // invoke the rAF callback once with a timestamp far past the duration -> p=1 -> completes
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(1e9)
      return 1
    })
    const user = userEvent.setup()
    const props = renderReel({ randomFn: () => 0 }) // targetIndex = floor(0*6) = 0 -> 'A'
    await user.click(
      screen.getByRole('button', { name: 'Pull the TEST REEL reel' }),
    )
    expect(props.onSpinEnd).toHaveBeenCalledWith('A')
    expect(props.sound.ding).toHaveBeenCalledTimes(1)
  })

  it('reports a label still valid against the spin-start list even if labels shrink mid-spin', async () => {
    // Capture the rAF callback instead of invoking it immediately, so we can
    // swap `labels` to a shorter list (simulating a runtime config reload)
    // before the spin completes.
    let rafCallback = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 1
    })
    const user = userEvent.setup()
    const onSpinEnd = vi.fn()
    const baseProps = {
      title: 'TEST REEL',
      windowBg: '#111',
      hasResult: false,
      sound: stubSound(),
      onSpinEnd,
      randomFn: () => 5 / 6, // targetIndex = floor((5/6)*6) = 5 -> 'F'
    }
    const { rerender } = render(
      <AssignmentReel {...baseProps} labels={LABELS} />,
    )
    await user.click(
      screen.getByRole('button', { name: 'Pull the TEST REEL reel' }),
    )
    expect(rafCallback).not.toBeNull()

    // Config swap arrives mid-spin: the option list shrinks to 2 entries,
    // which would put index 5 out of bounds.
    rerender(<AssignmentReel {...baseProps} labels={['X', 'Y']} />)

    // Complete the in-flight spin; it must still resolve against the
    // 6-item list captured when the spin started, not the new 2-item list.
    rafCallback(1e9)

    expect(onSpinEnd).toHaveBeenCalledWith('F')
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
