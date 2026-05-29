# E2E Testing — Cypress, Playwright, Fluxos Críticos

## Índice
1. Quando Usar E2E
2. Playwright — Setup e Patterns
3. Cypress — Setup e Patterns
4. Page Object Model
5. Fluxos Críticos a Testar
6. Lidando com Flaky Tests
7. E2E no CI/CD

---

## 1. Quando Usar E2E

```
E2E testa o FLUXO COMPLETO do usuário: browser → frontend → API → DB.

USAR E2E para:
├── Fluxos críticos de negócio (login, checkout, onboarding)
├── Fluxos cross-service (que envolvem múltiplos sistemas)
├── Smoke tests pós-deploy ("está funcionando?")
└── Regressão de fluxos que já quebraram

NÃO USAR E2E para:
├── Edge cases (usar unit tests — muito mais barato)
├── Validação de formulário (unit/integration)
├── Cada permutação de dados (parametrize com unit)
├── Performance (usar load tests)
└── Layout/visual (usar visual regression específico)

Meta: 5-15 testes E2E que cobrem 80% do valor.
Não 200 testes E2E que demoram 45 minutos e quebram toda hora.
```

---

## 2. Playwright — Setup e Patterns

### Setup

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0, // Retry em CI para flaky
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Teste de login

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('user@test.com');
    await page.getByLabel('Senha').fill('Test@123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Verificar redirect para dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Bem-vindo')).toBeVisible();
  });

  test('should show error with invalid password', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('user@test.com');
    await page.getByLabel('Senha').fill('wrong-password');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('Email ou senha inválidos')).toBeVisible();
    await expect(page).toHaveURL('/login'); // Não redirecionou
  });
});
```

### Teste de checkout completo

```typescript
// tests/e2e/checkout.spec.ts
test.describe('Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@test.com');
    await page.getByLabel('Senha').fill('Test@123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should complete purchase flow', async ({ page }) => {
    // 1. Navegar para produtos
    await page.goto('/products');

    // 2. Adicionar ao carrinho
    await page.getByTestId('product-card-prod-001')
      .getByRole('button', { name: 'Adicionar' }).click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    // 3. Ir para checkout
    await page.getByRole('link', { name: 'Carrinho' }).click();
    await expect(page).toHaveURL('/cart');

    // 4. Finalizar pedido
    await page.getByRole('button', { name: 'Finalizar Pedido' }).click();

    // 5. Verificar confirmação
    await expect(page).toHaveURL(/\/orders\/[\w-]+/);
    await expect(page.getByText('Pedido realizado')).toBeVisible();
    await expect(page.getByText('Pendente')).toBeVisible();
  });
});
```

### Helpers — autenticação reutilizável

```typescript
// tests/e2e/helpers/auth.ts
import { Page } from '@playwright/test';

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('/dashboard');
}

// Ou via API (mais rápido — evita UI para setup)
export async function loginViaAPI(page: Page, email: string, password: string) {
  const response = await page.request.post('/api/v1/auth/login', {
    data: { email, password },
  });
  const { data } = await response.json();
  // Setar token no storage
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
  }, data.accessToken);
  await page.goto('/dashboard');
}
```

---

## 3. Cypress — Setup e Patterns

### Setup

```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false, // Ativar só no CI se precisar debug
    screenshotOnRunFailure: true,
    retries: { runMode: 2, openMode: 0 },
    defaultCommandTimeout: 10000,
  },
});
```

### Commands customizados

```javascript
// cypress/support/commands.js
Cypress.Commands.add('login', (email = 'user@test.com', password = 'Test@123') => {
  // Via API (rápido — evitar UI para setup)
  cy.request('POST', '/api/v1/auth/login', { email, password }).then((res) => {
    window.localStorage.setItem('token', res.body.data.accessToken);
  });
});

Cypress.Commands.add('seedDB', () => {
  cy.request('POST', '/api/test/seed'); // Endpoint só existe em test env
});

