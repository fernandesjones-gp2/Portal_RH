# Personas & JTBD — Quem É Seu Usuário e O Que Ele Quer Fazer

## Índice
1. Persona — Template e Exemplos
2. Anti-Persona
3. Jobs-to-be-Done (JTBD)
4. Job Stories vs User Stories
5. Empathy Map
6. Segmentação de Mercado

---

## 1. Persona — Template

```markdown
## Persona: [Nome Fictício]

**Resumo:** [1 frase que define essa pessoa]

### Demográfico
- **Idade:** [range]
- **Profissão:** [cargo / atividade]
- **Renda:** [faixa]
- **Localização:** [urbano/rural, região]
- **Tech savviness:** [baixa / média / alta]

### Contexto
- [Como é o dia-a-dia dessa pessoa]
- [Que ferramentas usa atualmente]
- [Em que momento do dia o problema aparece]

### Dores (Pain Points)
1. [Dor principal — a que mais incomoda]
2. [Dor secundária]
3. [Dor terciária]

### Objetivos (Goals)
1. [O que quer alcançar / o resultado desejado]
2. [Objetivo secundário]

### Alternativas Atuais
- [O que usa hoje para resolver — mesmo que seja "nada"]
- [O que não gosta na alternativa atual]

### Frase que define
> "[Uma citação fictícia mas realista que resume a frustração]"

### Comportamento de compra
- [Como descobre novos produtos: boca a boca, Google, redes sociais]
- [O que influencia a decisão: preço, indicação, review, free trial]
- [Quanto está disposto a pagar: R$XX/mês, pagamento único]
```

### Exemplo completo

```markdown
## Persona: Marina, a Nutricionista Autônoma

**Resumo:** Nutricionista com 50+ pacientes que perde tempo
com planilhas e WhatsApp em vez de atender.

### Demográfico
- Idade: 28-35 anos
- Profissão: Nutricionista clínica, autônoma
- Renda: R$5.000-12.000/mês
- Localização: Capitais e cidades médias
- Tech savviness: Média (usa Instagram profissionalmente, confortável com apps)

### Contexto
- Atende 30-60 pacientes/mês, majoritariamente presencial
- Usa planilha do Google para planos alimentares
- Envia PDFs por WhatsApp
- Agenda via WhatsApp ou link do Google Calendar
- Cobra via Pix manual, esquece de cobrar follow-ups

### Dores
1. Gasta 2h/dia formatando planos alimentares em planilhas
2. Pacientes somem depois da 2ª consulta (sem follow-up automatizado)
3. Não sabe quanto faturou no mês sem somar Pix manualmente

### Objetivos
1. Atender mais pacientes sem trabalhar mais horas
2. Ter pacientes que voltam e indicam (retenção)

### Alternativas Atuais
- Google Sheets + WhatsApp + Google Calendar + Pix
- Já testou Dietbox mas achou caro (R$180/mês) para autônoma iniciante

### Frase
> "Estudei 5 anos para atender, mas gasto metade do dia
> em planilha e WhatsApp."

### Comportamento de compra
- Descobre produtos por Instagram e indicação de colegas
- Free trial é essencial (não paga sem testar)
- Limite: R$50-80/mês para ferramenta de trabalho
```

### Regras de persona

```
1. Baseada em PESQUISA, não imaginação
   Persona inventada no escritório = ficção perigosa
   Persona baseada em 10 entrevistas = ferramenta útil

2. Máximo 3 personas no MVP
   Persona primária: quem o MVP atende
   Persona secundária: quem se beneficia mas não é prioridade
   Anti-persona: quem NÃO atendemos

3. Atualizar com frequência
   Persona de janeiro pode não refletir agosto
   Revisitar a cada ciclo de discovery (quarterly)
```

---

## 2. Anti-Persona

Tão importante quanto saber para quem é, é saber para quem NÃO é.

```markdown
## Anti-Persona: Fernando, o Enterprise Manager

**Por que NÃO é nosso público:**
- Precisa de SSO, SAML, compliance SOC2
- Decisão de compra envolve 5 stakeholders e 3 meses
- Budget alto (R$5.000+/mês) mas expectativa de suporte 24/7
- Precisamos de 6 meses de features enterprise para atendê-lo
- Atender Fernando agora desvia foco da Marina

**Quando reconsiderar:** Quando tivermos 1.000+ Marinas e time dedicado.
```

---

## 3. Jobs-to-be-Done (JTBD)

### Conceito

As pessoas não compram produtos. Elas "contratam" produtos para
fazer um "trabalho" (job) na vida delas.

```
Ninguém quer uma furadeira.
As pessoas querem um quadro pendurado na parede.
Na verdade, querem uma sala bonita.
Na verdade, querem se sentir orgulhosas do lar.

Job funcional:  Pendurar um quadro
Job emocional:  Sentir orgulho do lar
Job social:     Impressionar visitas
```

### Template de Job

