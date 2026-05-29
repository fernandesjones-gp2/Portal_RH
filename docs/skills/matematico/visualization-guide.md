# Visualization Guide — Catálogo de Gráficos e Paletas

## Índice
1. Paletas de Cores
2. Configuração Base
3. Catálogo de Gráficos por Tipo
4. Templates de Gráficos Compostos
5. Dashboard Layouts (Plotly/Recharts)

---

## 1. Paletas de Cores (Colorblind-Friendly)

### Paleta Principal — "Antigravity"
```python
PALETTE_PRIMARY = {
    'blue':     '#2E86AB',
    'magenta':  '#A23B72',
    'orange':   '#F18F01',
    'red':      '#C73E1D',
    'green':    '#2A9D8F',
    'purple':   '#6C5B7B',
    'yellow':   '#F4D35E',
    'dark':     '#264653',
}
PALETTE_SEQ = ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#2A9D8F', '#6C5B7B', '#F4D35E']
```

### Paleta Divergente (para heatmaps e correlações)
```python
CMAP_DIVERGENT = 'RdBu_r'        # correlação, desvios
CMAP_SEQUENTIAL = 'YlOrRd'       # intensidade, volume
CMAP_CATEGORICAL = 'Set2'        # grupos distintos
CMAP_HEATMAP = 'viridis'         # mapas de calor genéricos
```

### Paleta para Status / Semáforo
```python
STATUS_COLORS = {
    'good':    '#2ecc71',
    'warning': '#f39c12',
    'danger':  '#e74c3c',
    'neutral': '#95a5a6',
    'info':    '#3498db',
}
```

### Paleta Tailwind (para React/dashboards)
```
Azul:    bg-blue-500 (#3B82F6)     text-blue-700
Verde:   bg-emerald-500 (#10B981)  text-emerald-700
Laranja: bg-amber-500 (#F59E0B)    text-amber-700
Vermelho: bg-red-500 (#EF4444)     text-red-700
Roxo:    bg-violet-500 (#8B5CF6)   text-violet-700
Cinza:   bg-slate-500 (#64748B)    text-slate-700
```

---

## 2. Configuração Base Matplotlib/Seaborn

```python
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns

def setup_professional_style():
    """Aplica estilo profissional nos gráficos."""
    plt.style.use('seaborn-v0_8-whitegrid')
    plt.rcParams.update({
        'figure.dpi': 150,
        'savefig.dpi': 300,
        'figure.figsize': (12, 6),
        'font.size': 10,
        'font.family': 'sans-serif',
        'axes.titlesize': 13,
        'axes.titleweight': 'bold',
        'axes.labelsize': 11,
        'axes.spines.top': False,
        'axes.spines.right': False,
        'legend.fontsize': 9,
        'legend.framealpha': 0.9,
        'figure.titlesize': 15,
        'figure.titleweight': 'bold',
    })
    sns.set_palette(PALETTE_SEQ)
```

### Formatação Inteligente de Eixos

```python
def smart_format_axis(ax, axis='y', prefix='', suffix='', is_pct=False, is_currency=False):
    """Formata eixos de forma inteligente."""
    if is_pct:
        formatter = mticker.FuncFormatter(lambda x, _: f'{x:.0f}%')
    elif is_currency:
        formatter = mticker.FuncFormatter(lambda x, _: f'R$ {x:,.0f}')
    else:
        formatter = mticker.FuncFormatter(lambda x, _: f'{prefix}{x:,.1f}{suffix}')

    if axis == 'y':
        ax.yaxis.set_major_formatter(formatter)
    else:
        ax.xaxis.set_major_formatter(formatter)
```

---

## 3. Catálogo de Gráficos por Tipo

### 3.1 Distribuição

**Histograma com KDE e Estatísticas**
```python
def histogram_pro(data, title, xlabel, figsize=(10, 6)):
    fig, ax = plt.subplots(figsize=figsize)
    sns.histplot(data, kde=True, color='#2E86AB', edgecolor='white', linewidth=0.5, ax=ax)

    # Linhas de referência
    ax.axvline(data.mean(), color='#C73E1D', linestyle='--', linewidth=2, label=f'Média: {data.mean():.2f}')
    ax.axvline(data.median(), color='#2A9D8F', linestyle='-.', linewidth=2, label=f'Mediana: {data.median():.2f}')

    # Anotação com estatísticas
    stats_text = f'n={len(data):,}\nσ={data.std():.2f}\nskew={data.skew():.2f}\nkurt={data.kurtosis():.2f}'
    ax.text(0.97, 0.97, stats_text, transform=ax.transAxes, fontsize=9,
            verticalalignment='top', horizontalalignment='right',
            bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.legend()
    plt.tight_layout()
    return fig
```