Cypress.Commands.add('cleanDB', () => {
  cy.request('POST', '/api/test/clean');
});
```

### Teste

```javascript
// cypress/e2e/checkout.cy.js
describe('Checkout', () => {
  beforeEach(() => {
    cy.cleanDB();
    cy.seedDB();
    cy.login();
  });

  it('should add product and complete checkout', () => {
    cy.visit('/products');
    cy.get('[data-testid="product-card-prod-001"]')
      .find('button').contains('Adicionar').click();
    cy.get('[data-testid="cart-count"]').should('have.text', '1');

    cy.visit('/cart');
    cy.contains('button', 'Finalizar Pedido').click();

    cy.url().should('match', /\/orders\/[\w-]+/);
    cy.contains('Pedido realizado').should('be.visible');
  });
});
```

---

## 4. Page Object Model

```typescript
// tests/e2e/pages/login-page.ts
import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  private page: Page;
  private emailInput: Locator;
  private passwordInput: Locator;
  private submitButton: Locator;
  private errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Senha');
    this.submitButton = page.getByRole('button', { name: 'Entrar' });
    this.errorMessage = page.getByTestId('login-error');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toHaveText(message);
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL('/dashboard');
  }
}

// Uso no teste — limpo e reutilizável
test('should login successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@test.com', 'Test@123');
  await loginPage.expectRedirectToDashboard();
});
```

---

## 5. Fluxos Críticos a Testar

```
Prioridade P0 (obrigatório):
├── Login (email + senha → dashboard)
├── Registro (novo user → email de confirmação → login)
├── Fluxo de compra (produto → carrinho → checkout → confirmação)
├── Fluxo de pagamento (se integra com gateway)
└── Logout (session limpa, redirect para login)

Prioridade P1 (muito importante):
├── Onboarding (primeiro uso → setup → aha moment)
├── CRUD principal (criar, editar, deletar o recurso core)
├── Busca e filtros (encontrar o que precisa)
├── Perfil / configurações (editar dados pessoais)
└── Permissões (admin vê X, user não vê)

Prioridade P2 (quando possível):
├── Recuperação de senha
├── Fluxos de erro (404, 500 — mostra tela amigável?)
├── Empty states (primeira vez sem dados)
├── Notificações (recebe e visualiza)
└── Responsive (funciona no mobile?)
```

---

## 6. Lidando com Flaky Tests

```
Flaky = teste que passa e falha aleatoriamente.
Flaky test é PIOR que sem teste (falso alarme → ignorar alertas).

Causas comuns e fixes:

1. Timing / Race condition
   ❌ cy.wait(3000) / await sleep(3000)
   ✅ Aguardar elemento: await page.waitForSelector('[data-testid="result"]')
   ✅ Retry automático: Playwright e Cypress auto-retry assertions

2. Estado compartilhado entre testes
   ❌ Testes dependem de dados de outro teste
   ✅ Cada teste faz seed dos próprios dados + cleanup

3. Animações
   ❌ Clicar durante animação CSS
   ✅ Desabilitar animações no env de teste
   ✅ Aguardar animação: page.waitForLoadState('networkidle')

4. APIs externas instáveis
   ❌ E2E chama API real do Stripe
   ✅ Mock da API (MSW, Wiremock) ou ambiente sandbox estável

5. Viewport / resolução
   ❌ Teste assume 1920x1080 mas CI roda em 1024x768
   ✅ Configurar viewport explícito no config

Política de flaky tests:
├── Quarentena: mover para suite separada
├── Deadline: 1 semana para corrigir
├── Se não corrigir: deletar (teste que não confia não serve)
└── Monitorar: dashboard de flaky rate
```

---

## 7. E2E no CI/CD

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }

      - run: npm ci
      - run: npx prisma migrate deploy
        env: { DATABASE_URL: 'postgresql://postgres:test@localhost/test_db' }
      - run: npm run seed:test

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E
        run: npx playwright test
        env:
          DATABASE_URL: 'postgresql://postgres:test@localhost/test_db'
          REDIS_URL: 'redis://localhost:6379'

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```
