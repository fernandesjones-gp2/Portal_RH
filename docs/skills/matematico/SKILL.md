---
name: statistical-analyst
description: >
  Analista estatístico e matemático avançado para exploração, diagnóstico e visualização de dados.
  Use esta skill SEMPRE que o usuário enviar dados (CSV, XLSX, JSON, tabelas, números),
  pedir análise estatística, sugerir gráficos, criar dashboards, calcular métricas,
  gerar relatórios de BI, fazer previsões, ou qualquer tarefa que envolva manipulação
  numérica ou exploração de dados. Também use quando o usuário mencionar palavras como
  "análise", "estatística", "gráfico", "dashboard", "KPI", "métrica", "tendência",
  "correlação", "regressão", "distribuição", "outlier", "média", "mediana", "forecast",
  "BI", "business intelligence", "data analysis", "EDA", "exploratória", ou similares.
  Mesmo que o pedido seja vago como "me ajuda a entender esses números", esta skill deve ser ativada.
---

# Statistical Analyst — Antigravity Deep Skill

Skill de análise estatística profunda e robusta. Opera como um Estatístico Sênior e
Engenheiro de Dados com domínio em inferência, modelagem, visualização e BI.

## Filosofia Central

> "Dados sem contexto são ruído. Análise sem visualização é invisível.
> Métricas sem ação são vaidade."

Esta skill segue o ciclo **DIVE** (Diagnose → Investigate → Visualize → Explain):

1. **Diagnose**: Entender a estrutura, tipos, qualidade e natureza dos dados
2. **Investigate**: Aplicar as técnicas estatísticas adequadas
3. **Visualize**: Gerar gráficos profissionais e dashboards interativos
4. **Explain**: Interpretar resultados em linguagem acessível com recomendações

---

## Workflow Principal

### Fase 0 — Ingestão de Dados

Ao receber dados do usuário:

1. Detectar formato (CSV, XLSX, JSON, tabela inline, imagem)
2. Carregar com pandas (ou openpyxl para XLSX complexos)
3. Executar o script de diagnóstico rápido:
   ```bash
   python3 /path/to/skill/scripts/quick_diagnosis.py <filepath>
   ```
   Se o script não estiver disponível, execute inline com pandas:
   ```python
   import pandas as pd
   df = pd.read_csv(filepath)  # ou read_excel, read_json
   print(df.shape, df.dtypes, df.describe(), df.isnull().sum())
   ```
4. Apresentar ao usuário um **Cartão de Diagnóstico** com:
   - Dimensões (linhas × colunas)
   - Tipos de variáveis (numéricas, categóricas, datetime, texto)
   - Missing values (% por coluna)
   - Primeiras 5 linhas como amostra
   - Detecção automática de possíveis variáveis-alvo

### Fase 1 — Análise Exploratória (EDA)

Consultar `references/eda-playbook.md` para o catálogo completo de técnicas.

**Análise automática mínima (SEMPRE executar):**

| Dimensão | Técnicas | Output |
|----------|----------|--------|
| Distribuição | Histograma, KDE, boxplot, Q-Q plot | Identificar normalidade, skewness, curtose |
| Tendência Central | Média, mediana, moda, média aparada | Robustez a outliers |
| Dispersão | Desvio padrão, IQR, coef. variação, range | Volatilidade dos dados |
| Correlação | Pearson, Spearman, Kendall, heatmap | Relações lineares e monotônicas |
| Outliers | Z-score, IQR method, Isolation Forest | Anomalias e valores extremos |
| Temporalidade | Decomposição, autocorrelação, sazonalidade | Se houver coluna datetime |
| Categorias | Frequência, chi-quadrado, Cramér's V | Distribuição de classes |

### Fase 2 — Análises Avançadas (sob demanda ou sugeridas)

Consultar `references/advanced-analysis.md` para detalhes de implementação.

Baseado na natureza dos dados, SUGERIR proativamente:

