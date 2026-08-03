import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from 'react-oidc-context'
import AdminApp from './AdminApp.jsx'
import { ADMIN_PATH } from '../adminPath.js'

vi.mock('react-oidc-context', () => ({
  AuthProvider: vi.fn(({ children }) => children),
  useAuth: vi.fn(),
}))

// Gate's authenticated branch renders the real ConfigEditor; stub it so
// these tests only exercise Gate's own branching, not ConfigEditor's
// internals (covered separately in ConfigEditor.test.jsx).
vi.mock('./ConfigEditor.jsx', () => ({
  default: ({ idToken, onAuthExpired }) => (
    <div>
      <p>Config editor for {idToken}</p>
      <button type="button" onClick={onAuthExpired}>
        Expire session
      </button>
    </div>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdminApp', () => {
  it('wires the OIDC redirect and sign-in callback to the shared admin path', () => {
    useAuth.mockReturnValue({ isLoading: true })
    render(<AdminApp />)

    const props = AuthProvider.mock.calls[0][0]
    expect(props.redirect_uri).toBe(`${window.location.origin}${ADMIN_PATH}`)

    const replaceStateSpy = vi.spyOn(window.history, 'replaceState')
    props.onSigninCallback()
    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', ADMIN_PATH)
    replaceStateSpy.mockRestore()
  })

  it('shows a loading message while the session is being checked', () => {
    useAuth.mockReturnValue({
      isLoading: true,
      error: undefined,
      isAuthenticated: false,
    })
    render(<AdminApp />)

    expect(screen.getByText('Checking session…')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the auth error when sign-in fails', () => {
    useAuth.mockReturnValue({
      isLoading: false,
      error: new Error('network unreachable'),
      isAuthenticated: false,
    })
    render(<AdminApp />)

    expect(
      screen.getByText('Sign-in failed: network unreachable'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('prompts sign-in when unauthenticated and starts the redirect on click', async () => {
    const user = userEvent.setup()
    const signinRedirect = vi.fn()
    useAuth.mockReturnValue({
      isLoading: false,
      error: undefined,
      isAuthenticated: false,
      signinRedirect,
    })
    render(<AdminApp />)

    const button = screen.getByRole('button', {
      name: 'Sign in to edit wheel config',
    })
    expect(signinRedirect).not.toHaveBeenCalled()

    await user.click(button)
    expect(signinRedirect).toHaveBeenCalledTimes(1)
  })

  it('renders the config editor with the id token when authenticated', () => {
    useAuth.mockReturnValue({
      isLoading: false,
      error: undefined,
      isAuthenticated: true,
      user: { id_token: 'the-id-token' },
      signinRedirect: vi.fn(),
    })
    render(<AdminApp />)

    expect(
      screen.getByText('Config editor for the-id-token'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Checking session…')).not.toBeInTheDocument()
  })

  it('re-triggers sign-in when the config editor reports an expired session', async () => {
    const user = userEvent.setup()
    const signinRedirect = vi.fn()
    useAuth.mockReturnValue({
      isLoading: false,
      error: undefined,
      isAuthenticated: true,
      user: { id_token: 'the-id-token' },
      signinRedirect,
    })
    render(<AdminApp />)

    await user.click(screen.getByRole('button', { name: 'Expire session' }))
    expect(signinRedirect).toHaveBeenCalledTimes(1)
  })
})
