# Spec: Dashboard — Atualização das Regras do Funil + Volume por Psicólogo/Mês

**Data:** 2026-07-11  
**Status:** Aguardando aprovação

---

## 1. Comportamento Atual (problema)

O funil "Processos em Andamento" usa nomes de status antigos/legados que não correspondem mais ao banco vivo:

| Bucket | Condição atual (legado) |
|--------|------------------------|
| documentacao | status IN ['1. Em Andamento', 'Em Andamento', 'Aprovado', ...] + docs_receive_date nulo |
| exames | status IN ['2. Pré-Admissão', 'Pré-Admissão', 'Aguardando Exame', ...] + condições |
| prontos | status IN ['3. Prontos para Admitir', 'Pré-Admissão (Pronto)', ...] |

Esses status antigos não existem mais no banco — candidatos ativos com `status = 'Pré-Admissão (Pendente)'` e `status = 'Pré-Admissão (Pronto)'` não aparecem no funil.

---

## 2. Comportamento Alvo

### 2.1 Nova lógica do funil (alinhada ao pipeline de admissão)

| Bucket | Condição nova | Tempo parado |
|--------|--------------|--------------|
| **entrevistas** | `status IN ['Cadastrado','Agendado','Reagendado']` | `Hoje − interview_date` |
| **documentacao** | `status = 'Pré-Admissão (Pendente)' AND NOT (analysis_status = 'Aprovado' AND docs_status = 'Recebida') AND docs_receive_date IS NULL` | `Hoje − docs_request_date` (fallback `updated_at`) |
| **exames** | `status = 'Pré-Admissão (Pendente)' AND analysis_status = 'Aprovado' AND docs_status = 'Recebida' AND medical_result_date IS NULL` | `Hoje − medical_request_date` (fallback `updated_at`) |
| **prontos** | `status = 'Pré-Admissão (Pronto)'` | sem tempo parado |

Essas condições são espelho exato dos Blocos 1, 2 e 3 da tela de pré-admissão.

---

### 2.2 Volume por Psicólogo por Mês (nova visualização)

Na seção "Volume Global de Atendimentos", adicionar um **toggle** com duas visões:

**Visão A (atual):** Gráfico de barras mensais + Ranking por psicólogo

**Visão B (nova):** Matriz "Psicólogo × Mês" (últimos 6 meses)

```
Psicólogo        | Jun/26 | Jul/26 | ...
─────────────────|────────|────────|
Ana S.           |   12   |    8   |
Carlos M.        |    7   |   11   |
...
Total            |   19   |   19   |
```

- Linhas: cada psicólogo com atendimentos no período
- Colunas: últimos 6 meses (mais recente à direita)
- Células: contagem de candidatos atendidos (com `interview_date` no mês)
- Linha de Total ao final
- Células com valor 0 exibidas como `—`

---

## 3. Invariantes (não pode quebrar)

- Modal de detalhes (Ver candidatos por etapa) continua funcional
- Alerta de gargalo por responsável/função (entrevistas > 2 dias) mantido
- Cards KPI (Leadtime, Índice de Aprovação, Parados > 2 dias) sem alteração
- Bloco 2 (Processos Concluídos) sem alteração
- Fetch único — sem novos endpoints

---

## 4. Implementação técnica

### Funil
Substituir blocos `isBloco1`, `isBloco2`, `isBloco3` na função `fetchDashboardData()` pelas condições novas acima.

### Matriz Psicólogo × Mês
Adicionar no loop `cands.forEach`:
```js
// Para cada candidato com interview_date: registrar em psico+mês
if (c.interview_date && c.respName !== 'Sistema') {
  const key = `${ano}-${mes}`;
  psicoMesMap[c.respName] = psicoMesMap[c.respName] || {};
  psicoMesMap[c.respName][key] = (psicoMesMap[c.respName][key] || 0) + 1;
}
```
Armazenar os últimos 6 meses para renderizar a matriz.

Novo estado: `matrizVolume: { meses: [], psicologos: [] }` dentro de `historyStats`.

Toggle de visão: `useState('mensal' | 'matriz')` local ao painel de Volume.

---

## 5. Plano de testes (manual)

| Cenário | Esperado |
|---------|---------|
| Candidato com `status = 'Pré-Admissão (Pendente)'`, `docs_receive_date` null | Aparece em Documentação |
| Candidato com `status = 'Pré-Admissão (Pendente)'`, `analysis_status = 'Aprovado'`, `docs_status = 'Recebida'`, `medical_result_date` null | Aparece em Exames Médicos |
| Candidato com `status = 'Pré-Admissão (Pronto)'` | Aparece em Prontos p/ Admitir |
| Status legado ('Em Andamento') que não existe mais | Ignorado silenciosamente |
| Toggle Mensal → Matriz | Exibe tabela com últimos 6 meses |
| Psicólogo sem atendimentos no mês | Exibe `—` na célula |
