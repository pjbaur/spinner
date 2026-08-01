import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfigEditor from './ConfigEditor.jsx'
import { loadConfig, saveConfig, ConfigSaveError } from './configApi.js'

vi.mock('./configApi.js', async () => {
  const actual = await vi.importActual('./configApi.js')
  return {
    ...actual,
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
  }
})

const CONFIG = {
  version: 1,
  environments: ['Gym', 'Pool'],
  subjects: ['Math', 'Art'],
}

beforeEach(() => {
  vi.clearAllMocks()
  loadConfig.mockResolvedValue(CONFIG)
  saveConfig.mockResolvedValue(undefined)
})

async function renderLoaded() {
  render(<ConfigEditor idToken="tok" />)
  await waitFor(() =>
    expect(screen.getByDisplayValue('Gym')).toBeInTheDocument(),
  )
}

describe('ConfigEditor', () => {
  it('loads and shows both lists', async () => {
    await renderLoaded()
    for (const value of ['Gym', 'Pool', 'Math', 'Art']) {
      expect(screen.getByDisplayValue(value)).toBeInTheDocument()
    }
  })

  it('adds an entry and saves the edited config', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.click(
      screen.getByRole('button', { name: 'Add environment entry' }),
    )
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[2], 'Rooftop')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith(
        {
          version: 1,
          environments: ['Gym', 'Pool', 'Rooftop'],
          subjects: ['Math', 'Art'],
        },
        'tok',
      ),
    )
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('removes an entry', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.click(
      screen.getAllByRole('button', { name: 'Remove environments entry 1' })[0],
    )
    expect(screen.queryByDisplayValue('Gym')).not.toBeInTheDocument()
  })

  it('disables Save while the config is invalid', async () => {
    const user = userEvent.setup()
    await renderLoaded()
    await user.clear(screen.getByDisplayValue('Gym'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(
      screen.getByText('environments[0] must be a non-empty string'),
    ).toBeInTheDocument()
  })

  it('shows server errors from a failed save', async () => {
    const user = userEvent.setup()
    saveConfig.mockRejectedValue(
      new ConfigSaveError(400, ['version must be 1']),
    )
    await renderLoaded()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('version must be 1')).toBeInTheDocument()
  })

  it('restarts sign-in when the session has expired', async () => {
    const user = userEvent.setup()
    const onAuthExpired = vi.fn()
    saveConfig.mockRejectedValue(new ConfigSaveError(401, ['unauthorized']))
    render(<ConfigEditor idToken="tok" onAuthExpired={onAuthExpired} />)
    await waitFor(() =>
      expect(screen.getByDisplayValue('Gym')).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onAuthExpired).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})
