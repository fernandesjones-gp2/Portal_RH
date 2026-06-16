'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { TrendingUp, Clock, SearchX } from 'lucide-react';

export default function PromocoesPage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Busca a base de dados em tempo real (quebrando o cache)
      const allCandsData = await api.candidates.list({ _t: Date.now() });
      if (allCandsData) {
        // Filtra apenas os candidatos que receberam o carimbo especial de Promoção
        const promocoes = allCandsData.filter(c => c.status === 'Promoção (Em Andamento)');
        setCandidates(promocoes);
      }
    } catch (error) {
      console.error('Erro ao buscar promoções:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Gestão de Promoções</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Candidatos internos aprovados aguardando a estruturação do módulo definitivo de promoção.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Carregando promoções em andamento...</p>
      ) : candidates.length === 0 ? (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SearchX size={48} color="var(--border-color)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Nenhuma Promoção Estacionada</h3>
          <p style={{ color: 'var(--text-muted)' }}>Os candidatos aprovados na tela de Agendamentos aparecerão aqui.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {candidates.map(c => (
            <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', borderTop: '4px solid var(--saritur-yellow)', backgroundColor: 'var(--surface-color)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <TrendingUp size={20} color="var(--saritur-yellow)" />
                <span style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  Aprovado na Entrevista
                </span>
              </div>
              
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{c.name}</h3>
              
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <strong>Função Alvo:</strong> {c.job_roles?.name || c.job_role_name || 'N/A'} <br/>
                <strong>Unidade:</strong> {c.units?.name || c.unit_name || 'N/A'} <br/>
                <strong>CPF:</strong> {c.cpf}
              </p>

              <div style={{ backgroundColor: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} color="var(--text-muted)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Aguardando desenvolvimento do fluxo de aprovação final.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
