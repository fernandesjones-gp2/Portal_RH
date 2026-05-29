# README Guide — Estrutura, Seções e Exemplos

## Índice
1. Anatomia de um Bom README
2. Template Completo
3. README por Tipo de Projeto
4. Badges
5. Seções Opcionais
6. Anti-Patterns

---

## 1. Anatomia de um Bom README

Um README responde 5 perguntas em ordem:

```
1. O QUE é isso?         → Título + descrição em 1 frase
2. POR QUE usar?         → Problema que resolve, features
3. COMO instalar?        → Setup em < 5 minutos
4. COMO usar?            → Exemplo básico funcional
5. COMO contribuir?      → Link para CONTRIBUTING.md
```

### Regra dos 30 segundos

Em 30 segundos de scan, o leitor deve saber:
- O que o projeto faz
- Se resolve o problema dele
- Como começar a usar

---

## 2. Template Completo

```markdown
# Nome do Projeto

> Descrição em uma frase que explica O QUE faz e PARA QUEM.

[![CI](https://github.com/org/repo/actions/workflows/ci.yml/badge.svg)](...)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Sobre

[2-3 parágrafos explicando o problema que resolve, para quem é,
e o que diferencia de alternativas. Concreto, sem marketing vazio.]

### Features

- **Feature 1** — Descrição curta do benefício
- **Feature 2** — Descrição curta do benefício
- **Feature 3** — Descrição curta do benefício

## Quick Start

### Pré-requisitos

- Node.js 22+
- PostgreSQL 16+
- Docker (opcional)

### Instalação

```bash
# Clonar
git clone https://github.com/org/repo.git
cd repo

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Criar banco e rodar migrations
npm run db:create
npm run db:migrate
npm run db:seed

# Iniciar
npm run dev
```

Acesse http://localhost:3000

### Com Docker

```bash
docker compose up -d
```

## Uso

### Exemplo básico

```javascript
// Exemplo funcional mínimo que mostra o caso de uso principal
import { Client } from 'meu-projeto';

const client = new Client({ apiKey: process.env.API_KEY });
const result = await client.doSomething({ param: 'value' });
console.log(result);
```

### API

Documentação completa da API: [docs/api/](docs/api/)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/users` | GET | Listar usuários |
| `/api/users` | POST | Criar usuário |
| `/api/users/:id` | GET | Buscar usuário |

## Arquitetura

[Diagrama ou descrição breve. Link para docs/architecture.md se detalhado.]

```
src/
├── controllers/    ← Handlers HTTP
├── services/       ← Lógica de negócio
├── repositories/   ← Acesso a dados
├── middleware/      ← Auth, validation, error handling
└── utils/          ← Funções utilitárias
```

## Variáveis de Ambiente

| Variável | Descrição | Default | Obrigatória |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL | — | Sim |
| `JWT_SECRET` | Secret para tokens JWT | — | Sim |
| `PORT` | Porta da aplicação | `3000` | Não |
| `LOG_LEVEL` | Nível de log | `info` | Não |

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia em modo desenvolvimento (hot reload) |
| `npm run build` | Build para produção |
| `npm run start` | Inicia em modo produção |
| `npm run test` | Roda testes |
| `npm run lint` | Roda linter |
| `npm run db:migrate` | Roda migrations |
| `npm run db:seed` | Popula dados de exemplo |

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para guidelines.

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).
```

---

## 3. README por Tipo de Projeto

### Biblioteca / Package (npm, PyPI)

Focar em: instalação via package manager, exemplos de uso, API reference.

```markdown
## Instalação

```bash
npm install minha-lib
# ou
yarn add minha-lib
```

## Uso

```javascript
import { parse, format } from 'minha-lib';

// Caso de uso 1
const result = parse('input');

// Caso de uso 2
const output = format(data, { option: true });
```

## API Reference

### `parse(input: string, options?: ParseOptions): Result`

Parsa o input e retorna um Result.

**Parâmetros:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `input` | `string` | — | Texto para parsear |
| `options.strict` | `boolean` | `false` | Modo estrito |

**Retorno:** `Result` — Objeto com...

**Exemplo:**
```javascript
const result = parse('hello world', { strict: true });
// { tokens: ['hello', 'world'], count: 2 }
```
```

### CLI Tool

Focar em: instalação global, exemplos de comandos, flags/options.

```markdown
## Instalação

```bash
npm install -g minha-cli
# ou npx
npx minha-cli [command]
```

## Comandos

### `minha-cli init [nome]`

Cria novo projeto.

```bash
minha-cli init meu-app
minha-cli init meu-app --template=typescript
```

**Flags:**
| Flag | Descrição |
|------|-----------|
| `--template` | Template a usar (default, typescript, minimal) |
| `--no-git` | Não inicializar git |
| `-y, --yes` | Aceitar todos defaults |

### `minha-cli build`

Builda o projeto para produção.

```bash
minha-cli build
minha-cli build --watch
minha-cli build --output=./dist
```
```

### API / Backend Service

Focar em: setup local, variáveis de ambiente, endpoints, autenticação.

### Frontend App

Focar em: setup local, browser support, como fazer build e deploy.

---

## 4. Badges

```markdown
<!-- CI/CD -->
[![CI](https://github.com/org/repo/actions/workflows/ci.yml/badge.svg)](link)
[![Deploy](https://github.com/org/repo/actions/workflows/deploy.yml/badge.svg)](link)

<!-- Quality -->
[![Coverage](https://codecov.io/gh/org/repo/branch/main/graph/badge.svg)](link)
[![Code Quality](https://img.shields.io/codeclimate/maintainability/org/repo)](link)

<!-- Package -->
[![npm version](https://img.shields.io/npm/v/package-name)](link)
[![Downloads](https://img.shields.io/npm/dm/package-name)](link)

<!-- Meta -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
```

Regra: máximo 5-6 badges. Mais que isso vira poluição visual.

---

## 5. Seções Opcionais

```markdown
## Screenshots / Demo

[GIF ou link para demo. GIF > screenshot > descrição.]

## Roadmap

- [x] Feature A (v1.0)
- [x] Feature B (v1.1)
- [ ] Feature C (planejado para v2.0)
- [ ] Feature D (em avaliação)

## FAQ

**P: Como faço X?**
R: Use o comando `npm run x` com a flag `--option`.

**P: Funciona com Y?**
R: Sim, desde a versão 1.2. Veja [docs/compatibility.md](docs/compatibility.md).

## Acknowledgments

- [Lib X](link) — Usada para Y
- [Projeto Z](link) — Inspiração para a arquitetura
```

---

## 6. Anti-Patterns

| Anti-Pattern | Problema | Fix |
|-------------|---------|-----|
| README vazio (só título) | Ninguém sabe o que é | Mínimo: descrição + setup + uso |
| Setup que não funciona | Frustração imediata, abandono | Testar em máquina limpa |
| Marketing em vez de docs | "Revolucionário", "blazing fast" sem substância | Mostrar, não dizer |
| Wall of text sem headers | Impossível de escanear | Headers, bullets, tabelas |
| Dependências implícitas | "Certifique-se de ter X instalado" sem dizer qual X | Listar pré-requisitos explicitamente |
| Sem exemplos | Leitor precisa adivinhar como usar | Exemplo funcional mínimo |
| Screenshots de código | Não pode copiar, desatualiza rápido | Blocos de código em texto |
| README de 3000 linhas | Intimidador, nunca atualizado | Separar em docs/, linkar do README |
