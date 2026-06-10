'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts';
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

  // --- MOTOR DE CÁLCULO MATEMÁTICO (KPI) ---
  const calculateKpiValue = (widget) => {
    if (!candidatesData || candidatesData.length === 0) return 0;
    
    const filteredBase = widget.status_filter === 'Todos' 
      ? candidatesData 
      : candidatesData.filter(c => c.status === widget.status_filter);

    if (widget.metric_type === 'count') return filteredBase.length;

    // AVALIAÇÃO DA FÓRMULA MATEMÁTICA E DECIMAL
    if (widget.metric_type === 'date_diff') {
      const { dateStart, dateEnd } = widget.advanced_config || {};
      if (!dateStart || !dateEnd) return 'Config. Incorreta';

      let totalDays = 0;
      let validItems = 0;

      filteredBase.forEach(c => {
        if (c[dateEnd] && c[dateStart]) {
          const dEnd = new Date(c[dateEnd]);
          const dStart = new Date(c[dateStart]);
          const diffInTime = dEnd.getTime() - dStart.getTime();
          const diffInDays = diffInTime / (1000 * 3600 * 24);
          totalDays += diffInDays;
          validItems++;
        }
      });

      if (validItems === 0) return '0.0 dias';
      const avg = (totalDays / validItems).toFixed(1); // Formato Decimal solicitado!
      return `${avg} dias`;
    }
    
    return 0;
  };

  // --- MOTOR DE CÁLCULO MATEMÁTICO (GRÁFICOS) ---
  const generateChartData = (widget) => {
    if (!candidatesData || candidatesData.length === 0) return [];

    const monthsMap = { 0: 'Jan', 1: 'Fev', 2: 'Mar', 3: 'Abr', 4: 'Mai', 5: 'Jun', 6: 'Jul', 7: 'Ago', 8: 'Set', 9: 'Out', 10: 'Nov', 11: 'Dez' };
    const defaultMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const grouped = {};
    defaultMonths.forEach(m => { grouped[m] = { name: m, valor: 0, _sumDays: 0, _validCount: 0 }; });

    candidatesData.forEach(c => {
      if (widget.status_filter !== 'Todos' && c.status !== widget.status_filter) return;
      
      const referenceDate = c.admission_date || c.created_at;
      if (!referenceDate) return;
      
      const monthName = monthsMap[new Date(referenceDate).getMonth()];
      if (!monthName) return;

      // CONTAGEM COMUM
      if (widget.metric_type === 'count' || widget.metric_type === 'monthly') {
        grouped[monthName].valor++;
      }
      // FÓRMULA MATEMÁTICA NO GRÁFICO
      else if (widget.metric_type === 'date_diff') {
        const { dateStart, dateEnd } = widget.advanced_config || {};
        if (c[dateEnd] && c[dateStart]) {
          const diff = (new Date(c[dateEnd]) - new Date(c[dateStart])) / (1000 * 3600 * 24);
          grouped[monthName]._sumDays += diff;
          grouped[monthName]._validCount++;
        }
      }
    });

    // Finaliza as médias decimais caso seja operação de datas
    if (widget.metric_type === 'date_diff') {
      return Object.values(grouped).map(g => ({
        name: g.name,
        valor: g._validCount > 0 ? parseFloat((g._sumDays / g._validCount).toFixed(1)) : 0
      }));
    }

    return Object.values(grouped);
  };

  // Tooltip customizado para formatar com "dias" se for SLA
  const CustomTooltip = ({ active, payload, label, isDecimal }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{label}</p>
          <p style={{ color: payload[0].color, fontWeight: '600' }}>
            {payload[0].name}: {payload[0].value} {isDecimal ? 'dias' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Avaliando fórmulas avançadas e calculando o painel...</p>;

  const kpiCards = dashboardWidgets.filter(w => w.chart_type === 'kpi');
  const charts = dashboardWidgets.filter(w => w.chart_type !== 'kpi');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div style={{ marginBottom: '-0.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
          Olá, {userName}! 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Seus indicadores e cálculos configurados sob medida.</p>
      </div>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Baseado em: {kpi.status_filter}</p>
                {kpi.advanced_config?.targetValue && (
                  <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--danger-color)' }}>Meta: {kpi.advanced_config.targetValue}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {charts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
          {charts.map((chart) => {
            const chartData = generateChartData(chart);
            const isMath = chart.metric_type === 'date_diff';
            const metaX = chart.advanced_config?.targetValue ? parseFloat(chart.advanced_config.targetValue) : null;

            return (
              <div key={chart.id} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)' }}>{chart.title}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isMath ? 'Cálculo Decimal de SLA' : 'Volume Geral'} • Filtro: {chart.status_filter}</p>
                </div>
                
                <div style={{ height: '300px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chart.chart_type === 'bar' ? (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora', fontSize: 12}} />
                        <Tooltip content={<CustomTooltip isDecimal={isMath} />} />
                        
                        {/* A LINHA DE META RENDERIZA AQUI */}
                        {metaX && <ReferenceLine y={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'top', value: 'META SLA', fill: 'var(--danger-color)', fontSize: 11, fontWeight: 'bold' }} />}
                        
                        <Bar dataKey="valor" fill={chart.color} radius={[4, 4, 0, 0]} name={isMath ? "Média de Dias" : "Quantidade"} />
                      </BarChart>
                    ) : (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontFamily: 'Sora', fontSize: 12}} />
                        <Tooltip content={<CustomTooltip isDecimal={isMath} />} />
                        
                        {/* A LINHA DE META RENDERIZA AQUI */}
                        {metaX && <ReferenceLine y={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'top', value: 'META SLA', fill: 'var(--danger-color)', fontSize: 11, fontWeight: 'bold' }} />}

                        <Line type="monotone" dataKey="valor" stroke={chart.color} strokeWidth={3} dot={{ r: 4, fill: 'var(--surface-color)', strokeWidth: 2 }} name={isMath ? "Média de Dias" : "Quantidade"} />
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
