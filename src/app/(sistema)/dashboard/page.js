'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
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
        if (widgetsRes) setDashboardWidgets(widgetsRes.filter(w => w.roles_visible.includes(userRole)));
      } catch (err) {} finally { setLoading(false); }
    }
    fetchDashboardData();
  }, []);

  // FORMATADOR UNIVERSAL (Inteiro, Decimal, Percentual)
  const formatValue = (val, formatRule) => {
    if (formatRule === 'decimal') return parseFloat(val.toFixed(1));
    if (formatRule === 'percent') return parseFloat(val.toFixed(2));
    return Math.round(val);
  };

  const calculateKpiValue = (widget) => {
    if (!candidatesData || candidatesData.length === 0) return 0;
    const config = widget.advanced_config || {};
    
    const filteredBase = widget.status_filter === 'Todos' ? candidatesData : candidatesData.filter(c => c.status === widget.status_filter);

    if (widget.metric_type === 'count') return filteredBase.length;

    if (widget.metric_type === 'date_diff') {
      const { dateStart, dateEnd, format } = config;
      if (!dateStart || !dateEnd) return 'Config. Incorreta';

      let totalDays = 0; let validItems = 0;
      filteredBase.forEach(c => {
        if (c[dateEnd] && c[dateStart]) {
          totalDays += (new Date(c[dateEnd]) - new Date(c[dateStart])) / (1000 * 3600 * 24);
          validItems++;
        }
      });
      if (validItems === 0) return '0';
      const avg = totalDays / validItems;
      return format === 'percent' ? `${formatValue(avg, format)}%` : formatValue(avg, format);
    }
    return 0;
  };

  const generateDynamicChartData = (widget) => {
    if (!candidatesData || candidatesData.length === 0) return [];
    const config = widget.advanced_config || {};
    const groupBy = config.groupBy || 'month';
    const grouped = {};

    // INICIALIZADORES
    if (groupBy === 'month') {
      const monthsMap = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      monthsMap.forEach(m => { grouped[m] = { name: m, valor: 0, _sum: 0, _count: 0 }; });
    }

    candidatesData.forEach(c => {
      if (widget.status_filter !== 'Todos' && c.status !== widget.status_filter) return;

      let groupKey = 'Não Classificado';
      if (groupBy === 'month') {
        const refDate = c.admission_date || c.created_at;
        if (!refDate) return;
        groupKey = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][new Date(refDate).getMonth()];
      } else if (groupBy === 'unit') {
        groupKey = c.units?.name || c.unit_name || 'Geral';
      } else if (groupBy === 'role') {
        groupKey = c.job_roles?.name || c.job_role_name || 'Sem Cargo';
      } else if (groupBy === 'recruiter') {
        groupKey = c.users?.name || c.responsible_name || 'Sistema';
      }

      if (!grouped[groupKey]) grouped[groupKey] = { name: groupKey, valor: 0, _sum: 0, _count: 0 };

      // CÁLCULOS
      if (widget.metric_type === 'count') {
        grouped[groupKey].valor++;
      } else if (widget.metric_type === 'date_diff') {
        const { dateStart, dateEnd } = config;
        if (c[dateEnd] && c[dateStart]) {
          grouped[groupKey]._sum += (new Date(c[dateEnd]) - new Date(c[dateStart])) / (1000 * 3600 * 24);
          grouped[groupKey]._count++;
        }
      }
    });

    // APLICA MÉDIAS E FORMATOS
    let finalArray = Object.values(grouped);
    if (widget.metric_type === 'date_diff') {
      finalArray = finalArray.map(g => ({
        name: g.name,
        valor: g._count > 0 ? formatValue(g._sum / g._count, config.format) : 0
      }));
    }

    // ORDENAÇÃO DINÂMICA
    if (groupBy !== 'month') {
      finalArray.sort((a, b) => b.valor - a.valor);
    }
    return finalArray;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{label}</p>
          <p style={{ color: payload[0].color, fontWeight: '600' }}>Registro: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Construindo o seu painel dinâmico...</p>;

  const kpiCards = dashboardWidgets.filter(w => w.chart_type === 'kpi');
  const charts = dashboardWidgets.filter(w => w.chart_type !== 'kpi');

  // Auxiliares de GRID para tamanho da tela
  const getGridSpan = (sizeConfig) => {
    if (sizeConfig === 'full') return '1 / -1'; // Ocupa a linha toda
    if (sizeConfig === 'third') return 'span 1'; // 1/3
    return 'span 2'; // half (Padrão, ocupa 2 blocos de um grid de 4)
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Olá, {userName}! 👋</h1>
        <p style={{ color: 'var(--text-muted)' }}>Seus indicadores avançados e cálculos configurados sob medida.</p>
      </div>

      {kpiCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {kpiCards.map((kpi) => (
            <div key={kpi.id} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', borderTop: `4px solid ${kpi.color}`, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem' }}>{kpi.title}</p>
                  <h3 style={{ color: 'var(--text-main)', fontSize: '2.2rem', fontWeight: '800', letterSpacing: '-0.02em' }}>{calculateKpiValue(kpi)}</h3>
                </div>
                <LayoutDashboard size={20} color={kpi.color} />
              </div>
              {kpi.advanced_config?.targetValue && <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--danger-color)', marginTop: '0.5rem' }}>Meta: {kpi.advanced_config.targetValue}</p>}
            </div>
          ))}
        </div>
      )}

      {/* RENDERIZADOR UNIVERSAL DE GRÁFICOS (Grid Responsivo Avançado) */}
      {charts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {charts.map((chart) => {
            const chartData = generateDynamicChartData(chart);
            const metaX = chart.advanced_config?.targetValue ? parseFloat(chart.advanced_config.targetValue) : null;
            const gridColumn = getGridSpan(chart.advanced_config?.size);

            return (
              <div key={chart.id} style={{ gridColumn, backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', minWidth: '0' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{chart.title}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Agrupado por: {chart.advanced_config?.groupBy || 'month'} • Base: {chart.status_filter}</p>
                
                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    
                    {/* BARRAS VERTICAIS */}
                    {chart.chart_type === 'bar' && (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" tick={{fontSize: 12}} /> <YAxis tick={{fontSize: 12}} />
                        <Tooltip content={<CustomTooltip />} />
                        {metaX && <ReferenceLine y={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" />}
                        <Bar dataKey="valor" fill={chart.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}

                    {/* BARRAS HORIZONTAIS */}
                    {chart.chart_type === 'bar_horizontal' && (
                      <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                        <XAxis type="number" tick={{fontSize: 12}} /> <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} />
                        <Tooltip content={<CustomTooltip />} />
                        {metaX && <ReferenceLine x={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" />}
                        <Bar dataKey="valor" fill={chart.color} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    )}

                    {/* LINHAS */}
                    {chart.chart_type === 'line' && (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" tick={{fontSize: 12}} /> <YAxis tick={{fontSize: 12}} />
                        <Tooltip content={<CustomTooltip />} />
                        {metaX && <ReferenceLine y={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" />}
                        <Line type="monotone" dataKey="valor" stroke={chart.color} strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    )}

                    {/* ÁREA */}
                    {chart.chart_type === 'area' && (
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" tick={{fontSize: 12}} /> <YAxis tick={{fontSize: 12}} />
                        <Tooltip content={<CustomTooltip />} />
                        {metaX && <ReferenceLine y={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" />}
                        <Area type="monotone" dataKey="valor" stroke={chart.color} fill={chart.color} fillOpacity={0.3} />
                      </AreaChart>
                    )}

                    {/* PIZZA (PIE) */}
                    {chart.chart_type === 'pie' && (
                      <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Pie data={chartData} dataKey="valor" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? chart.color : '#cbd5e1'} />
                          ))}
                        </Pie>
                      </PieChart>
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
