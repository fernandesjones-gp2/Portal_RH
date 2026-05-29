# Project Constitution (CLAUDE.md) - Brownfield Edition

Este arquivo define as regras globais, padrões de código e o fluxo de trabalho (workflow) para este projeto existente. Ele atua como a "memória persistente" e a fonte da verdade para o comportamento do Claude Code.

## 1. Workflow: Brownfield Spec-Driven Development (SDD)
- **NUNCA inicie a codificação diretamente.** Siga sempre o ciclo: Audit -> Plan -> Implement -> Commit.
- **Auditoria Contínua:** Antes de qualquer alteração, rastreie o código existente relacionado à mudança para entender o contexto e as dependências.
- **Change-Level Specs:** Em vez de especificar o sistema inteiro, crie especificações focadas apenas no delta da mudança (`docs/specs/*.md`).
- **Test Harness Primeiro:** Para cada nova funcionalidade ou correção de bug, escreva ou atualize os testes automatizados (o Harness) **antes** da implementação.
- **Validação Dupla:** Após implementar, rode os testes. Eles devem confirmar que a nova funcionalidade funciona E que o comportamento existente não foi quebrado.

## 2. Tech Stack & Padrões de Código (Descobertos na Auditoria)
*(O Claude preencherá esta seção após a auditoria inicial)*
- **Frontend:** [A ser preenchido]
- **Backend:** [A ser preenchido]
- **Banco de Dados:** [A ser preenchido]
- **Testes:** [A ser preenchido]
- **Padrões Identificados:**
  - [Ex: Uso de classes vs funções]
  - [Ex: Convenções de nomenclatura]
  - [Ex: Tratamento de erros]

## 3. Estrutura de Diretórios
- `docs/specs/`: Especificações de nível de mudança (Change-Level Specs).
- `src/` (ou equivalente): Código-fonte da aplicação.
- `tests/` (ou equivalente): Test Harness (arquivos de teste).
- `.claude/skills/`: Skills customizadas para o Claude Code.

## 4. Comandos Essenciais
*(O Claude preencherá esta seção após a auditoria inicial)*
- Instalar dependências: [A ser preenchido]
- Rodar testes (Harness): [A ser preenchido]
- Iniciar servidor de dev: [A ser preenchido]
- Build de produção: [A ser preenchido]

## 5. Fronteiras e Restrições (O que NÃO fazer)
- **NUNCA** modifique arquivos fora do escopo da Change-Level Spec atual sem permissão explícita.
- **NUNCA** reescreva ou refatore código legado que não esteja diretamente relacionado à tarefa atual, a menos que solicitado.
- **NUNCA** inclua credenciais, chaves de API ou segredos no código-fonte. Use variáveis de ambiente (`.env`).
- **NUNCA** pule a etapa de testes. O Test Harness é inegociável para garantir que não quebramos o que já funciona.
- Se o contexto ficar muito grande ou confuso, sugira o uso do comando `/compact` ou inicie uma nova sessão.
