import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Wheel from './Wheel.jsx'

beforeEach(() => {
  localStorage.clear()
})

describe('Wheel rendering', () => {
  it('renders one slice path and label per item', () => {
    render(
      <Wheel storageKey="wheel.render-test" defaultItems={['Pizza', 'Tacos', 'Sushi']} name="Test Wheel" />,
    )

    const svg = screen.getByTestId('wheel-svg')
    expect(svg.querySelectorAll('path')).toHaveLength(3)
    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByText('Sushi')).toBeInTheDocument()
  })

  it('renders a single-item wheel as a full circle, not a degenerate wedge', () => {
    render(<Wheel storageKey="wheel.single-item-test" defaultItems={['Pizza']} name="Test Wheel" />)

    const svg = screen.getByTestId('wheel-svg')
    const paths = svg.querySelectorAll('path')
    expect(paths).toHaveLength(1)
    expect(paths[0].getAttribute('d').match(/A/g)).toHaveLength(2)
  })
})

describe('Wheel button semantics', () => {
  it('exposes the spin control as a real button with a name-derived accessible name', () => {
    render(
      <Wheel
        storageKey="wheel.button-name-test"
        defaultItems={['Pizza', 'Tacos']}
        name="Test Wheel"
      />,
    )

    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('disables the button when the item list is empty', () => {
    render(<Wheel storageKey="wheel.button-disabled-test" defaultItems={[]} name="Test Wheel" />)

    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })
    expect(button).toBeDisabled()
  })

  it('starts a spin when the button is focused and activated via keyboard (Enter)', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const user = userEvent.setup()

    render(
      <Wheel
        storageKey="wheel.keyboard-test"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })

    button.focus()
    expect(button).toHaveFocus()

    // user-event's keyboard module replays the browser's native default
    // action for Enter on a focused <button> (dispatching a real click),
    // unlike fireEvent.keyDown which is inert for native button activation
    // in jsdom. This only passes because the control is a genuine <button>
    // -- swapping it for a non-native focusable element (e.g. a div with
    // onClick and no keydown handling) makes this assertion fail.
    await user.keyboard('{Enter}')

    expect(button).toBeDisabled()

    const svg = screen.getByTestId('wheel-svg')
    fireEvent.transitionEnd(svg, { propertyName: 'transform' })

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    randomSpy.mockRestore()
  })
})

describe('Wheel winner announcement', () => {
  it('marks the winner element as a polite live region', () => {
    render(
      <Wheel storageKey="wheel.status-test" defaultItems={['Pizza', 'Tacos']} name="Test Wheel" />,
    )

    const winner = screen.getByTestId('winner')
    expect(winner).toHaveAttribute('role', 'status')
    expect(winner).toHaveAttribute('aria-live', 'polite')
  })
})

describe('Wheel reduced motion', () => {
  afterEach(() => {
    delete window.matchMedia
  })

  it('resolves the spin via the fallback timer in ~500ms with no transitionend when reduced motion is preferred', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })

    render(
      <Wheel
        storageKey="wheel.reduced-motion-test"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })

    fireEvent.click(button)
    expect(screen.getByTestId('winner')).toHaveTextContent('')

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    randomSpy.mockRestore()
    vi.useRealTimers()
  })
})

