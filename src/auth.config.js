import Google from 'next-auth/providers/google';

// Config base — EDGE-SAFE (sem import de 'pg').
// Usada pelo middleware (Edge runtime) e estendida no auth.js (Node runtime).
// As credenciais vêm do .env: AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET, AUTH_URL.
export const authConfig = {
  trustHost: true,
  providers: [Google],
  pages: {
    signIn: '/',
  },
  session: { strategy: 'jwt' },
};