```
Quando eu [SITUAÇÃO/CONTEXTO],
eu quero [MOTIVAÇÃO/AÇÃO],
para que [RESULTADO DESEJADO].
```

### Três camadas do Job

```
Job Funcional — O que precisa ser FEITO
  "Quando recebo um novo paciente, quero criar um plano alimentar
   personalizado, para que ele tenha orientação clara do que comer."

Job Emocional — Como quer se SENTIR
  "Quero me sentir profissional e organizada, não improvisando
   com planilhas."

Job Social — Como quer ser VISTA
  "Quero que meus pacientes me vejam como uma profissional
   atualizada e moderna, não a 'nutri do WhatsApp'."
```

### Mapa de Jobs para a Nutricionista

```
Jobs Principais:
├── Criar planos alimentares personalizados rapidamente
├── Acompanhar evolução dos pacientes entre consultas
├── Manter pacientes engajados (evitar abandono)
├── Cobrar e controlar financeiro sem planilha
└── Divulgar trabalho e atrair novos pacientes

Jobs Relacionados (não resolver agora, mas saber que existem):
├── Calcular macros e calorias com precisão
├── Gerar relatórios de evolução para o paciente
├── Prescrever suplementos
└── Comunicar com médicos do paciente
```

---

## 4. Job Stories vs User Stories

```
User Story (foca no QUEM):
  "Como nutricionista, quero criar planos alimentares,
   para que meus pacientes sigam a dieta."

Job Story (foca no QUANDO/CONTEXTO):
  "Quando termino uma consulta inicial, quero montar o plano
   alimentar em menos de 10 minutos, para que o paciente
   saia da consulta já com o material em mãos."

Job Story é melhor porque:
├── Inclui o CONTEXTO (quando, onde, por quê)
├── Inclui o CONSTRAINT (em menos de 10 min)
├── Não assume a solução (não diz "app" ou "template")
└── Define sucesso mensurável (paciente sai com material)
```

---

## 5. Empathy Map

```
┌───────────────────────────────────────────────────┐
│                    PENSA E SENTE                  │
│  "Será que estou cobrando o suficiente?"          │
│  "Queria ter mais tempo para estudar"             │
│  "Tenho medo de perder pacientes para apps"       │
│  Preocupação com profissionalismo                 │
├────────────────────┬──────────────────────────────┤
│        VÊ         │          OUVE                 │
│  Colegas usando   │  "Usa o app tal?"             │
│  ferramentas caras│  Pacientes: "Posso ter o      │
│  Influencers de   │   plano no celular?"          │
│  nutrição digital │  "Minha nutri anterior         │
│  Concorrentes no  │   usava um sistema"           │
│  Instagram        │                               │
├────────────────────┼──────────────────────────────┤
│        FALA       │          FAZ                   │
│  "Preciso me      │  Abre planilha 10x/dia        │
│   organizar"      │  Manda PDF por WhatsApp       │
│  "Não tenho tempo"│  Responde mensagem de          │
│  "É caro demais"  │   paciente às 22h             │
│                   │  Esquece de cobrar follow-up   │
├───────────────────────────────────────────────────┤
│     DORES                    │     GANHOS          │
│  Tempo perdido em admin      │  Mais pacientes     │
│  Não saber o faturamento     │  Mais tempo livre   │
│  Parecer "amadora"           │  Profissionalismo   │
│  Pacientes que somem         │  Pacientes fiéis    │
└──────────────────────────────┴────────────────────┘
```

---

## 6. Segmentação de Mercado

### TAM, SAM, SOM

```
TAM (Total Addressable Market):
  Todos os nutricionistas do Brasil
  ~90.000 profissionais × R$80/mês = ~R$86M/ano

SAM (Serviceable Addressable Market):
  Nutricionistas autônomos em capitais, tech-savvy
  ~20.000 profissionais × R$60/mês = ~R$14M/ano

SOM (Serviceable Obtainable Market):
  Nutricionistas que podemos atingir em 12 meses
  via Instagram ads + indicação
  ~1.000 profissionais × R$50/mês = ~R$600K/ano
```

### Beachhead Market (Cabeça de Praia)

```
NÃO tente conquistar o SAM inteiro.
Comece pelo menor segmento onde pode DOMINAR.

Beachhead: Nutricionistas autônomas, 25-35 anos,
em São Paulo e Belo Horizonte, que já usam Instagram
profissionalmente e atendem 30-60 pacientes.

Por que esse segmento:
├── Acessível (Instagram ads segmentado)
├── Dor forte (volume de pacientes suficiente para sentir)
├── Tech-savvy (vai adotar app sem resistência)
├── Poder aquisitivo (fatura R$5K+, pode pagar R$50/mês)
└── Word-of-mouth forte (nutris indicam para colegas)

Quando expandir:
├── > 500 clientes neste beachhead
├── NPS > 50
├── Churn < 5%/mês
└── Indicações representam > 30% dos novos clientes
```
