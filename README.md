# Brownfield SDD Kit para Claude Code

Bem-vindo ao seu kit de ferramentas para aplicar Spec-Driven Development (SDD) em **projetos já existentes** (Brownfield).

Diferente de começar um projeto do zero, aplicar IA em um código legado ou em andamento exige uma abordagem cuidadosa. Se a IA não entender a arquitetura atual, ela vai gerar código que quebra padrões, duplica dependências e introduz bugs.

Este kit foi desenhado com base nas melhores práticas da indústria (como o Augment Code e o Spec Kit) para garantir que o Claude Code **rastreie, entenda e respeite** o seu projeto antes de escrever qualquer linha de código.

## O que tem neste Kit?

1.  **`AUDIT_PROMPT.md`**: O prompt de Auditoria e Bootstrap. Ele força o Claude a agir como um Arquiteto, rastreando todo o seu código atual (tech stack, estrutura, padrões e testes) antes de propor qualquer mudança.
2.  **`CLAUDE.md`**: A "Constituição do Projeto" adaptada para Brownfield. O Claude vai preencher este arquivo com as descobertas da auditoria, garantindo que ele sempre lembre das regras do seu projeto.
3.  **`docs/specs/TEMPLATE_CHANGE_SPEC.md`**: O template de "Change-Level Spec" (Especificação de Mudança). Em projetos existentes, não especificamos o sistema inteiro; especificamos apenas o delta (o que vai mudar) e as invariantes (o que NÃO deve quebrar).

## Como Instalar e Usar

### Passo 1: Preparar o Terreno
1.  Abra a pasta do seu projeto existente no VS Code.
2.  Extraia o conteúdo deste arquivo ZIP (`brownfield-sdd-kit.zip`) diretamente na raiz da pasta do seu projeto.

Sua estrutura deve ficar parecida com isso (mesclada com seus arquivos atuais):
```text
/seu-projeto-existente
├── src/ (seus arquivos atuais)
├── package.json (seus arquivos atuais)
├── CLAUDE.md (do kit)
├── README-BROWNFIELD.md (do kit)
├── AUDIT_PROMPT.md (do kit)
└── docs/ (sua pasta existente)
    └── specs/ (nova subpasta do kit)
        └── TEMPLATE_CHANGE_SPEC.md (do kit)
```

### Passo 2: A Auditoria Inicial (Obrigatório)
1.  Abra o Claude Code no terminal do VS Code (ou a extensão).
2.  Abra o arquivo `AUDIT_PROMPT.md`, copie todo o conteúdo do bloco de código e cole no chat do Claude.
3.  O Claude começará a **rastrear o seu projeto** usando comandos de busca. Ele vai analisar seu `package.json`, estrutura de pastas e ler alguns arquivos para entender seu estilo de código.
4.  Ele apresentará um "Resumo Executivo". Se estiver correto, aprove. Ele então atualizará o `CLAUDE.md` com essas informações.

### Passo 3: O Workflow de Mudança (Change-Level SDD)
Após a auditoria, para cada nova funcionalidade, refatoração ou correção de bug, siga este fluxo:

1.  **Especifique o Delta:** Peça ao Claude para criar uma nova spec baseada no `TEMPLATE_CHANGE_SPEC.md` (ex: "Crie a spec para adicionar o campo CPF no cadastro em `docs/specs/add-cpf.md`").
2.  **Revise as Invariantes:** Leia a spec gerada com atenção especial à seção "Invariantes". Garanta que o Claude entendeu o que ele NÃO deve quebrar.
3.  **Harness (Dupla Verificação):** Peça ao Claude para atualizar ou criar os testes para essa mudança. Os testes devem validar a nova funcionalidade E garantir que o código antigo continua funcionando.
4.  **Implemente:** Só então diga: "Implemente o código respeitando a arquitetura atual até que todos os testes passem".

## Por que o Brownfield SDD é diferente?
- **A Especificação segue o Entendimento:** A IA precisa ler o código antes de escrever a spec.
- **Escopo Reduzido:** Specs gigantes em projetos grandes confundem a IA. Focamos apenas no "delta" da mudança.
- **Proteção do Legado:** O foco principal é não quebrar o que já funciona (Invariantes e Testes de Regressão).

Com este kit, você transforma o Claude Code de um "gerador de código aleatório" em um membro sênior da sua equipe que respeita o legado do seu projeto!
