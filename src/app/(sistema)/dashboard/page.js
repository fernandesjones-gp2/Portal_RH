'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Users, UserCheck, Clock, TrendingUp, AlertTriangle, BarChart3, Target, Activity, SearchX } from 'lucide-react';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ativos: 0,
    concluidos: 0,
    promocoesAtivas: 0,
    leadTime: 0,
    funil: {},
    gargalos: [],
    tipos: {}
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [candsRes, promosRes] = await Promise.all([
        api.candidates.list({ _t: Date.now() }).catch(() => []),
        // Busca usando fetch nativo para evitar problemas de cache
        fetch('/api/promotions?_t=' + Date.now()).then(res => res.json()).catch(() => [])
      ]);

      const cands = Array.isArray(candsRes) ? candsRes : [];
      const promos = Array.isArray(promosRes) ? promosRes : [];

      // 1. KPIs PRINCIPAIS
      const ativos = cands.filter(c => !['Concluído', 'Cancelado', 'Reprovado'].includes(c.status)).length;
      const concluidos = cands.filter(c => c.status === 'Concluído').length;
      const promocoesAtivas = promos.filter(p => !['Concluído', 'Cancelado', 'Reprovado pela Liderança'].includes(p.status)).length;

      // 2. LEAD TIME (SLA Médio de Admissão)
      const concluidosAdmissao = cands.filter(c => c.status === 'Concluído' && c.admission_date && c.created_at);
      let sumDays = 0;
      concluidosAdmissao.forEach(c => {
        const diffTime = Math.abs(new Date(c.admission_date) - new Date(c.created_at));
        sumDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      });
      const leadTime = concluidosAdmissao.length > 0 ? (sumDays / concluidosAdmissao.length).toFixed(0) : 0;

      // 3. FUNIL DE R&S (Agrupamento de Status)
      const funil = {
        '1. Triagem / Banco': cands.filter(c => c.status === 'Cadastrado').length,
        '2. Entrevistas (Psi)': cands.filter(c => c.status === 'Agendado' || c.status === 'Reagendado').length,
        '3. Exames / Retorno': cands.filter(c => c.status === 'Aprovado' || c.status === 'Aprovado com Ressalva' || c.status === 'Em Análise do Médico').length,
        '4. Documentação DP': cands.filter(c => c.status === 'Aprovado pelo Médico' || c.status === 'Pré-Admissão (Pronto)').length
      };

      // 4. TIPOS DE PROCESSO
      const tipos = {
        'Admissão Normal': cands.filter(c => c.process_type === 'Admissão').length,
        'Readmissão': cands.filter(c => c.process_type === 'Readmissão').length,
        'Promoção Interna': promos.length
      };

      // 5. RADAR DE GARGALOS (Parados há mais de 5 dias)
      const hoje = new Date();
      const gargalos = cands.filter(c => {
        if (['Concluído', 'Cancelado', 'Reprovado'].includes(c.status)) return false;
        const dataBase = new Date(c.updated_at || c.created_at);
        const diasParado = Math.floor((hoje - dataBase) / (1000 * 60 * 60 * 24));
        if (diasParado >= 5) {
          c.diasParado = diasParado;
          return true;
        }
        return false;
      }).sort((a, b) => b.diasParado - a.diasParado).slice(0, 5); // Pega os 5 mais críticos

      setStats({ ativos, concluidos, promocoesAtivas, leadTime, funil, gargalos, tipos });
    } catch (error) {
      console.error("Erro ao montar dashboard:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        <Activity size={48} color="var(--saritur-orange)" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
        <p>Calculando indicadores em tempo real...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Visão Geral (Dashboard)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Indicadores de R&S e Promoções em tempo real.</p>
        </div>
      </div>

      {/* BLOCO 1: KPIS PRINCIPAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', borderLeft: '4px solid #3b82f6', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '50%' }}>
            <Users size={28} color="#3b82f6" />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Pipeline de R&S (Ativos)</p>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', lineHeight: '1.2' }}>{stats.ativos}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '50%' }}>
            <UserCheck size={28} color="#10b981" />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Admissões Concluídas</p>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', lineHeight: '1.2' }}>{stats.concluidos}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', borderLeft: '4px solid #8b5cf6', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '1rem', borderRadius: '50%' }}>
            <TrendingUp size={28} color="#8b5cf6" />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Promoções em Esteira</p>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', lineHeight: '1.2' }}>{stats.promocoesAtivas}</h2>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', borderLeft: '4px solid var(--saritur-orange)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ backgroundColor: 'rgba(243, 113, 55, 0.1)', padding: '1rem', borderRadius: '50%' }}>
            <Clock size={28} color="var(--saritur-orange)" />
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>SLA Médio (Lead Time)</p>
            <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-main)', lineHeight: '1.2' }}>{stats.leadTime} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>dias</span></h2>
          </div>
        </div>

      </div>

      {/* BLOCO 2: GRÁFICOS E LISTAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* FUNIL CSS PURO */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <BarChart3 size={20} color="var(--saritur-orange)" /> Funil de Recrutamento
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {Object.entries(stats.funil).map(([etapa, valor], index) => {
              const cores = ['#9ca3af', '#3b82f6', '#f59e0b', '#10b981'];
              const maximo = stats.ativos > 0 ? stats.ativos : 1;
              const percentual = Math.min((valor / maximo) * 100, 100);
              
              return (
                <div key={etapa}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: '600' }}>{etapa}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{valor} cand.</span>
                  </div>
                  <div style={{ width: '100%', backgroundColor: 'var(--bg-color)', borderRadius: '999px', height: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: `${percentual}%`, backgroundColor: cores[index % cores.length], height: '100%', borderRadius: '999px', transition: 'width 1s ease-in-out' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RADAR DE GARGALOS */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color)' }}>
            <AlertTriangle size={20} /> Radar de Gargalos (+5 dias)
          </h3>
          
          {stats.gargalos.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle size={32} color="var(--success-color)" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Excelente! Nenhum candidato parado além do prazo limite.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats.gargalos.map(c => (
                <div key={c.id} style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-main)' }}>{c.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {c.status}</span>
                  </div>
                  <div style={{ backgroundColor: 'var(--danger-color)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {c.diasParado} dias
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VOLUME POR TIPO */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <Target size={20} color="var(--saritur-orange)" /> Volume por Tipo de Processo
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(stats.tipos).map(([tipo, valor]) => (
              <div key={tipo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-color)' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{tipo}</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{valor}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
