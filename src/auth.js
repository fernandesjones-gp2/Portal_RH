import NextAuth from 'next-auth';
import { randomUUID } from 'node:crypto';
import { authConfig } from './auth.config';
import { query } from '@/lib/db';

// Instância COMPLETA (Node runtime) — usada por Route Handlers e Server Components.
// Resolve/cria o usuário no Postgres por e-mail, preservando os UUIDs migrados.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    // Cria o usuário como 'Pendente' no primeiro login (bloqueado até aprovação).
    async signIn({ user }) {
      if (!user?.email) return false;
      const email = user.email.toLowerCase();
      const { rows } = await query('SELECT id FROM users WHERE lower(email) = $1', [email]);
      if (rows.length === 0) {
        await query(
          'INSERT INTO users (id, email, name, role, status) VALUES ($1, $2, $3, $4, $5)',
          [randomUUID(), email, user.name || email, 'RECRUITER', 'Pendente']
        );
      }
      return true;
    },
    // Guarda no token o id do banco (UUID migrado) e o e-mail normalizado.
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email.toLowerCase();
      if (token.email && !token.dbId) {
        const { rows } = await query('SELECT id, name FROM users WHERE lower(email) = $1', [token.email]);
        if (rows[0]) {
          token.dbId = rows[0].id;
          token.name = rows[0].name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.dbId;
        if (token.email) session.user.email = token.email;
        if (token.name) session.user.name = token.name;
      }
      return session;
    },
  },
});