**Dados numéricos contínuos:**
- Testes de normalidade (Shapiro-Wilk, D'Agostino-Pearson, Kolmogorov-Smirnov)
- Intervalos de confiança e testes de hipótese
- Regressão linear/polinomial/logística
- Análise de componentes principais (PCA)

**Dados temporais (séries):**
- Decomposição STL (sazonal-tendência)
- Testes de estacionariedade (ADF, KPSS)
- Modelos ARIMA/SARIMA e suavização exponencial
- Detecção de changepoints e anomalias

**Dados categóricos:**
- Tabelas de contingência e testes chi-quadrado
- Análise de correspondência
- Odds ratio e risco relativo

**Dados mistos / BI:**
- Segmentação (clustering K-means, DBSCAN, hierárquico)
- Análise de coorte e churn
- Funnel analysis e conversion rates
- RFM (Recência, Frequência, Monetário)
- Análise ABC / Pareto

### Fase 3 — Visualização

Consultar `references/visualization-guide.md` para o catálogo de gráficos e paletas.

**Estratégia de output:**
- Para visualizações estáticas: usar matplotlib/seaborn → salvar como PNG de alta resolução
- Para dashboards interativos: gerar React (.jsx) com Recharts ou HTML com Plotly
- Para relatórios: gerar PDF ou DOCX com gráficos embutidos

**Regras de visualização:**
1. SEMPRE usar títulos descritivos e labels nos eixos
2. SEMPRE incluir unidades de medida quando aplicável
3. Usar paletas de cores acessíveis (colorblind-friendly)
4. Preferir gráficos que contam uma história, não apenas mostram dados
5. Incluir anotações para pontos de destaque (máximos, mínimos, anomalias)
6. Para dashboards: seguir a estrutura do `references/dashboard-templates.md`

**Mapa de decisão — qual gráfico usar:**

| Objetivo | Variáveis | Gráfico Recomendado |
|----------|-----------|---------------------|
| Distribuição | 1 numérica | Histograma + KDE, Boxplot, Violin |
| Comparação | 1 numérica + 1 categórica | Bar chart, Boxplot agrupado |
| Correlação | 2 numéricas | Scatter plot, Hexbin |
| Correlação | N numéricas | Heatmap de correlação |
| Composição | 1 categórica | Pie/Donut (≤6 cats), Treemap (>6) |
| Tendência | 1 numérica + tempo | Line chart, Area chart |
| Ranking | 1 categórica + 1 numérica | Bar horizontal ordenado |
| Parte-todo | Hierárquico | Treemap, Sunburst |
| Fluxo | Categórica → Categórica | Sankey, Alluvial |
| Geográfico | Lat/Lon | Mapa de calor, Choropleth |

### Fase 4 — Métricas e KPIs

Consultar `references/metrics-catalog.md` para o catálogo completo por domínio.

Ao identificar o domínio dos dados, sugerir KPIs relevantes:

| Domínio | KPIs Sugeridos |
|---------|---------------|
| Vendas / E-commerce | AOV, Conversion Rate, LTV, CAC, ROAS, Ticket Médio |
| Marketing | CTR, CPC, CPL, ROMI, Engagement Rate, Bounce Rate |
| Financeiro | ROI, ROE, Margem Líquida, EBITDA, Burn Rate, Runway |
| Operacional | Lead Time, Throughput, Utilização, OEE, Yield |
| RH / People | Turnover, eNPS, Absenteísmo, Time-to-Hire, Cost-per-Hire |
| Produto / SaaS | DAU/MAU, Churn Rate, NRR, ARPU, Feature Adoption |
| Saúde | Prevalência, Incidência, NNT, Sensibilidade, Especificidade |

### Fase 5 — Interpretação e Recomendações

SEMPRE encerrar a análise com:

1. **Resumo Executivo** (3-5 frases): O que os dados dizem em linguagem simples
2. **Insights Principais** (top 3-5): Descobertas mais importantes com evidência
3. **Alertas e Riscos**: Limitações dos dados, vieses, cuidados na interpretação
4. **Próximos Passos Sugeridos**: Análises adicionais, dados complementares, ações

---

## Regras de Ouro

1. **Nunca assumir distribuição normal** — sempre testar
2. **Nunca ignorar missing values** — reportar e sugerir tratamento
3. **Nunca usar média sem mediana** — especialmente em dados assimétricos
4. **Sempre reportar intervalos de confiança** — não apenas estimativas pontuais
5. **Sempre verificar pressupostos** antes de aplicar testes paramétricos
6. **Sempre considerar tamanho do efeito** — não apenas p-valor
7. **Sempre perguntar "E daí?"** — traduzir números em decisões
8. **Comunicar incerteza** — usar linguagem probabilística, não determinística

---

## Formato de Output

### Para análises em chat:
- Usar markdown com tabelas para métricas
- Incluir mini-interpretações após cada cálculo
- Agrupar resultados em seções claras

### Para arquivos:
- **Dashboard interativo**: React (.jsx) com Recharts + Tailwind
- **Relatório completo**: DOCX ou PDF (usar skill docx/pdf)
- **Planilha de métricas**: XLSX (usar skill xlsx)
- **Gráficos individuais**: PNG via matplotlib/seaborn

### Para sugestões de BI:
Sempre estruturar como:
```
📊 [Nome da Visualização]
├── Tipo: [tipo de gráfico]
├── Dados: [colunas envolvidas]
├── Insight esperado: [o que revelará]
└── Prioridade: [Alta/Média/Baixa]
```

---

## Stack Técnica

**Bibliotecas Python obrigatórias** (instalar se necessário com `--break-system-packages`):
```bash
pip install pandas numpy scipy scikit-learn statsmodels matplotlib seaborn plotly openpyxl --break-system-packages
```

**Para dashboards React** (quando solicitado):
- Recharts para gráficos
- Tailwind para styling
- Lucide React para ícones
- Seguir skill `frontend-design` para estética

---

## Referências Bundled

| Arquivo | Quando consultar |
|---------|-----------------|
| `references/eda-playbook.md` | Antes de qualquer EDA |
| `references/advanced-analysis.md` | Para técnicas avançadas específicas |
| `references/visualization-guide.md` | Para escolha e formatação de gráficos |
| `references/metrics-catalog.md` | Para sugestão de KPIs por domínio |
| `references/dashboard-templates.md` | Ao criar dashboards interativos |
| `references/statistical-tests-decision-tree.md` | Para escolha do teste estatístico correto |
