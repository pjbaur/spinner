import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
