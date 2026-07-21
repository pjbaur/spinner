import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App.jsx'

describe('App', () => {
  it('renders the Jerry assignment wheel view', () => {
    render(<App />)
    expect(screen.getByText('What will Jerry teach next?')).toBeInTheDocument()
    expect(screen.getByText('TEACHING ENVIRONMENT')).toBeInTheDocument()
    expect(screen.getByText('TEACHING SUBJECT')).toBeInTheDocument()
  })
})
