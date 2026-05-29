# Dashboard Templates — Estruturas React/Recharts

## Índice
1. Arquitetura de Dashboard
2. Template: Executive Overview
3. Template: Sales/E-commerce
4. Template: Marketing Performance
5. Template: Operational Metrics
6. Componentes Reutilizáveis
7. Padrões de Interatividade

---

## 1. Arquitetura de Dashboard

### Estrutura Visual (Grid Layout)

```
┌─────────────────────────────────────────────────────┐
│  📊 [Título do Dashboard]         [Filtros/Período] │
├────────┬────────┬────────┬─────────────────────────┤
│ KPI 1  │ KPI 2  │ KPI 3  │ KPI 4                   │
├────────┴────────┴────────┴─────────────────────────┤
│                                                     │
│         Gráfico Principal (Tendência/Área)          │
│                                                     │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│  Gráfico Secundário  │  Gráfico Terciário          │
│  (Barras/Pizza)      │  (Scatter/Heatmap)          │
│                      │                              │
├──────────────────────┴──────────────────────────────┤
│                                                     │
│         Tabela de Detalhes (Top N / Ranking)        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Princípios de Layout

1. **KPIs no topo**: Métricas mais importantes sempre visíveis
2. **Gráfico hero**: O insight mais importante ocupa mais espaço
3. **Hierarquia visual**: De macro (topo) para micro (bottom)
4. **Filtros acessíveis**: Período, segmento, categoria
5. **Responsivo**: Grid de 1-4 colunas via Tailwind

### Grid Tailwind Padrão

```jsx
{/* Container principal */}
<div className="min-h-screen bg-slate-50 p-6">
  {/* Header */}
  <div className="flex items-center justify-between mb-6">
    <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
    <div className="flex gap-2">{/* Filtros */}</div>
  </div>

  {/* KPI Cards - 4 colunas */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    {kpis.map(kpi => <KPICard key={kpi.title} {...kpi} />)}
  </div>

  {/* Gráfico Principal - full width */}
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
    <h2 className="text-lg font-semibold text-slate-700 mb-4">{chartTitle}</h2>
    <ResponsiveContainer width="100%" height={350}>
      {/* Chart aqui */}
    </ResponsiveContainer>
  </div>

  {/* Dois gráficos lado a lado */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      {/* Chart A */}
    </div>
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      {/* Chart B */}
    </div>
  </div>
</div>
```

---

## 2. Template: Executive Overview

Ideal para: visão geral de negócio, apresentações executivas, relatórios mensais.

### KPIs sugeridos:
- Receita Total (vs período anterior)
- Lucro Líquido (com margem %)
- Nº Clientes Ativos (com crescimento)
- NPS ou Satisfação

### Gráficos sugeridos:
- **Hero**: Line/Area chart de receita mensal com tendência
- **Secundário 1**: Bar chart de receita por segmento/produto
- **Secundário 2**: Donut de composição de receita
- **Tabela**: Top 10 clientes/produtos por receita

### Filtros:
- Período (mês, trimestre, YTD, YoY)
- Região/Segmento

---

## 3. Template: Sales / E-commerce

### KPIs sugeridos:
- Receita Total + delta%
- Ticket Médio (AOV) + delta%
- Nº Pedidos + delta%
- Conversion Rate + delta%

### Gráficos sugeridos:
- **Hero**: Area chart de receita diária com média móvel 7d
- **Secundário 1**: Bar chart horizontal de Top 10 produtos
- **Secundário 2**: Pie/Donut de receita por categoria
- **Complementar**: Funnel de conversão (visits → cart → checkout → purchase)
- **Tabela**: Detalhamento por produto com sortable columns

### Gráficos avançados:
- Heatmap de vendas por dia da semana × hora
- Cohort de retenção de clientes
- RFM scatter plot (Recência × Monetário, cor = Frequência)

---

## 4. Template: Marketing Performance

### KPIs sugeridos:
- Gasto Total + budget restante
- Leads Gerados + CPL
- Conversões + CPA
- ROAS

### Gráficos sugeridos:
- **Hero**: Composed chart (barras = gasto, linha = conversões) por canal
- **Secundário 1**: Stacked bar de gasto por canal ao longo do tempo
- **Secundário 2**: Scatter de CTR × Conversion Rate por campanha
- **Tabela**: Performance por campanha (impressões, cliques, CTR, conversões, CPA)

---

## 5. Template: Operational Metrics

### KPIs sugeridos:
- Throughput (unidades/dia)
- Lead Time Médio
- OEE (%) ou Utilização
- On-Time Delivery Rate

### Gráficos sugeridos:
- **Hero**: Control chart (linha + limites superior/inferior)
- **Secundário 1**: Pareto de causas de defeitos
- **Secundário 2**: Histograma de lead time
- **Tabela**: SLA compliance por processo/equipe

---

## 6. Componentes Reutilizáveis

### KPI Card com Sparkline

```jsx
const KPICardSpark = ({ title, value, delta, deltaType, sparkData }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        {delta && (
          <p className={`text-sm font-semibold mt-1 ${
            deltaType === 'positive' ? 'text-emerald-600' : 'text-red-500'
          }`}>
            {deltaType === 'positive' ? '▲' : '▼'} {delta}
          </p>
        )}
      </div>
      {sparkData && (
        <ResponsiveContainer width={80} height={40}>
          <AreaChart data={sparkData}>
            <Area
              type="monotone"
              dataKey="value"
              stroke={deltaType === 'positive' ? '#10B981' : '#EF4444'}
              fill={deltaType === 'positive' ? '#10B981' : '#EF4444'}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
);
```

### Filter Bar

```jsx
const FilterBar = ({ periods, activePeriod, onPeriodChange }) => (
  <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
    {periods.map(period => (
      <button
        key={period}
        onClick={() => onPeriodChange(period)}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
          activePeriod === period
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {period}
      </button>
    ))}
  </div>
);
```

### Sortable Table

```jsx
const DataTable = ({ columns, data, sortKey, onSort }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          {columns.map(col => (
            <th
              key={col.key}
              onClick={() => onSort(col.key)}
              className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer hover:text-slate-800"
            >
              {col.label} {sortKey === col.key && '↓'}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
            {columns.map(col => (
              <td key={col.key} className="px-4 py-3 text-slate-700">
                {col.format ? col.format(row[col.key]) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

---

## 7. Padrões de Interatividade

### State Management para Dashboards

```jsx
const [period, setPeriod] = useState('Último Mês');
const [selectedSegment, setSelectedSegment] = useState('Todos');
const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });

// Filtrar dados baseado nos controles
const filteredData = useMemo(() => {
  let result = rawData;
  if (selectedSegment !== 'Todos') {
    result = result.filter(d => d.segment === selectedSegment);
  }
  // Aplicar filtro de período...
  return result;
}, [rawData, selectedSegment, period]);

// Calcular KPIs dos dados filtrados
const kpis = useMemo(() => ({
  totalRevenue: filteredData.reduce((sum, d) => sum + d.revenue, 0),
  avgTicket: filteredData.reduce((sum, d) => sum + d.revenue, 0) / filteredData.length,
  totalOrders: filteredData.length,
}), [filteredData]);
```

### Tooltip Customizado

```jsx
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 p-3">
      <p className="font-semibold text-slate-700 text-sm">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number'
            ? entry.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
            : entry.value}
        </p>
      ))}
    </div>
  );
};
```

### Formatadores pt-BR

```jsx
const formatCurrency = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const formatPercent = (v) => `${v.toFixed(1)}%`;
const formatNumber = (v) => v.toLocaleString('pt-BR');
const formatCompact = (v) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toString();
};
```
