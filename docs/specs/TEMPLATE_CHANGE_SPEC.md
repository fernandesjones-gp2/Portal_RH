# Especificação de Mudança (Change-Level Spec): [Nome da Mudança]

*Nota: Em projetos Brownfield, não especificamos o sistema inteiro. Esta spec foca apenas no delta (o que vai mudar) e no que deve ser protegido.*

## 1. Contexto e Comportamento Atual
- **O que o sistema faz hoje:** [Descreva como a funcionalidade atual funciona, ou qual é o bug/limitação.]
- **Arquivos/Módulos Afetados:** [Liste os principais arquivos que já existem e serão tocados.]

## 2. Comportamento Alvo (O Delta)
- **Objetivo da Mudança:** [O que queremos alcançar com esta alteração?]
- **Novo Fluxo/Regra de Negócio:** [Passo a passo do novo comportamento esperado.]
- **Critérios de Aceite:** [Como saberemos que a mudança foi bem-sucedida?]

## 3. Invariantes (O que NÃO deve mudar)
- **Comportamentos a Proteger:** [Liste fluxos, regras ou integrações que devem continuar funcionando exatamente como antes.]
- **Limites de Escopo:** [O que está explicitamente FORA do escopo desta mudança? Ex: "Não vamos refatorar o controller inteiro, apenas adicionar o novo campo".]

## 4. Decisões Técnicas e Integração
- **Alterações no Modelo de Dados:** [Novas colunas, tabelas ou mudanças de schema.]
- **Alterações em APIs/Interfaces:** [Novos endpoints, mudanças em payloads.]
- **Dependências:** [Novas bibliotecas necessárias ou serviços externos.]

## 5. Plano de Testes (Dupla Verificação)
- **Testes da Nova Funcionalidade:** [Quais testes devem ser adicionados para validar o "Comportamento Alvo"?]
- **Testes de Regressão:** [Quais testes existentes devem passar, ou quais novos testes devem ser criados para garantir as "Invariantes"?]

---
*Nota para o Claude Code: Esta especificação é a fonte da verdade para esta mudança específica. Qualquer código gerado deve aderir estritamente a este documento e respeitar a arquitetura existente do projeto. Se você encontrar dependências ocultas ou riscos de quebra durante a implementação, PARE e use a ferramenta `AskUserQuestion` para esclarecer antes de prosseguir.*
