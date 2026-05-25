'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      }
    }).catch(err => {
      console.error(err);
    });
  }, [router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) {
        setErrorMsg('Erro ao tentar conectar. Tente novamente.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg('Erro interno ao tentar fazer login.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', padding: '1rem' }}>
      <div className="glass-panel" style={{ maxWidth: '400px', width: '100%', padding: '3rem 2.5rem', textAlign: 'center', background: 'var(--surface-color)' }}>
        
        <h1 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.02em' }}>Portal RH Saritur</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
          Gestão de Pessoas e Performance
        </p>
        
        <button 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="btn-secondary" 
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '1rem', boxShadow: 'var(--shadow-sm)' }}
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" style={{ width: '18px', height: '18px', marginRight: '8px' }} />
          {loading ? 'Aguarde...' : 'Entrar com Google'}
        </button>

        {errorMsg && (
          <div style={{ color: 'var(--danger-color)', fontSize: '0.85rem', marginBottom: '1rem', marginTop: '-0.5rem', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
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
