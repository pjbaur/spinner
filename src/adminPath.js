// Single source of truth for the /admin route so main.jsx's route match and
// AdminApp.jsx's OIDC redirect_uri/callback can never drift apart.
export const ADMIN_PATH = '/admin'
