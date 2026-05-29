import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Instância EDGE-SAFE (sem 'pg') só para proteger rotas. Redireciona
// usuários não autenticados das páginas internas para o login ("/").
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL('/', req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/agendamentos/:path*',
    '/pre-admissao/:path*',
    '/concluidos/:path*',
    '/promocoes/:path*',
    '/configuracoes/:path*',
  ],
};