**Violin + Swarm para Comparação de Grupos**
```python
def violin_swarm(df, x_col, y_col, title, figsize=(12, 6)):
    fig, ax = plt.subplots(figsize=figsize)
    sns.violinplot(data=df, x=x_col, y=y_col, palette='Set2', inner=None, alpha=0.3, ax=ax)
    sns.swarmplot(data=df, x=x_col, y=y_col, size=3, alpha=0.6, ax=ax)
    ax.set_title(title, fontweight='bold')
    plt.tight_layout()
    return fig
```

### 3.2 Tendência (Time Series)

```python
def trend_chart(df, date_col, value_col, title, rolling_window=7, figsize=(14, 6)):
    """Gráfico de tendência com média móvel e banda de confiança."""
    fig, ax = plt.subplots(figsize=figsize)

    data = df.sort_values(date_col)

    # Linha principal
    ax.plot(data[date_col], data[value_col], color='#2E86AB', alpha=0.4, linewidth=1, label='Diário')

    # Média móvel
    rolling = data[value_col].rolling(rolling_window)
    ax.plot(data[date_col], rolling.mean(), color='#C73E1D', linewidth=2.5, label=f'Média Móvel ({rolling_window}d)')

    # Banda ±1σ
    ax.fill_between(data[date_col],
                    rolling.mean() - rolling.std(),
                    rolling.mean() + rolling.std(),
                    alpha=0.15, color='#C73E1D')

    ax.set_title(title, fontweight='bold')
    ax.legend()
    plt.tight_layout()
    return fig
```

### 3.3 Composição

```python
def donut_chart(values, labels, title, colors=None, figsize=(8, 8)):
    """Donut chart com percentuais."""
    if colors is None:
        colors = PALETTE_SEQ[:len(values)]

    fig, ax = plt.subplots(figsize=figsize)
    wedges, texts, autotexts = ax.pie(
        values, labels=labels, colors=colors, autopct='%1.1f%%',
        startangle=90, pctdistance=0.82,
        wedgeprops=dict(width=0.4, edgecolor='white', linewidth=2)
    )

    # Centro com total
    total = sum(values)
    ax.text(0, 0, f'Total\n{total:,.0f}', ha='center', va='center',
            fontsize=16, fontweight='bold')

    ax.set_title(title, fontweight='bold', fontsize=14)
    plt.tight_layout()
    return fig
```

### 3.4 Ranking / Comparação

```python
def horizontal_bar_ranked(values, labels, title, highlight_top=3, figsize=(10, 8)):
    """Bar chart horizontal ordenado com destaque nos top N."""
    sorted_idx = np.argsort(values)
    sorted_values = np.array(values)[sorted_idx]
    sorted_labels = np.array(labels)[sorted_idx]

    colors = ['#2E86AB' if i >= len(values) - highlight_top else '#BDC3C7'
              for i in range(len(values))]

    fig, ax = plt.subplots(figsize=figsize)
    bars = ax.barh(range(len(values)), sorted_values, color=colors, edgecolor='white')

    ax.set_yticks(range(len(values)))
    ax.set_yticklabels(sorted_labels)
    ax.set_title(title, fontweight='bold')

    # Labels nas barras
    for bar, val in zip(bars, sorted_values):
        ax.text(bar.get_width() + max(sorted_values) * 0.01, bar.get_y() + bar.get_height()/2,
                f'{val:,.0f}', va='center', fontsize=9)

    plt.tight_layout()
    return fig
```

### 3.5 KPI Cards (para dashboards matplotlib)

```python
def kpi_card_grid(kpis, figsize=(16, 3)):
    """Grid de KPI cards estilo dashboard.

    kpis: list of dicts com keys: title, value, delta, delta_is_good (bool)
    """
    n = len(kpis)
    fig, axes = plt.subplots(1, n, figsize=figsize)
    if n == 1:
        axes = [axes]

    for ax, kpi in zip(axes, kpis):
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')

        # Background card
        rect = plt.Rectangle((0.05, 0.05), 0.9, 0.9, fill=True,
                             facecolor='#F8F9FA', edgecolor='#DEE2E6', linewidth=2, zorder=0)
        ax.add_patch(rect)

        # Título
        ax.text(0.5, 0.78, kpi['title'], ha='center', va='center', fontsize=10, color='#6C757D')

        # Valor
        ax.text(0.5, 0.48, kpi['value'], ha='center', va='center', fontsize=22, fontweight='bold', color='#212529')

        # Delta
        if 'delta' in kpi and kpi['delta']:
            delta_color = '#2ecc71' if kpi.get('delta_is_good', True) else '#e74c3c'
            arrow = '▲' if kpi.get('delta_is_good', True) else '▼'
            ax.text(0.5, 0.2, f'{arrow} {kpi["delta"]}', ha='center', va='center',
                    fontsize=11, color=delta_color, fontweight='bold')

    plt.tight_layout()
    return fig
```

