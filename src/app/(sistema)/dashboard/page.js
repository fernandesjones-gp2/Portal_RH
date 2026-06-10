'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  const [userName, setUserName] = useState('');
  const [dashboardWidgets, setDashboardWidgets] = useState([]);
  const [candidatesData, setCandidatesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const sessionUser = await api.me();
        let userRole = '';
        if (sessionUser) {
          const fullName = sessionUser.data?.name || sessionUser.name || sessionUser.email || 'Colaborador';
          setUserName(fullName.split(' ')[0]); 
          userRole = sessionUser.data?.role || sessionUser.role || sessionUser[0]?.role || '';
        }

        const [candsRes, widgetsRes] = await Promise.all([
          api.candidates.list().catch(() => []),
          api.dashboardWidgets.list().catch(() => [])
        ]);

        if (candsRes) setCandidatesData(candsRes);
        
        // FILTRA AS PEÇAS DE ACORDO COM A PERMISSÃO DO USUÁRIO LOGADO
        if (widgetsRes) {
          const authorizedWidgets = widgetsRes.filter(w => w.roles_visible.includes(userRole));
          setDashboardWidgets(authorizedWidgets);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  // --- MOTOR DE CÁLCULO DINÂMICO ---
  const calculateKpiValue = (widget) => {
    if (!candidatesData || candidatesData.length === 0) return 0;
    
    // Filtra a base baseada na regra da peça
    const filteredBase = widget.status_filter === 'Todos' 
      ? candidatesData 
      : candidatesData.filter(c => c.status === widget.status_filter);

    if (widget.metric_type === 'count') {
      return filteredBase.length;
    } 
    
    if (widget.metric_type === 'rate') {
      const total = candidatesData.length;
      return total > 0 ? Math.round((filteredBase.length / total) * 100) + '%' : '0%';
    }
    return 0;
  };

  const generateChartData = (widget) => {
    if (!candidatesData || candidatesData.length === 0) return [];

    const monthsMap = { 0: 'Jan', 1: 'Fev', 2: 'Mar', 3: 'Abr', 4: 'Mai', 5: 'Jun', 6: 'Jul', 7: 'Ago', 8: 'Set', 9: 'Out', 10: 'Nov', 11: 'Dez' };
    const defaultMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const grouped = {};
    defaultMonths.forEach(m => { grouped[m] = { name: m, valor: 0 }; });

    candidatesData.forEach(c => {
      // Aplica o filtro da peça
      if (widget.status_filter !== 'Todos' && c.status !== widget.status_filter) return;
      
      const referenceDate = c.admission_date || c.created_at;
      if (!referenceDate) return;
      
      const date = new Date(referenceDate);
      const monthName = monthsMap[date.getMonth()];
      
      if (monthName) {
        grouped[monthName].valor++;
      }
    });

    return Object.values(grouped);
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Construindo o seu painel dinâmico...</p>;

  // Separa as peças para organizar na tela
  const kpiCards = dashboardWidgets.filter(w => w.chart_type === 'kpi');
  const charts = dashboardWidgets.filter(w => w.chart_type !== 'kpi');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ marginBottom: '-0.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Olá, {userName}! 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Seus indicadores configurados sob medida.</p>
      </div>

      {dashboardWidgets.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--surface-color)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)' }}>Nenhum indicador foi configurado ou autorizado para o seu perfil. Peça ao Administrador para criar gráficos nas Configurações.</p>
        </div>
      )}

      {/* RENDERIZA OS CARTÕES (KPIs) DINAMICAMENTE */}
      {kpiCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {kpiCards.map((kpi) => (
            <div key={kpi.id} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', borderTop: `4px solid ${kpi.color}`, borderBottom: '1px solid var(--border-color)', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{kpi.title}</p>
                  <h3 style={{ color: 'var(--text-main)', fontSize: '2.2rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                    {calculateKpiValue(kpi)}
                  </h3>
                </div>
                <div style={{ padding: '0.6rem', backgroundColor: 'var(--bg-color)', borderRadius: '50%' }}>
                  <LayoutDashboard size={20} color={kpi.color} />
                </div>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Baseado em: {kpi.status_filter}</p>
            </div>
          ))}
        </div>
      )}

      {/* RENDERIZA OS GRÁFICOS (Barras ou Linhas) DINAMICAMENTE */}
      {charts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
          {charts.map((chart) => {
            const chartData = generateChartData(chart);
            return (
              <div key={chart.id} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)' }}>{chart.title}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filtro Aplicado: {chart.status_filter}</p>
                </div>
                
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chart.chart_type === 'bar' ? (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora', fontSize: 12}} />
                        <Tooltip cursor={{ fill: 'var(--bg-color)' }} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'Sora'}} />
                        <Bar dataKey="valor" fill={chart.color} radius={[4, 4, 0, 0]} name="Qtd" />
                      </BarChart>
                    ) : (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora', fontSize: 12}} />
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: 'Sora'}} />
                        <Line type="monotone" dataKey="valor" stroke={chart.color} strokeWidth={3} dot={{ r: 4, fill: 'var(--surface-color)', strokeWidth: 2 }} name="Qtd" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
