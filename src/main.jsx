import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// /admin is code-split so public visitors never download the OIDC stack.
// CloudFront's SPA fallback (403/404 -> index.html) makes the path load.
const AdminApp = React.lazy(() => import('./admin/AdminApp.jsx'))
const isAdmin = window.location.pathname.replace(/\/$/, '') === '/admin'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? (
      <React.Suspense fallback={<p>Loading…</p>}>
        <AdminApp />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
