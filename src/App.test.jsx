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
    const editorA = screen.getByLabelText('Wheel A items')
    const editorB = screen.getByLabelText('Wheel B items')
    expect(editorA).toBeInTheDocument()
    expect(editorB).toBeInTheDocument()

    fireEvent.change(editorA, { target: { value: 'Only Wheel A Item' } })
    fireEvent.blur(editorA)

    expect(JSON.parse(localStorage.getItem('spinner.wheelA'))).toEqual(['Only Wheel A Item'])
    expect(localStorage.getItem('spinner.wheelB')).toBeNull()
  })

  it('gives each wheel a distinct, name-derived spin button', () => {
    render(<App />)

    const buttonA = screen.getByRole('button', { name: 'Spin Wheel A' })
    const buttonB = screen.getByRole('button', { name: 'Spin Wheel B' })

    expect(buttonA).toBeInTheDocument()
    expect(buttonB).toBeInTheDocument()
    expect(buttonA).not.toBe(buttonB)
  })

  it('gives each wheel a distinct, name-derived item textarea label', () => {
    render(<App />)

    const editorA = screen.getByLabelText('Wheel A items')
    const editorB = screen.getByLabelText('Wheel B items')

    expect(editorA).not.toBe(editorB)
  })
})
