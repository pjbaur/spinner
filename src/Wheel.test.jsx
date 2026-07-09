import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import Wheel from './Wheel.jsx'

beforeEach(() => {
  localStorage.clear()
})

describe('Wheel rendering', () => {
  it('renders one slice path and label per item', () => {
    render(<Wheel storageKey="wheel.render-test" defaultItems={['Pizza', 'Tacos', 'Sushi']} />)

    const svg = screen.getByTestId('wheel-svg')
    expect(svg.querySelectorAll('path')).toHaveLength(3)
    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Tacos')).toBeInTheDocument()
    expect(screen.getByText('Sushi')).toBeInTheDocument()
  })
})

describe('Wheel spin', () => {
  it('shows the winner after the spin transition ends', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    render(<Wheel storageKey="wheel.spin-test-1" defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']} />)
    const svg = screen.getByTestId('wheel-svg')

    expect(screen.getByTestId('winner')).toHaveTextContent('')

    fireEvent.click(svg)
    // propertyName is ignored by the handler (jsdom has no TransitionEvent
    // to carry it) -- kept here since it documents intent for a reader.
    fireEvent.transitionEnd(svg, { propertyName: 'transform' })

    expect(screen.getByTestId('winner')).toHaveTextContent('Winner: Pizza')

    Math.random.mockRestore()
  })

  it('ignores clicks while already spinning', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)

    render(<Wheel storageKey="wheel.spin-test-2" defaultItems={['Pizza', 'Tacos', 'Sushi', 'Burgers']} />)
    const svg = screen.getByTestId('wheel-svg')

    fireEvent.click(svg)
    const rotationAfterFirstClick = svg.style.transform
    fireEvent.click(svg)
    expect(svg.style.transform).toBe(rotationAfterFirstClick)

    randomSpy.mockRestore()
  })
})

describe('Wheel item editor', () => {
  it('shows current items in the textarea, one per line', () => {
    render(<Wheel storageKey="wheel.editor-test-1" defaultItems={['Pizza', 'Tacos']} />)
    const textarea = screen.getByLabelText('wheel items')
    expect(textarea).toHaveValue('Pizza\nTacos')
  })

  it('re-parses and persists items on blur', () => {
    render(<Wheel storageKey="wheel.editor-test-2" defaultItems={['Pizza']} />)
    const textarea = screen.getByLabelText('wheel items')

    fireEvent.change(textarea, { target: { value: 'Burgers\nFries\n' } })
    fireEvent.blur(textarea)

    expect(JSON.parse(localStorage.getItem('wheel.editor-test-2'))).toEqual(['Burgers', 'Fries'])
    const svg = screen.getByTestId('wheel-svg')
    expect(svg.querySelectorAll('path')).toHaveLength(2)
  })

  it('disables spinning and shows a hint when the list is empty', () => {
    render(<Wheel storageKey="wheel.editor-test-3" defaultItems={['Pizza']} />)
    const textarea = screen.getByLabelText('wheel items')

    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.blur(textarea)

    expect(screen.getByTestId('empty-hint')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('wheel-svg'))
    expect(screen.getByTestId('winner')).toHaveTextContent('')
  })
})
