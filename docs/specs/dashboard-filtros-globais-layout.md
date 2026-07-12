# Spec: Dashboard — Filtros Globais + Redesign de Layout

**Data:** 2026-07-12  
**Status:** Aguardando aprovação

---

## 1. Comportamento Atual

- Todos os indicadores são computados uma vez em `fetchDashboardData()` e armazenados em state (`funil`, `historyStats`, `kpis`).
- O único filtro de período (`filtroPeriodo` mês/ano) se aplica apenas ao Bloco 2.
- Layout com `gap: 3rem` entre painéis e `padding: 2rem` em cada card — muito espaço vazio.

---

## 2. Comportamento Alvo

### 2.1 Filtros globais (barra sticky no topo)

| Filtro | Tipo | Campo de referência |
|--------|------|---------------------|
| Data (De) | `<input type="date">` | `interview_date \|\| created_at` |
| Data (Até) | `<input type="date">` | mesma referência |
| Unidade | MultiSelect checkbox | `unitName` (enriquecido) |
| Função | MultiSelect checkbox | `roleName` (enriquecido) |
| Responsável | MultiSelect checkbox | `respName` (enriquecido) |

- Todos os indicadores respondem simultaneamente quando qualquer filtro muda.
- Botão "Limpar filtros" visível somente quando há filtro ativo.
- Badge de contexto: `"N candidatos · filtros ativos"` aparece quando há filtros.
- Filtros persistem apenas na sessão (sem localStorage).

### 2.2 Arquitetura: fetch → render

**`fetchData()` (novo nome)**: só busca e enriquece raw data.
- Armazena `rawCands[]` (com `roleName`, `unitName`, `respName` já setados).
- Armazena listas para os dropdowns: `allUnits[]`, `allRoles[]`, `allUsers[]`.
- Remove da store: `funil`, `historyStats`, `kpis`, `filtroPeriodo`.

**Render-time**: toda computação derivada de `filteredCands`:
```
filteredCands = rawCands.filter(c =>
  [dateFrom filter]
  [dateTo filter]
  [unidade filter]
  [funcao filter]
  [responsavel filter]
)
```

Cada bloco do JSX computa seus dados diretamente de `filteredCands`.

### 2.3 Layout redesenhado (minimalista)

```
┌─────────────────────────────────────────────────┐
│  BARRA DE FILTROS (sticky, 60px altura)          │
│  [De: ___] [Até: ___]  [Unidade ▼] [Função ▼]  │
│  [Responsável ▼]           [Limpar × N filtros] │
└─────────────────────────────────────────────────┘

┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│ KPI 1 │ │ KPI 2 │ │ KPI 3 │ │ KPI 4 │   ← row, gap 0.75rem
└───────┘ └───────┘ └───────┘ └───────┘

┌──────────────────────────────────────────────────┐
│ Funil em Andamento (barras horizontais compactas) │  ← gap 1rem do KPI
└──────────────────────────────────────────────────┘

┌────────────────────┐  ┌────────────────────────┐
│  Volume Global     │  │  Análise de Leadtime   │   ← side-by-side, gap 1rem
└────────────────────┘  └────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Processos Concluídos + Análise Reprovados        │
└──────────────────────────────────────────────────┘
```

**Mudanças de espaçamento:**
- Gap entre seções: `1.25rem` (era `3rem`)
- Padding interno dos painéis: `1.25rem` (era `2rem`)
- KPI cards: padding `1rem`, valor `1.75rem` (era `2.5rem`)
- Volume + Leadtime: coluna side-by-side com `minmax(300px,1fr)`

### 2.4 Remoção do seletor mês/ano do Bloco 2

O filtro de data global (De-Até) substitui o seletor de período do Bloco 2.  
O Bloco 2 "Processos Concluídos" usa `filteredCands` com `admission_date` dentro do intervalo global.

---

## 3. Novo estado do componente

```js
// Raw data (fetch once)
const [rawCands, setRawCands]     = useState([]);
const [allUnits, setAllUnits]     = useState([]);
const [allRoles, setAllRoles]     = useState([]);
const [allUsers, setAllUsers]     = useState([]);

// Filtros globais
const [filterDateFrom,     setFilterDateFrom]     = useState('');
const [filterDateTo,       setFilterDateTo]       = useState('');
const [filterUnidades,     setFilterUnidades]     = useState([]);
const [filterFuncoes,      setFilterFuncoes]      = useState([]);
const [filterResponsaveis, setFilterResponsaveis] = useState([]);

// UI state (mantidos)
const [loading, ...]
const [modalStage, ...]
const [modalParados, ...]
const [hoverCard, ...]
const [abaReprovados, ...]
const [viewVolume, ...]
const [viewLeadtime, ...]
const [hoverLeadtime, ...]
```

---

## 4. Invariantes

- Lógica dos buckets do funil (entrevistas/documentação/exames/prontos) — sem alteração.
- Fórmula leadtime (`analysis_update_date || interview_date` → `admission_date`) — sem alteração.
- Função `getEtapa(c)` para classificação de reprovados — sem alteração.
- Campo de referência da data global = `interview_date || created_at`.
- Funil em andamento filtra por `interview_date || created_at` para o filtro de data, mas mantém lógica de `tempoParado`.
- Modais de detalhe de etapa e parados — sem alteração (usam os dados filtrados do funil).

---

## 5. Notas de implementação

- `MultiSelect` inline (sem arquivo separado) — mesmo padrão do `concluidos/page.js` mas sem o cadeado de posição (dashboard usa `overflow: visible` no painel).
- Bloco 2 admitidos = `filteredCands` com `status === 'Concluído'` + `process_type` em Admissão/Readmissão + `admission_date` dentro do filtro de data global (se ativo).
- Bloco 2 reprovados histórico = `todosReprovados` sem filtro de data (mantém comportamento do fix anterior).
- Matriz psicólogo × mês (últimos 6 meses) — continua fixada nos últimos 6 meses reais, mas filtra apenas psicólogos incluídos nos filtros globais.
