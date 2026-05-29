# Architecture Quality — SOLID, Coupling e Design Patterns

## Índice
1. Princípios SOLID — Detecção e Fix
2. Coupling e Cohesion
3. Design Patterns Mal Aplicados
4. Smells Arquiteturais

---

## 1. Princípios SOLID — Detecção e Fix

### S — Single Responsibility Principle

```javascript
// 🟡 MEDIUM — Classe faz tudo (God Class)
class UserService {
  async register(data) { ... }
  async login(email, password) { ... }
  async sendWelcomeEmail(user) { ... }        // Responsabilidade de email
  async generateInvoice(user) { ... }          // Responsabilidade de billing
  async uploadAvatar(user, file) { ... }       // Responsabilidade de storage
  async calculateLoyaltyPoints(user) { ... }   // Responsabilidade de loyalty
}

// ✅ FIX — Uma responsabilidade por classe
class AuthService { register(data) { ... } login(email, pw) { ... } }
class EmailService { sendWelcome(user) { ... } }
class BillingService { generateInvoice(user) { ... } }
class StorageService { uploadAvatar(user, file) { ... } }
class LoyaltyService { calculatePoints(user) { ... } }
```

**Sinal**: Classe/arquivo com 500+ linhas. Muitos métodos sem relação entre si.
Imports de vários domínios diferentes.

### O — Open/Closed Principle

```javascript
// 🟡 MEDIUM — Switch/if chain que cresce a cada feature
function calculateDiscount(type, amount) {
  if (type === 'regular') return amount * 0.05;
  if (type === 'premium') return amount * 0.10;
  if (type === 'vip') return amount * 0.15;
  if (type === 'employee') return amount * 0.20; // Novo tipo = editar função
  // ... cresce infinitamente
}

// ✅ FIX — Strategy pattern (aberto para extensão, fechado para modificação)
const discountStrategies = {
  regular: (amount) => amount * 0.05,
  premium: (amount) => amount * 0.10,
  vip: (amount) => amount * 0.15,
  employee: (amount) => amount * 0.20,
};
function calculateDiscount(type, amount) {
  const strategy = discountStrategies[type];
  if (!strategy) throw new Error(`Unknown discount type: ${type}`);
  return strategy(amount);
}
// Adicionar novo tipo = adicionar 1 linha na config, sem editar função
```

**Sinal**: Switch/case ou if/else chain com 5+ branches que cresce com cada feature.

### L — Liskov Substitution Principle

```javascript
// 🟡 MEDIUM — Subclasse quebra contrato do pai
class Rectangle {
  setWidth(w) { this.width = w; }
  setHeight(h) { this.height = h; }
  area() { return this.width * this.height; }
}
class Square extends Rectangle {
  setWidth(w) { this.width = w; this.height = w; } // Quebra: setar width muda height
  setHeight(h) { this.width = h; this.height = h; }
}
// Código que espera Rectangle quebra com Square

// ✅ FIX — Composição em vez de herança
class Shape { area() { throw new Error('Not implemented'); } }
class Rectangle extends Shape {
  constructor(w, h) { super(); this.width = w; this.height = h; }
  area() { return this.width * this.height; }
}
class Square extends Shape {
  constructor(side) { super(); this.side = side; }
  area() { return this.side * this.side; }
}
```

### I — Interface Segregation Principle

```typescript
// 🟡 MEDIUM — Interface gigante que força implementações vazias
interface Repository {
  findAll(): Promise<Entity[]>;
  findById(id: string): Promise<Entity>;
  create(data: CreateDTO): Promise<Entity>;
  update(id: string, data: UpdateDTO): Promise<Entity>;
  delete(id: string): Promise<void>;
  bulkCreate(data: CreateDTO[]): Promise<Entity[]>;
  search(query: string): Promise<Entity[]>;
  export(format: string): Promise<Buffer>;
}
// ReadOnlyRepository precisa implementar create, delete, export → throws "Not supported"

// ✅ FIX — Interfaces segregadas
interface Readable<T> { findAll(): Promise<T[]>; findById(id: string): Promise<T>; }
interface Writable<T> { create(data: any): Promise<T>; update(id: string, data: any): Promise<T>; }
interface Deletable { delete(id: string): Promise<void>; }
interface Searchable<T> { search(query: string): Promise<T[]>; }
// Compor conforme necessidade:
interface FullRepository<T> extends Readable<T>, Writable<T>, Deletable {}
interface ReadOnlyRepository<T> extends Readable<T> {} // Limpo
```

