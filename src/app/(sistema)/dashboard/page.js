'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, UserCheck, Clock, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    totalCandidates: 0,
    admittedCount: 0,
    approvalRate: 0,
    chartData: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Busca o status e a data de criação de todos os candidatos
        const { data: candidates, error } = await supabase
          .from('candidates')
          .select('status, created_at');

        if (error) throw error;

        if (candidates) {
          const total = candidates.length;
          const admitted = candidates.filter(c => c.status === 'Concluído').length;
          const rate = total > 0 ? Math.round((admitted / total) * 100) : 0;

          // Mapeamento de meses em português
          const monthsMap = {
            0: 'Jan', 1: 'Fev', 2: 'Mar', 3: 'Abr', 4: 'Mai', 5: 'Jun',
            6: 'Jul', 7: 'Ago', 8: 'Set', 9: 'Out', 10: 'Nov', 11: 'Dez'
          };

          // Inicializa os meses padrão para o gráfico não iniciar totalmente vazio
          const defaultMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai'];
          const grouped = {};
          
          defaultMonths.forEach(m => {
            grouped[m] = { name: m, admitidos: 0, reprovados: 0 };
          });

          // Contabiliza os candidatos reais por mês e status
          candidates.forEach(c => {
            const date = new Date(c.created_at);
            const monthName = monthsMap[date.getMonth()];
            
            if (monthName) {
              if (!grouped[monthName]) {
                grouped[monthName] = { name: monthName, admitidos: 0, reprovados: 0 };
              }
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
    { title: 'Total de Candidatos Real', value: metrics.totalCandidates, icon: <Users size={24} color="var(--saritur-orange)" />, trend: 'Dados em tempo real' },
    { title: 'Admitidos Real', value: metrics.admittedCount, icon: <UserCheck size={24} color="var(--success-color)" />, trend: 'Processos concluídos' },
    { title: 'Tempo Médio (Leadtime)', value: 'Apurando', icon: <Clock size={24} color="var(--saritur-yellow)" />, trend: 'Necessita histórico' },
    { title: 'Taxa de Aprovação Real', value: `${metrics.approvalRate}%`, icon: <TrendingUp size={24} color="var(--saritur-brown)" />, trend: 'Média geral' },
  ];

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Carregando métricas reais do banco de dados...</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* KPI Cards */}
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

      {/* Charts Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Visão Geral de Contratações Real</h3>
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
