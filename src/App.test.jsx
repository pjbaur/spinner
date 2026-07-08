import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('renders the Spinner heading', () => {
    render(<App />)
    const heading = screen.getByRole('heading', { name: 'Spinner' })
    expect(heading).toBeDefined()
  })
})