### D — Dependency Inversion Principle

```javascript
// 🟡 MEDIUM — Dependência direta de implementação
class OrderService {
  constructor() {
    this.db = new PostgresDatabase();     // Acoplado a Postgres
    this.mailer = new SendGridMailer();   // Acoplado a SendGrid
  }
}

// ✅ FIX — Injeção de dependência (depender de abstração)
class OrderService {
  constructor(db, mailer) { // Recebe interfaces, não implementações
    this.db = db;
    this.mailer = mailer;
  }
}
// Injeção:
const service = new OrderService(new PostgresDatabase(), new SendGridMailer());
// Para testes:
const service = new OrderService(new MockDatabase(), new MockMailer());
```

---

## 2. Coupling e Cohesion

### Acoplamento alto (ruim)

```javascript
// 🟡 MEDIUM — Módulo A conhece internals do módulo B
// orders/service.js
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
// OrderService acessa tabela de users diretamente!

// ✅ FIX — Usar interface do módulo
const user = await userService.findById(userId);
// OrderService só conhece a interface pública de UserService
```

Sinais de acoplamento alto:
- Módulo A importa 5+ módulos
- Mudar módulo B quebra módulos A, C, D
- Testes de A precisam mockar B, C, D, E
- Circular dependencies (A importa B que importa A)

### Coesão baixa (ruim)

```javascript
// 🟡 MEDIUM — Módulo utils com funções sem relação
// utils.js
export function formatDate(date) { ... }
export function calculateTax(amount) { ... }
export function sendEmail(to, body) { ... }
export function resizeImage(buffer, width) { ... }
// "Utils" é o sintoma #1 de baixa coesão

// ✅ FIX — Agrupar por domínio
// dates.js → formatDate, parseDate, diffDays
// billing.js → calculateTax, calculateDiscount
// email.js → sendEmail, sendBulk
// images.js → resizeImage, compress
```

---

## 3. Design Patterns Mal Aplicados

### Singleton desnecessário

```javascript
// 🟡 MEDIUM — Singleton que é só uma instância global
class ConfigManager {
  static instance;
  static getInstance() {
    if (!this.instance) this.instance = new ConfigManager();
    return this.instance;
  }
}
// Dificulta testes, esconde dependência, estado global

// ✅ FIX — Injeção de dependência
const config = loadConfig(); // Criar uma vez
const app = new App(config); // Injetar onde precisa
```

### Over-abstraction

```javascript
// 🟡 MEDIUM — Abstração prematura (1 implementação com 3 layers)
interface IUserRepository { findById(id: string): Promise<User>; }
class UserRepository implements IUserRepository { ... }
class UserRepositoryFactory { create(): IUserRepository { return new UserRepository(); } }
// Factory + Interface + Implementation para 1 único banco de dados

// ✅ FIX — YAGNI (You Ain't Gonna Need It)
class UserRepository {
  async findById(id: string): Promise<User> { ... }
}
// Quando precisar de 2 implementações, aí cria a interface
```

---

## 4. Smells Arquiteturais

| Smell | Sinal | Fix |
|-------|-------|-----|
| **God Class** | Classe 500+ linhas, 20+ métodos | Extrair responsabilidades |
| **God Module** | Arquivo com 1000+ linhas | Separar por domínio |
| **Feature Envy** | Método acessa mais dados de outro objeto que do próprio | Mover método para onde os dados estão |
| **Shotgun Surgery** | Mudar 1 feature requer editar 10 arquivos | Agrupar código relacionado |
| **Circular Dependency** | A → B → A | Extrair interface ou módulo compartilhado |
| **Primitive Obsession** | Passar 5 strings em vez de 1 objeto | Value Object (Money, Email, Address) |
| **Boolean Blindness** | `process(true, false, true)` — o que cada bool significa? | Usar enums, options object, ou types distintos |
| **Magic Numbers** | `if (status === 3)` | Constantes com nomes: `STATUS.SHIPPED` |
| **Deep Nesting** | 4+ níveis de if/for aninhados | Early return, extrair funções |
