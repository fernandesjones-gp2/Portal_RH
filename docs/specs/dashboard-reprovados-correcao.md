# Spec: Dashboard — Correção da Análise de Reprovados/Cancelados

**Data:** 2026-07-11  
**Status:** Implementado em 2026-07-11

---

## 1. Comportamento Atual (Bug)

A seção "Análise dos Reprovados / Cancelados" usa o mesmo filtro de período (`inPeriod(c.updated_at)`) que a seção de funil de conversão. Isso faz com que só apareçam os candidatos cujo `updated_at` cai dentro do mês/ano selecionado — na prática, predominam apenas os status `'Reprovado'` (entrevista).

A classificação por etapa atual usa `ETAPA_MAP` baseado exclusivamente no status final, sem inferência de jornada.

---

## 2. Comportamento Alvo

### 2.1 Separação de filtros

- **Funil de conversão** (bloco existente) → continua usando `reprovadosPeriodo` com `inPeriod(c.updated_at)`. Sem mudança.
- **Análise de Reprovados/Cancelados** → passa a usar `todosReprovados`: **sem filtro de período**, todos os históricos de `TERMINAL_REP` + `process_type` in `['Admissão','Readmissão']`.

O header da seção mostra o total histórico (ex: "Análise dos Reprovados / Cancelados (histórico: 47)").

### 2.2 Nova classificação por etapa

Nova função `getEtapa(c)` que retorna um dos 4 rótulos:

| Etapa | Condição |
|-------|----------|
| **Entrevista** | `status` in `['Reprovado', 'Falta', 'Desistência']` |
| **Documentação (Bloco 1)** | `status === 'Reprovado Documentação'` · OU · `status === 'Cancelado'` + `interview_date` setado + sem `docs_receive_date` |
| **Pré-Admissão (Bloco 2)** | `status` in `['Reprovado pelo Médico', 'Inapto Médico']` · OU · `status === 'Cancelado'` + `docs_receive_date` setado + sem `medical_result_date` |
| **Pós concluído (Bloco 3)** | `status === 'Cancelado'` + `medical_result_date` setado |

Para `Cancelado` sem `interview_date` → **Entrevista** (cancelado antes de iniciar).

### 2.3 Tabs de análise

Os 5 tabs existentes (Psicólogo, Função, Unidade, Etapa, Motivo) passam a usar `todosReprovados`.

A tab "Por Etapa" usa `getEtapa(c)` em vez de `ETAPA_MAP[c.status]`.

---

## 3. Invariantes (não pode quebrar)

- `reprovadosPeriodo` para `totalPeriodo` e `aprovadosIntervistaPeriodo` — sem alteração
- Funil de conversão do período — sem alteração
- `admitidosPeriodo` — sem alteração
- `TERMINAL_REP` e `TERMINAL` constantes — sem alteração

---

## 4. Campos usados na inferência (já disponíveis em `rawCands`)

- `status` (terminal)
- `process_type`
- `interview_date`
- `docs_receive_date`
- `medical_result_date`
- `responsible_name`, `job_role_name`, `unit_name`, `cancellation_reason_name` (já enriquecidos via `fetchDashboardData`)
