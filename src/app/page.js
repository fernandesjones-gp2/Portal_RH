'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (err) {
      setErrorMsg('Erro interno ao tentar fazer login.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '1rem' }}>
      <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '3rem 2.5rem', textAlign: 'center', background: 'var(--surface-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        <h1 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.02em' }}>Portal RH Saritur</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
          Gestão de Pessoas e Performance
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="btn-secondary"
          style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', color: 'var(--text-main)', boxShadow: 'var(--shadow-sm)' }}
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
          {loading ? 'Aguarde...' : 'Entrar com Google'}
        </button>

        {errorMsg && (
          <div style={{ width: '100%', color: 'var(--danger-color)', fontSize: '0.85rem', marginTop: '1rem', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
            {errorMsg}
          </div>
        )}
      </div>

      <p style={{ position: 'absolute', bottom: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Acesso restrito para colaboradores
      </p>
    </div>
  );
}
