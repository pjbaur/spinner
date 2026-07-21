import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssignmentWheel from './AssignmentWheel.jsx'

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F']
const COLORS = ['#111', '#222']

function stubSound() {
  return { ensureAudio: vi.fn(), tick: vi.fn(), ding: vi.fn(), stamp: vi.fn() }
}

function renderWheel(overrides = {}) {
  const props = {
    title: 'TEST WHEEL',
    labels: LABELS,
    colors: COLORS,
    hasResult: false,
    sound: stubSound(),
    onSpinEnd: vi.fn(),
    randomFn: () => 0,
    ...overrides,
  }
  render(<AssignmentWheel {...props} />)
  return props
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AssignmentWheel hint text', () => {
  it('shows "click to spin" before a result', () => {
    renderWheel({ hasResult: false })
    expect(screen.getByText('click to spin')).toBeInTheDocument()
  })

  it('shows "click to re-spin" once a result exists', () => {
    renderWheel({ hasResult: true })
    expect(screen.getByText('click to re-spin')).toBeInTheDocument()
  })
})

describe('AssignmentWheel spinning', () => {
  it('disables the button and shows "assigning…" while a spin is in flight', async () => {
    // requestAnimationFrame stores the callback but never invokes it -> spin never completes
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    const user = userEvent.setup()
    const props = renderWheel()
    await user.click(
      screen.getByRole('button', { name: 'Spin the TEST WHEEL wheel' }),
    )
    expect(screen.getByText('assigning…')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Spin the TEST WHEEL wheel' }),
    ).toBeDisabled()
    expect(props.sound.ensureAudio).toHaveBeenCalledTimes(1)
    expect(props.onSpinEnd).not.toHaveBeenCalled()
  })

  it('reports the forced target index when the spin completes', async () => {
    // invoke the rAF callback once with a timestamp far past the duration -> p=1 -> completes
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(1e9)
      return 1
    })
    const user = userEvent.setup()
    const props = renderWheel({ randomFn: () => 0 }) // targetIndex = floor(0*6) = 0
    await user.click(
      screen.getByRole('button', { name: 'Spin the TEST WHEEL wheel' }),
    )
    expect(props.onSpinEnd).toHaveBeenCalledWith(0)
    expect(props.sound.ding).toHaveBeenCalledTimes(1)
  })

  it('starts a spin from keyboard activation', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    const user = userEvent.setup()
    renderWheel()
    const button = screen.getByRole('button', {
      name: 'Spin the TEST WHEEL wheel',
    })
    button.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('assigning…')).toBeInTheDocument()
  })
})
