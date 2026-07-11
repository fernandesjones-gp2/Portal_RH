# Spec: Dashboard — Expansão de Indicadores Gerenciais

**Data:** 2026-07-10  
**Status:** Confirmado — aguardando aprovação para implementar

---

## 1. Comportamento Atual

O dashboard (`src/app/(sistema)/dashboard/page.js`) exibe:
- **Funil em andamento** — 4 etapas (barras horizontais clicáveis com modal de detalhes)
  - Tempo parado: entrevistas usa `interview_date`; documentação/exames usam `updated_at`
- **Volume de atendimentos** — gráfico de barras mensais + ranking por psicólogo

---

## 2. Comportamento Alvo

### 2.1 Bloco 1 — Processos em Andamento

#### Correção do tempo parado no funil

| Etapa | Campo atual | Campo novo |
|-------|-------------|------------|
| Entrevista | `interview_date` | sem mudança |
| Documentação | `updated_at` | `docs_request_date` |
| Exame médico | `updated_at` | `medical_request_date` |
| Prontos p/ admitir | — | sem mudança |

**Regra:** Se o campo de data for nulo, o candidato aparece no funil mas com `tempoParado = 0`.

---

#### Cards de KPIs (nova linha de 4 cards acima do funil)

**Card 1 — Volume de Atendimentos**
- Valor: total histórico de candidatos atendidos (já calculado)
- Ao passar o mouse (hover): abre painel com ranking por psicólogo (volume desc.)

**Card 2 — Índice de Aprovação**
- Fórmula: `(candidatos com analysis_status = 'Aprovado') / (candidatos de Admissão/Readmissão com interview_date não nulo)` × 100
- Ao passar o mouse: breakdown por psicólogo — "Nome: X aprovados / Y entrevistas (Z%)"

**Card 3 — Candidatos Parados > 2 dias**
- Valor: total de candidatos em qualquer etapa do funil em andamento com `tempoParado > 2`
- Ao clicar: modal com tabela — Nome, Função, Unidade, Psicólogo, Etapa, Tempo Parado
- Cor do card: vermelho/laranja de alerta

**Card 4 — Leadtime Médio**
- Fórmula: média de `(admission_date − data_aprovação_entrevista)` em dias, para candidatos com `status = 'Concluído'`
- ⚠️ **Assunção a confirmar:** `data_aprovação_entrevista` = campo `analysis_update_date` (data em que o resultado da entrevista foi registrado). Se nulo, usa `interview_date` como fallback.
- Ao passar o mouse: leadtime médio por psicólogo

---

### 2.2 Bloco 2 — Processos Concluídos

#### Seletor de período
- Dois selects: **Mês** + **Ano** (ex.: "Julho / 2026")
- Padrão: mês/ano corrente
- **Data base = `admission_date`** para candidatos admitidos; `updated_at` para reprovados/cancelados

#### Funil de conversão do período

> ⚠️ **Assunção a confirmar:** "Total de candidatos" = todos os candidatos (Admissão/Readmissão) cujo processo foi encerrado no período selecionado (admitidos + reprovados/cancelados), usando as datas acima como referência.

| Métrica | Fórmula |
|---------|---------|
| Total de candidatos | COUNT de todos os processos encerrados no período |
| Aprovados na entrevista | Desses, com `analysis_status = 'Aprovado'` |
| Admitidos | Desses, com `status = 'Concluído'` |

Exibição: funil visual (barras decrescentes com contadores e percentual de conversão entre etapas).

---

#### Análise dos Reprovados (do mesmo período)

Reprovados = candidatos do período com `status IN ('Reprovado', 'Cancelado', 'Reprovado Documentação', 'Reprovado pelo Médico', 'Inapto Médico', 'Desistência', 'Falta')`.

5 sub-visualizações (tabs ou cards expansíveis):

1. **Por Psicólogo** — ranking de reprovações por `responsible_name`
2. **Por Função** — ranking por `job_role_name`
3. **Por Unidade** — ranking por `unit_name`
4. **Por Etapa** — mapeamento de status → etapa:
   - `Reprovado` → Entrevista
   - `Reprovado Documentação` → Documentação
   - `Reprovado pelo Médico` / `Inapto Médico` → Exame Médico
   - `Desistência` / `Falta` → Desistência
   - `Cancelado` → Cancelado
5. **Ranking por Motivo** — `cancellation_reason_name` (maior → menor); candidatos sem motivo agrupados em "Sem motivo informado"

---

## 3. Invariantes (o que NÃO pode quebrar)

- Funil em andamento (clique nas barras → modal de detalhes) continua funcional
- Modal existente com gargalo por responsável/função (entrevistas > 2 dias) mantido
- Gráfico de volume mensal e ranking histórico mantidos
- Candidatos com `process_type = 'Promoção'` excluídos do funil em andamento (sem mudança)
- Fetch único via `Promise.all` — sem novos endpoints de API; tudo computado client-side
- Performance: nenhum `useEffect` adicional; toda computação dentro do `fetchDashboardData` existente

---

## 4. Implementação Técnica (plano)

### Novos estados
```js
const [kpis, setKpis] = useState({ volumeTotal: 0, ranking: [], indiceAprovacao: 0, aprovacaoPorPsicologo: [], parados2dias: [], leadtimeMedio: 0, leadtimePorPsicologo: [] });
const [concluidos, setConcluidos] = useState({ funil: { total: 0, aprovados: 0, admitidos: 0 }, reprovados: [] });
const [filtroPeriodo, setFiltroPeriodo] = useState({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear() });
```

### Lógica de cálculo
Toda em `fetchDashboardData()` após o `Promise.all` existente, uma única passagem por `cands`.

### UI
- Linha de 4 cards com hover tooltip via posição relativa/absoluta (sem biblioteca externa)
- Bloco 2 como novo `glass-panel` abaixo do existente
- Funil de concluídos: barras horizontais com percentual de conversão
- Análise de reprovados: 5 tabs (botões simples com estado ativo)

---

## 5. Plano de Testes (manual)

| Cenário | Esperado |
|---------|---------|
| Candidato em Documentação com `docs_request_date` nulo | Aparece no funil com `tempoParado = 0` |
| Candidato em Exames com `medical_request_date` preenchido há 5 dias | `tempoParado = 5` |
| Candidato com `admission_date` mas sem `analysis_update_date` | Leadtime usa `interview_date` como fallback |
| Nenhum candidato concluído no período selecionado | Funil exibe zeros; análise de reprovados exibe "Nenhum resultado" |
| Período sem reprovados | Tabs de análise exibem estado vazio |
| Candidato reprovado sem `cancellation_reason_name` | Agrupado em "Sem motivo informado" |

---

## 6. Decisões Confirmadas (2026-07-10)

1. **Leadtime:** `data_aprovação_entrevista` = `analysis_update_date`; fallback para `interview_date` se nulo. ✅
2. **Bloco 2 — Total de candidatos:** inclui admitidos + reprovados/cancelados do período. ✅
3. **Bloco 2 — Data de referência para reprovados/cancelados:** `updated_at`. ✅