describe('Wheel spin', () => {
  it('shows the winner after the spin transition ends', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <Wheel
        storageKey="wheel.spin-test-1"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })
    const svg = screen.getByTestId('wheel-svg')

    expect(screen.getByTestId('winner')).toHaveTextContent('')

    fireEvent.click(button)
    // propertyName is ignored by the handler (jsdom has no TransitionEvent
    // to carry it) -- kept here since it documents intent for a reader.
    fireEvent.transitionEnd(svg, { propertyName: 'transform' })

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    Math.random.mockRestore()
  })

  it('ignores clicks while already spinning', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <Wheel
        storageKey="wheel.spin-test-2"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })
    const svg = screen.getByTestId('wheel-svg')

    fireEvent.click(button)
    const rotationAfterFirstClick = svg.style.transform
    fireEvent.click(button)
    expect(svg.style.transform).toBe(rotationAfterFirstClick)

    randomSpy.mockRestore()
  })

  it('resolves via a fallback timer when transitionend never fires, unlocking the wheel', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <Wheel
        storageKey="wheel.spin-test-3"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })
    const svg = screen.getByTestId('wheel-svg')

    fireEvent.click(button)
    expect(screen.getByTestId('winner')).toHaveTextContent('')

    // SPIN_DURATION_MS (4000) + 500ms fallback margin, transitionend never fires
    act(() => {
      vi.advanceTimersByTime(4500)
    })

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    const rotationAfterFirstSpin = svg.style.transform
    fireEvent.click(button)
    expect(svg.style.transform).not.toBe(rotationAfterFirstSpin)

    randomSpy.mockRestore()
    vi.useRealTimers()
  })

  it('resolves exactly once when transitionend fires before the fallback timer', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <Wheel
        storageKey="wheel.spin-test-4"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })
    const svg = screen.getByTestId('wheel-svg')

    fireEvent.click(button)
    fireEvent.transitionEnd(svg, { propertyName: 'transform' })

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(4500)
      })
    }).not.toThrow()

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    randomSpy.mockRestore()
    vi.useRealTimers()
  })

  it('disables the item editor while spinning and re-enables it after resolution', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <Wheel
        storageKey="wheel.spin-test-6"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })
    const svg = screen.getByTestId('wheel-svg')
    const textarea = screen.getByLabelText('Test Wheel items')

    expect(textarea).not.toBeDisabled()

    fireEvent.click(button)
    expect(textarea).toBeDisabled()

    fireEvent.transitionEnd(svg, { propertyName: 'transform' })

    expect(textarea).not.toBeDisabled()

    Math.random.mockRestore()
  })

  it('shows the winner snapshotted at spin time, unaffected by item edits before resolution', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(
      <Wheel
        storageKey="wheel.spin-test-7"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })
    const svg = screen.getByTestId('wheel-svg')
    const textarea = screen.getByLabelText('Test Wheel items')

    fireEvent.click(button)

    // Force an edit through mid-spin, bypassing the disabled textarea's
    // UI-level protection, to prove resolveSpin never re-reads `items`.
    fireEvent.change(textarea, { target: { value: 'Waffles\nPancakes' } })
    fireEvent.blur(textarea)

    fireEvent.transitionEnd(svg, { propertyName: 'transform' })

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    Math.random.mockRestore()
  })

  it('clears the fallback timer on unmount, leaving no pending timers', () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    const { unmount } = render(
      <Wheel
        storageKey="wheel.spin-test-5"
        defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']}
        name="Test Wheel"
      />,
    )
    const button = screen.getByRole('button', { name: 'Spin Test Wheel' })

    fireEvent.click(button)
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)

    randomSpy.mockRestore()
    vi.useRealTimers()
  })
})

describe('Wheel item editor', () => {
  it('shows current items in the textarea, one per line', () => {
    render(
      <Wheel storageKey="wheel.editor-test-1" defaultItems={['Pizza', 'Tacos']} name="Test Wheel" />,
    )
    const textarea = screen.getByLabelText('Test Wheel items')
    expect(textarea).toHaveValue('Pizza\nTacos')
  })

  it('re-parses and persists items on blur', () => {
    render(<Wheel storageKey="wheel.editor-test-2" defaultItems={['Pizza']} name="Test Wheel" />)
    const textarea = screen.getByLabelText('Test Wheel items')

    fireEvent.change(textarea, { target: { value: 'Burgers\nFries\n' } })
    fireEvent.blur(textarea)

    expect(JSON.parse(localStorage.getItem('wheel.editor-test-2'))).toEqual(['Burgers', 'Fries'])
    const svg = screen.getByTestId('wheel-svg')
    expect(svg.querySelectorAll('path')).toHaveLength(2)
  })

  it('disables spinning and shows a hint when the list is empty', () => {
    render(<Wheel storageKey="wheel.editor-test-3" defaultItems={['Pizza']} name="Test Wheel" />)
    const textarea = screen.getByLabelText('Test Wheel items')

    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.blur(textarea)

    expect(screen.getByTestId('empty-hint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Spin Test Wheel' }))
    expect(screen.getByTestId('winner')).toHaveTextContent('')
  })
})
