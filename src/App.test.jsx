import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App.jsx'

beforeEach(() => {
  localStorage.clear()
})

describe('App', () => {
  it('renders the Spinner heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Spinner' })).toBeInTheDocument()
  })

  it('renders two independent wheels with separate storage keys', () => {
    render(<App />)
    const editors = screen.getAllByLabelText('wheel items')
    expect(editors).toHaveLength(2)

    fireEvent.change(editors[0], { target: { value: 'Only Wheel A Item' } })
    fireEvent.blur(editors[0])

    expect(JSON.parse(localStorage.getItem('spinner.wheelA'))).toEqual(['Only Wheel A Item'])
    expect(localStorage.getItem('spinner.wheelB')).toBeNull()
  })
})
