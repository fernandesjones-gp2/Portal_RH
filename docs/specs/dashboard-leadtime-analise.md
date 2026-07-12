# Spec: Dashboard — Análise Completa de Leadtime

**Data:** 2026-07-11  
**Status:** Implementado em 2026-07-11

---

## 1. Comportamento Atual

O KPI card "Leadtime Médio" exibe apenas um único número (média global).  
Não há gráfico histórico nem breakdowns por unidade ou função.

---

## 2. Comportamento Alvo

Nova seção `glass-panel` **"Análise de Leadtime"** inserida após o painel "Volume Global de Atendimentos".

**Fórmula (sem alteração):** `admission_date − analysis_update_date` (fallback: `interview_date`)  
**Universo:** candidatos com `status = 'Concluído'` + ambas as datas preenchidas + resultado ≥ 0 dias

### 2.1 Gráfico de Colunas — Leadtime Médio por Mês

- Eixo X: mês/ano (até 12 meses, referência = `admission_date`)
- Eixo Y: média de dias (sem exibição de eixo numérico — valor diretamente no topo da barra)
- Barra: ≤ 24px larga, 4px border-radius no topo, cor azul sequencial `#2a78d6` / dark `#3987e5`
- Tooltip ao hover: "Mês · N dias (X admissões)"
- Gridlines horizontais hairline recessive

### 2.2 Rankings por Dimensão — 3 tabs

| Tab | Dimensão | Campo |
|-----|----------|-------|
| Por Psicólogo | `responsible_name` | kpis.leadtimePorPsicologo (já existe) |
| Por Unidade | `unit_name` | **novo** |
| Por Função | `job_role_name` | **novo** |

Cada tab = barras horizontais ordenadas pela **menor média** (melhor) primeiro:
- Barra azul `#2a78d6`, comprimento proporcional à maior média
- Valor em dias à direita
- Contagem de admissões em texto muted abaixo do nome

---

## 3. Dados a Adicionar no `fetchDashboardData`

Novos mapas no loop (dentro do bloco de Leadtime já existente):

```
leadtimeMensalMap   { key, label, sum, count }   → 12 últimos meses
leadtimeUnidadeMap  { name, sum, count }
leadtimeFuncaoMap   { name, sum, count }
```

Incluídos em `setKpis(...)` como `leadtimePorMes`, `leadtimePorUnidade`, `leadtimePorFuncao`.

Novo estado: `viewLeadtime = 'psicologo' | 'unidade' | 'funcao'`

---

## 4. Invariantes (não pode quebrar)

- KPI card "Leadtime Médio" (número único) — sem alteração
- Demais painéis — sem alteração
- Fetch único (sem novos endpoints)

---

## 5. Diretrizes Visuais (dataviz skill)

- **Forma:** coluna para tendência no tempo; barra horizontal para rank/magnitude
- **Cor:** sequencial blue (um só hue = magnitude) — sem legenda (série única)
- **Marcas:** barra ≤ 24px, 4px radius no topo, quadrado na base, valor no cap
- **Gridlines:** hairline (1px) recessive; eixo Y implícito via valores diretos
- **Hover:** tooltip por barra com mês + média + contagem
- **Dark mode:** `#3987e5` nas barras (validado pela skill)
