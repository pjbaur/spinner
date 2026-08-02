import { AuthProvider, useAuth } from 'react-oidc-context'
import ConfigEditor from './ConfigEditor.jsx'

const oidcConfig = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: `${window.location.origin}/admin`,
  scope: 'openid email',
  automaticSilentRenew: false,
  onSigninCallback: () => {
    // Strip ?code=&state= after the redirect back from the Hosted UI.
    window.history.replaceState({}, '', '/admin')
  },
}

export default function AdminApp() {
  return (
    <AuthProvider {...oidcConfig}>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const auth = useAuth()
  if (auth.isLoading) return <p>Checking session…</p>
  if (auth.error) return <p>Sign-in failed: {auth.error.message}</p>
  if (!auth.isAuthenticated) {
    return (
      <button type="button" onClick={() => auth.signinRedirect()}>
        Sign in to edit wheel config
      </button>
    )
  }
  return (
    <ConfigEditor
      idToken={auth.user?.id_token}
      onAuthExpired={() => auth.signinRedirect()}
    />
  )
}
