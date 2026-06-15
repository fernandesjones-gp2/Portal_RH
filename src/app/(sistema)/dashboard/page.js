'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine, PieChart, Pie, Cell, Legend } from 'recharts';
import { LayoutDashboard, Filter } from 'lucide-react';

export default function DashboardPage() {
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [dashboardWidgets, setDashboardWidgets] = useState([]);
  
  const [allCandidates, setAllCandidates] = useState([]);
  const [units, setUnits] = useState([]);
  const [roles, setRoles] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [cancellationReasons, setCancellationReasons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterProcessType, setFilterProcessType] = useState('');
  const [filterUnits, setFilterUnits] = useState([]); 
  const [filterRole, setFilterRole] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const sessionUser = await api.me();
        let role = '';
        if (sessionUser) {
          const fullName = sessionUser.data?.name || sessionUser.name || sessionUser.email || 'Colaborador';
          setUserName(fullName.split(' ')[0]); 
          role = sessionUser.data?.role || sessionUser.role || sessionUser[0]?.role || '';
          setUserRole(role);
        }

        const [candsRes, widgetsRes, unitsRes, rolesRes, usersRes, reasonsRes] = await Promise.all([
          api.candidates.list({ _t: Date.now() }).catch(() => []),
          api.dashboardWidgets.list({ _t: Date.now() }).catch(() => []),
          api.units.list().catch(() => []),
          api.jobRoles.list().catch(() => []),
          api.users.list().catch(() => []),
          api.cancellationReasons.list().catch(() => [])
        ]);

        if (candsRes) setAllCandidates(candsRes);
        if (unitsRes) setUnits(unitsRes);
        if (rolesRes) setRoles(rolesRes);
        if (usersRes) setResponsibles(usersRes);
        if (reasonsRes) setCancellationReasons(reasonsRes);
        
        if (widgetsRes) setDashboardWidgets(widgetsRes.filter(w => w.roles_visible.includes(role)));
      } catch (err) {} finally { setLoading(false); }
    }
    fetchDashboardData();
  }, []);

  const filteredCandidates = allCandidates.filter(c => {
    if (filterDateFrom || filterDateTo) {
      const refDate = c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '';
      if (filterDateFrom && refDate < filterDateFrom) return false;
      if (filterDateTo && refDate > filterDateTo) return false;
    }
    if (filterProcessType && c.process_type !== filterProcessType) return false;
    if (filterUnits.length > 0 && !filterUnits.includes(c.unit_id)) return false;
    if (filterRole && c.job_role_id !== filterRole) return false;
    if (filterResponsible && c.responsible_id !== filterResponsible) return false;
    return true;
  });

  const toggleUnitFilter = (unitId) => {
    if (filterUnits.includes(unitId)) setFilterUnits(filterUnits.filter(id => id !== unitId));
    else setFilterUnits([...filterUnits, unitId]);
  };

  const formatValue = (val, formatRule) => {
    if (formatRule === 'decimal') return parseFloat(val.toFixed(1));
    if (formatRule === 'percent') return parseFloat(val.toFixed(1)) + '%';
    return Math.round(val);
  };

  const processSmartMetrics = (widget) => {
    const base = widget.status_filter === 'Todos' ? filteredCandidates : filteredCandidates.filter(c => c.status === widget.status_filter);
    const mType = widget.metric_type;

    if (mType === 'count') return [{ name: 'Total', valor: base.length }];

    if (mType === 'smart_funnel') {
      const total = base.length;
      const pipeline = base.filter(c => ['Pré-Admissão (Pendente)', 'Pré-Admissão (Pronto)', 'Concluído'].includes(c.status)).length;
      const andamento = base.filter(c => ['Pré-Admissão (Pendente)', 'Pré-Admissão (Pronto)'].includes(c.status)).length;
      const admitidos = base.filter(c => c.status === 'Concluído').length;
      return [
        { name: '1. Total', valor: total },
        { name: '2. Entrevista', valor: pipeline },
        { name: '3. Pipeline', valor: andamento },
        { name: '4. Admitidos', valor: admitidos }
      ];
    }

    if (mType === 'smart_stuck') {
      const today = new Date().getTime();
      const stuck = base.filter(c => {
        if (c.status !== 'Agendado' || !c.interview_date) return false;
        const diffDays = (today - new Date(c.interview_date).getTime()) / (1000 * 3600 * 24);
        return diffDays > 2;
      });
      return [{ name: 'Parados > 2 Dias', valor: stuck.length }];
    }

    if (mType === 'smart_approval_rate') {
      const total = base.length;
      const aprovados = base.filter(c => ['Pré-Admissão (Pendente)', 'Pré-Admissão (Pronto)', 'Concluído'].includes(c.status)).length;
      const taxa = total > 0 ? (aprovados / total) * 100 : 0;
      return [{ name: 'Taxa de Aprovação', valor: taxa, isRate: true }];
    }

    const config = widget.advanced_config || {};
    const groupBy = config.groupBy || 'all';
    const grouped = {};

    if (groupBy === 'month') {
      const monthsMap = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      monthsMap.forEach(m => { grouped[m] = { name: m, valor: 0, _sum: 0, _count: 0 }; });
    } else if (groupBy === 'all') {
      grouped['Total Geral'] = { name: 'Total Geral', valor: 0, _sum: 0, _count: 0 };
    }

    base.forEach(c => {
      let groupKey = 'Não Classificado';
      if (groupBy === 'month') {
        const refDate = c.admission_date || c.created_at;
        if (refDate) groupKey = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][new Date(refDate).getMonth()];
      } 
      else if (groupBy === 'unit') groupKey = c.units?.name || c.unit_name || 'Geral';
      else if (groupBy === 'role') groupKey = c.job_roles?.name || c.job_role_name || 'Sem Cargo';
      else if (groupBy === 'recruiter') groupKey = c.users?.name || c.responsible_name || 'Sistema';
      else if (groupBy === 'reason') groupKey = cancellationReasons.find(r => r.id === c.cancellation_reason_id)?.name || 'Outros / Sem Motivo';
      else if (groupBy === 'all') groupKey = 'Total Geral';

      if (!grouped[groupKey]) grouped[groupKey] = { name: groupKey, valor: 0, _sum: 0, _count: 0 };

      if (mType === 'count') {
        grouped[groupKey].valor++;
      } else if (mType === 'date_diff') {
        const { dateStart, dateEnd } = config;
        if (c[dateEnd] && c[dateStart]) {
          grouped[groupKey]._sum += (new Date(c[dateEnd]) - new Date(c[dateStart])) / (1000 * 3600 * 24);
          grouped[groupKey]._count++;
        }
      }
    });

    let finalArray = Object.values(grouped);
    if (mType === 'date_diff') {
      finalArray = finalArray.map(g => ({ name: g.name, valor: g._count > 0 ? (g._sum / g._count) : 0 }));
    }
    if (groupBy !== 'month' && groupBy !== 'all') finalArray.sort((a, b) => b.valor - a.valor);
    return finalArray;
  };

  const getKpiDisplayValue = (widget, dataArray) => {
    if (!dataArray || dataArray.length === 0) return 0;
    const format = widget.advanced_config?.format || 'integer';
    const val = dataArray[0].valor;
    if (dataArray[0].isRate) return formatValue(val, 'percent');
    if (widget.metric_type === 'date_diff') return formatValue(val, format);
    return val;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'var(--surface-color)', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{label || payload[0].name}</p>
          <p style={{ color: payload[0].color || payload[0].payload.fill, fontWeight: '600' }}>
            {payload[0].value} {payload[0].payload.isRate ? '%' : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Processando inteligência do painel...</p>;

  const kpiCards = dashboardWidgets.filter(w => w.chart_type === 'kpi');
  const charts = dashboardWidgets.filter(w => w.chart_type !== 'kpi');

  const getGridSpan = (sizeConfig) => {
    if (sizeConfig === 'full') return '1 / -1'; 
    if (sizeConfig === 'third') return 'span 1'; 
    return 'span 2'; 
  };

  // Cores genéricas para a pizza caso não seja funil
  const DEFAULT_COLORS = ['#F37137', '#057a55', '#e02424', '#888888', '#3b82f6', '#d946ef', '#f59e0b'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Visão Estratégica</h1>
          <p style={{ color: 'var(--text-muted)' }}>Olá, {userName}! Aqui estão os indicadores da sua equipe.</p>
        </div>
        <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="btn-secondary" style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: isFilterOpen ? 'var(--bg-color)' : 'transparent' }}>
          <Filter size={18} color="var(--saritur-orange)" />
          {isFilterOpen ? 'Ocultar Filtros' : 'Filtros Globais'}
        </button>
      </div>

      {isFilterOpen && (
        <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'var(--surface-color)', animation: 'fadeIn 0.3s ease-in-out' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>Refinar Dados do Dashboard</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>Data Inicial</label><input type="date" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} /></div>
              <div><label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>Data Final</label><input type="date" style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} /></div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>Múltiplas Unidades</label>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.5rem', maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem', backgroundColor: 'var(--bg-color)' }}>
                {units.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={filterUnits.includes(u.id)} onChange={() => toggleUnitFilter(u.id)} style={{ accentColor: 'var(--saritur-orange)' }} /> {u.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>Tipo de Processo</label>
              <select style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={filterProcessType} onChange={e => setFilterProcessType(e.target.value)}>
                <option value="">Todos os Tipos</option><option value="Admissão">Admissão</option><option value="Readmissão">Readmissão</option><option value="Promoção">Promoção</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>Função Específica</label>
              <select style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="">Todas as Funções</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.3rem' }}>Recrutador Responsável</label>
              <select style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }} value={filterResponsible} onChange={e => setFilterResponsible(e.target.value)}>
                <option value="">Todos os Recrutadores</option>{responsibles.map(r => <option key={r.id} value={r.id}>{r.name || r.email}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterProcessType(''); setFilterUnits([]); setFilterRole(''); setFilterResponsible(''); }} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>Limpar Filtros</button>
          </div>
        </div>
      )}

      {kpiCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {kpiCards.map((kpi) => {
            const dataArray = processSmartMetrics(kpi);
            const val = getKpiDisplayValue(kpi, dataArray);
            return (
              <div key={kpi.id} style={{ backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', borderTop: `4px solid ${kpi.color}`, borderBottom: '1px solid var(--border-color)', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem' }}>{kpi.title}</p>
                    <h3 style={{ color: 'var(--text-main)', fontSize: '2.2rem', fontWeight: '800', letterSpacing: '-0.02em' }}>{val}</h3>
                  </div>
                  <LayoutDashboard size={20} color={kpi.color} />
                </div>
                {kpi.advanced_config?.targetValue && <p style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--danger-color)', marginTop: '0.5rem' }}>Meta: {kpi.advanced_config.targetValue}</p>}
              </div>
            );
          })}
        </div>
      )}

      {charts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
          {charts.map((chart) => {
            const chartData = processSmartMetrics(chart);
            const metaX = chart.advanced_config?.targetValue ? parseFloat(chart.advanced_config.targetValue) : null;
            const gridColumn = getGridSpan(chart.advanced_config?.size);
            const isFunnel = chart.metric_type === 'smart_funnel';
            
            // Lógica de Cores do Funil configuráveis
            const funnelColors = chart.advanced_config?.funnelColors || ['#BDBDBD', '#1976D2', '#FB8C00', '#2E7D32'];

            return (
              <div key={chart.id} style={{ gridColumn, backgroundColor: 'var(--surface-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', minWidth: '0' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{chart.title}</h3>
                
                <div style={{ height: '300px', width: '100%', marginTop: '1.5rem' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    
                    {chart.chart_type === 'bar' && !isFunnel && (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" tick={{fontSize: 12}} /> <YAxis tick={{fontSize: 12}} />
                        <Tooltip content={<CustomTooltip />} />
                        {metaX && <ReferenceLine y={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" />}
                        <Bar dataKey="valor" fill={chart.color} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}

                    {(chart.chart_type === 'bar_horizontal' || isFunnel) && (
                      <BarChart data={chartData} layout="vertical" margin={{ left: isFunnel ? 40 : 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                        <XAxis type="number" tick={{fontSize: 12}} /> 
                        <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 11, fontWeight: 'bold'}} />
                        <Tooltip content={<CustomTooltip />} />
                        {metaX && <ReferenceLine x={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" />}
                        <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                          {chartData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={isFunnel ? funnelColors[index % 4] : chart.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    )}

                    {chart.chart_type === 'line' && (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" tick={{fontSize: 12}} /> <YAxis tick={{fontSize: 12}} />
                        <Tooltip content={<CustomTooltip />} />
                        {metaX && <ReferenceLine y={metaX} stroke="var(--danger-color)" strokeWidth={2} strokeDasharray="4 4" />}
                        <Line type="monotone" dataKey="valor" stroke={chart.color} strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    )}

                    {chart.chart_type === 'pie' && (
                      <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                        <Pie data={chartData} dataKey="valor" nameKey="name" cx="50%" cy="50%" innerRadius={isFunnel ? 0 : 60} outerRadius={100} label>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={isFunnel ? funnelColors[index % 4] : DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
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