---

## 4. Templates de Gráficos Compostos

### Dashboard 4-em-1 para Análise Rápida

```python
def quick_dashboard(df, value_col, date_col=None, cat_col=None, figsize=(16, 12)):
    """Dashboard rápido 2×2 com visão geral dos dados."""
    fig, axes = plt.subplots(2, 2, figsize=figsize)
    fig.suptitle(f'Dashboard: {value_col}', fontsize=16, fontweight='bold')

    data = df[value_col].dropna()

    # [0,0] Histograma + KDE
    sns.histplot(data, kde=True, ax=axes[0, 0], color='#2E86AB')
    axes[0, 0].axvline(data.mean(), color='red', linestyle='--')
    axes[0, 0].set_title('Distribuição')

    # [0,1] Boxplot
    sns.boxplot(x=data, ax=axes[0, 1], color='#A23B72')
    axes[0, 1].set_title('Boxplot + Outliers')

    # [1,0] Série temporal ou top categorias
    if date_col and date_col in df.columns:
        df.sort_values(date_col).plot(x=date_col, y=value_col, ax=axes[1, 0], legend=False, color='#2E86AB')
        axes[1, 0].set_title('Evolução Temporal')
    elif cat_col and cat_col in df.columns:
        df.groupby(cat_col)[value_col].mean().sort_values().tail(10).plot(kind='barh', ax=axes[1, 0], color='#2A9D8F')
        axes[1, 0].set_title(f'Top 10 por {cat_col}')
    else:
        data.plot(ax=axes[1, 0], color='#2E86AB', alpha=0.7)
        axes[1, 0].set_title('Valores (índice)')

    # [1,1] Tabela de estatísticas
    axes[1, 1].axis('off')
    stats_data = [
        ['Métrica', 'Valor'],
        ['Contagem', f'{len(data):,}'],
        ['Média', f'{data.mean():,.2f}'],
        ['Mediana', f'{data.median():,.2f}'],
        ['Desvio Padrão', f'{data.std():,.2f}'],
        ['Mínimo', f'{data.min():,.2f}'],
        ['Máximo', f'{data.max():,.2f}'],
        ['Skewness', f'{data.skew():.3f}'],
        ['Kurtosis', f'{data.kurtosis():.3f}'],
        ['Missing', f'{df[value_col].isnull().sum()} ({df[value_col].isnull().mean()*100:.1f}%)'],
    ]
    table = axes[1, 1].table(cellText=stats_data[1:], colLabels=stats_data[0],
                             loc='center', cellLoc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 1.5)
    axes[1, 1].set_title('Estatísticas Descritivas')

    plt.tight_layout()
    return fig
```

---

## 5. Dashboard Interativo React (Recharts)

### Template Base React

Usar este template quando o usuário pedir dashboard interativo:

```jsx
import { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart, ScatterChart, Scatter, ComposedChart
} from 'recharts';

const COLORS = ['#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#2A9D8F', '#6C5B7B'];

// KPI Card Component
const KPICard = ({ title, value, delta, deltaType }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
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
);

// Usar ResponsiveContainer sempre:
// <ResponsiveContainer width="100%" height={300}>
//   <LineChart data={data}>...</LineChart>
// </ResponsiveContainer>
```

### Regras para Recharts

1. SEMPRE envolver gráficos em `<ResponsiveContainer width="100%" height={N}>`
2. Usar `CartesianGrid strokeDasharray="3 3"` para grades sutis
3. Incluir `<Tooltip>` em TODOS os gráficos para interatividade
4. Usar formatadores de número: `tickFormatter={v => v.toLocaleString('pt-BR')}`
5. Cores: usar a constante COLORS acima, atribuindo via `<Cell>` ou prop `fill`/`stroke`
6. Para datas no eixo X: usar `angle={-45}` e `textAnchor="end"` nos ticks

---

## Notas Importantes

- Salvar TODOS os gráficos matplotlib com `fig.savefig(path, dpi=300, bbox_inches='tight')`
- Fechar figuras após salvar: `plt.close(fig)` para evitar memory leak
- Para datasets grandes (>100k linhas), preferir hexbin ou sampling ao invés de scatter completo
- Para variáveis com muitas categorias (>15), agrupar as menores como "Outros"
- Sempre adicionar `plt.tight_layout()` antes de salvar
