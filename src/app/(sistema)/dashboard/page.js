'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, UserCheck, Clock, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const [userName, setUserName] = useState('');
  const [metrics, setMetrics] = useState({
    totalCandidates: 0,
    admittedCount: 0,
    approvalRate: 0,
    chartData: []
  });
  const [loading, setLoading] = useState(true);

  const fetchApi = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      const extracted = json.data || json;
      return Array.isArray(extracted) ? extracted : [];
    } catch (error) {
      console.error(`Erro ao buscar ${url}:`, error);
      return [];
    }
  };

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const sessionUser = await fetch('/api/users/me').then(r => r.ok ? r.json() : null).catch(() => null);
        if (sessionUser) {
          const fullName = sessionUser.data?.name || sessionUser.name || sessionUser.email || 'Colaborador';
          setUserName(fullName.split(' ')[0]); 
        }

        const candidates = await fetchApi('/api/candidates');

        if (candidates && candidates.length > 0) {
          const total = candidates.length;
          const admitted = candidates.filter(c => c.status === 'Concluído').length;
          const rate = total > 0 ? Math.round((admitted / total) * 100) : 0;

          const monthsMap = {
            0: 'Jan', 1: 'Fev', 2: 'Mar', 3: 'Abr', 4: 'Mai', 5: 'Jun',
            6: 'Jul', 7: 'Ago', 8: 'Set', 9: 'Out', 10: 'Nov', 11: 'Dez'
          };

          // INICIALIZA OS 12 MESES DO ANO
          const defaultMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          const grouped = {};
          
          defaultMonths.forEach(m => {
            grouped[m] = { name: m, admitidos: 0, reprovados: 0 };
          });

          candidates.forEach(c => {
            // A MÁGICA ACONTECE AQUI: Prioriza a data de admissão. Se não tiver, usa a de criação (para reprovados)
            const referenceDate = c.admission_date || c.created_at;
            
            if(!referenceDate) return;
            
            const date = new Date(referenceDate);
            const monthName = monthsMap[date.getMonth()];
            
            if (monthName) {
              if (c.status === 'Concluído') grouped[monthName].admitidos++;
              if (c.status === 'Reprovado') grouped[monthName].reprovados++;
            }
          });

          setMetrics({
            totalCandidates: total,
            admittedCount: admitted,
            approvalRate: rate,
            chartData: Object.values(grouped)
          });
        }
      } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const kpis = [
    { title: 'Total de Candidatos', value: metrics.totalCandidates, icon: <Users size={24} color="var(--saritur-orange)" />, trend: 'Dados em tempo real' },
    { title: 'Admitidos', value: metrics.admittedCount, icon: <UserCheck size={24} color="var(--success-color)" />, trend: 'Processos concluídos' },
    { title: 'Tempo Médio (Leadtime)', value: 'Apurando', icon: <Clock size={24} color="var(--saritur-yellow)" />, trend: 'Necessita histórico' },
    { title: 'Taxa de Aprovação', value: `${metrics.approvalRate}%`, icon: <TrendingUp size={24} color="var(--saritur-brown)" />, trend: 'Média geral' },
  ];

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Carregando painel e métricas de desempenho...</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ marginBottom: '-0.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Olá, {userName}! 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Aqui está o resumo das suas métricas de recrutamento e performance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {kpis.map((kpi, idx) => (
          <div key={idx} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>{kpi.title}</p>
                <h3 style={{ color: 'var(--text-main)', fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.02em' }}>{kpi.value}</h3>
              </div>
              <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                {kpi.icon}
              </div>
            </div>
            <p style={{ color: 'var(--success-color)', fontSize: '0.875rem', fontWeight: '500' }}>{kpi.trend}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Visão Geral de Contratações</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora'}} />
                <Tooltip cursor={{ fill: 'var(--bg-color)' }} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'Sora'}} />
                <Bar dataKey="admitidos" fill="var(--saritur-orange)" radius={[4, 4, 0, 0]} name="Admitidos" />
                <Bar dataKey="reprovados" fill="var(--border-color)" radius={[4, 4, 0, 0]} name="Reprovados" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Histórico Mensal</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora'}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'Sora'}} />
                <Line type="monotone" dataKey="admitidos" stroke="var(--saritur-brown)" strokeWidth={3} dot={{ r: 4, fill: 'var(--surface-color)', strokeWidth: 2 }} name="Admitidos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
