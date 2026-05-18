'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, UserCheck, Clock, TrendingUp } from 'lucide-react';

const data = [
  { name: 'Jan', admitidos: 12, reprovados: 4 },
  { name: 'Fev', admitidos: 19, reprovados: 7 },
  { name: 'Mar', admitidos: 15, reprovados: 5 },
  { name: 'Abr', admitidos: 22, reprovados: 8 },
  { name: 'Mai', admitidos: 28, reprovados: 10 },
];

export default function DashboardPage() {
  const kpis = [
    { title: 'Total de Candidatos', value: '148', icon: <Users size={24} color="var(--saritur-orange)" />, trend: '+12% este mês' },
    { title: 'Admitidos', value: '96', icon: <UserCheck size={24} color="var(--success-color)" />, trend: '+5% este mês' },
    { title: 'Tempo Médio (Leadtime)', value: '14 dias', icon: <Clock size={24} color="var(--saritur-yellow)" />, trend: '-2 dias este mês' },
    { title: 'Taxa de Aprovação', value: '64%', icon: <TrendingUp size={24} color="var(--saritur-brown)" />, trend: '+2% este mês' },
  ];

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
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Visão Geral de Contratações (2026)</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
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
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-main)' }}>Evolução do Leadtime</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora'}} />
                <YAxis axisLine={false} tickLine={false} domain={[0, 25]} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora'}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'Sora'}} />
                <Line type="monotone" dataKey="admitidos" stroke="var(--saritur-brown)" strokeWidth={3} dot={{ r: 4, fill: 'var(--surface-color)', strokeWidth: 2 }} name="Dias" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
