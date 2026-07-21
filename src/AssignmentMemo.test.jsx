import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssignmentMemo from './AssignmentMemo.jsx'

function renderMemo(overrides = {}) {
  const props = {
    teacherName: 'Jerry',
    subject: 'P.E.',
    environment: 'Kindergarten',
    effectiveDate: 'Monday, July 27, 2026',
    fileNo: 'SP-4821-KT',
    onFileNewRequest: vi.fn(),
    ...overrides,
  }
  render(<AssignmentMemo {...props} />)
  return props
}

describe('AssignmentMemo', () => {
  it('renders the interim assignment notice with chosen values', () => {
    renderMemo()
    expect(screen.getByText('INTERIM ASSIGNMENT NOTICE')).toBeInTheDocument()
    expect(screen.getByText('P.E.')).toBeInTheDocument()
    expect(screen.getByText('Kindergarten')).toBeInTheDocument()
    expect(screen.getByText('Jerry', { exact: false })).toBeInTheDocument()
    expect(
      screen.getByText(/Monday, July 27, 2026, until further notice\./),
    ).toBeInTheDocument()
    expect(screen.getByText('FILE SP-4821-KT')).toBeInTheDocument()
  })

  it('fires onFileNewRequest when the button is clicked', async () => {
    const user = userEvent.setup()
    const props = renderMemo()
    await user.click(screen.getByRole('button', { name: 'FILE NEW REQUEST' }))
    expect(props.onFileNewRequest).toHaveBeenCalledTimes(1)
  })
})
