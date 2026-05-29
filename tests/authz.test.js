import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocka a sessão (auth) e o banco (query) para testar o branching de
// autorização de forma determinística (cobre I4 a nível de helper).
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({ query: vi.fn() }));

const { auth } = await import('@/auth');
const { query } = await import('@/lib/db');
const { requireAuth, requireApproved, requireAdmin } = await import('@/lib/api-helpers');

function mockUser(user) {
  auth.mockResolvedValue(user ? { user: { email: user.email } } : null);
  query.mockResolvedValue({ rows: user ? [user] : [] });
}

beforeEach(() => {
  auth.mockReset();
  query.mockReset();
});

describe('autorização (api-helpers)', () => {
  it('requireAuth: 401 sem sessão', async () => {
    mockUser(null);
    const r = await requireAuth();
    expect(r.error.status).toBe(401);
  });

  it('requireApproved: 403 para usuário Pendente', async () => {
    mockUser({ id: '1', email: 'a@x.com', role: 'RECRUITER', status: 'Pendente' });
    const r = await requireApproved();
    expect(r.error.status).toBe(403);
  });

  it('requireApproved: ok para usuário Aprovado', async () => {
    mockUser({ id: '1', email: 'a@x.com', role: 'RECRUITER', status: 'Aprovado' });
    const r = await requireApproved();
    expect(r.error).toBeUndefined();
    expect(r.user.email).toBe('a@x.com');
  });

  it('requireAdmin: 403 para não-admin aprovado', async () => {
    mockUser({ id: '1', email: 'a@x.com', role: 'RECRUITER', status: 'Aprovado' });
    const r = await requireAdmin();
    expect(r.error.status).toBe(403);
  });

  it('requireAdmin: ok para ADMIN aprovado', async () => {
    mockUser({ id: '1', email: 'admin@x.com', role: 'ADMIN', status: 'Aprovado' });
    const r = await requireAdmin();
    expect(r.error).toBeUndefined();
    expect(r.user.role).toBe('ADMIN');
  });
});
