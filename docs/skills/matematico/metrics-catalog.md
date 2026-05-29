# Metrics Catalog — KPIs por Domínio de Negócio

## Índice
1. Vendas & E-commerce
2. Marketing Digital
3. Financeiro
4. Operações
5. RH / People Analytics
6. Produto / SaaS
7. Saúde e Epidemiologia
8. Educação
9. Supply Chain / Logística
10. Fórmulas Universais

---

## 1. Vendas & E-commerce

| Métrica | Fórmula | Interpretação |
|---------|---------|---------------|
| **Receita Total** | Σ(valor_venda) | Volume total de vendas |
| **AOV (Ticket Médio)** | Receita / Nº Pedidos | Valor médio por transação |
| **Conversion Rate** | Compradores / Visitantes × 100 | Eficácia do funil |
| **LTV (Lifetime Value)** | AOV × Freq. Compra × Tempo Médio Retenção | Valor total do cliente |
| **CAC (Custo Aquisição)** | Gasto Marketing / Novos Clientes | Custo por cliente novo |
| **LTV/CAC Ratio** | LTV / CAC | >3 é saudável, <1 é insustentável |
| **ROAS** | Receita de Ads / Gasto em Ads | Retorno sobre investimento em anúncios |
| **Churn Rate** | Clientes Perdidos / Clientes Início Período | Taxa de cancelamento |
| **NRR (Net Revenue Retention)** | (MRR Início + Expansão - Contração - Churn) / MRR Início | >100% indica crescimento orgânico |
| **Basket Size** | Itens / Pedido | Tamanho médio do carrinho |
| **Cart Abandonment Rate** | Carrinhos Abandonados / Carrinhos Criados | Fricção no checkout |
| **Repeat Purchase Rate** | Clientes com 2+ compras / Total Clientes | Lealdade |
| **Revenue per Visitor (RPV)** | Receita / Visitantes | Valor por visita |
| **Gross Margin** | (Receita - CMV) / Receita × 100 | Rentabilidade bruta |

### Fórmulas Python
```python
def ecommerce_kpis(df, revenue_col, customer_col, date_col, cost_col=None):
    kpis = {
        'total_revenue': df[revenue_col].sum(),
        'aov': df[revenue_col].mean(),
        'total_orders': len(df),
        'unique_customers': df[customer_col].nunique(),
        'avg_orders_per_customer': len(df) / df[customer_col].nunique(),
        'repeat_rate': (df.groupby(customer_col).size() > 1).mean() * 100,
    }
    if cost_col:
        kpis['gross_margin'] = ((df[revenue_col].sum() - df[cost_col].sum()) / df[revenue_col].sum()) * 100
    return kpis
```

---

## 2. Marketing Digital

| Métrica | Fórmula | Benchmark Típico |
|---------|---------|-----------------|
| **CTR (Click-Through Rate)** | Cliques / Impressões × 100 | 1-3% (display), 5-10% (search) |
| **CPC (Custo por Clique)** | Gasto / Cliques | Varia por indústria |
| **CPL (Custo por Lead)** | Gasto / Leads | Depende do canal |
| **CPA (Custo por Aquisição)** | Gasto / Conversões | |
| **ROMI** | (Receita Gerada - Custo Marketing) / Custo Marketing | >5x é excelente |
| **Engagement Rate** | (Likes + Comments + Shares) / Followers × 100 | 1-3% (Instagram) |
| **Bounce Rate** | Sessões 1 página / Total Sessões × 100 | 40-60% (média) |
| **Session Duration** | Tempo médio na sessão | >2min é bom |
| **Pages per Session** | Pageviews / Sessões | >2 é engajamento |
| **Email Open Rate** | Aberturas / Enviados × 100 | 20-25% (média) |
| **Email CTR** | Cliques / Aberturas × 100 | 2-5% |
| **Unsubscribe Rate** | Descadastros / Enviados × 100 | <0.5% |

---

## 3. Financeiro

| Métrica | Fórmula | Interpretação |
|---------|---------|---------------|
| **ROI** | (Lucro - Investimento) / Investimento × 100 | Retorno sobre investimento |
| **ROE** | Lucro Líquido / Patrimônio Líquido × 100 | Eficiência do capital próprio |
| **ROA** | Lucro Líquido / Ativos Totais × 100 | Eficiência do uso de ativos |
| **Margem Bruta** | (Receita - CMV) / Receita × 100 | |
| **Margem Operacional** | EBIT / Receita × 100 | |
| **Margem Líquida** | Lucro Líquido / Receita × 100 | |
| **EBITDA** | Lucro Operacional + Depreciação + Amortização | Geração de caixa operacional |
| **Burn Rate** | Caixa Consumido / Mês | Para startups |
| **Runway** | Caixa Disponível / Burn Rate (meses) | Tempo até ficar sem dinheiro |
| **Current Ratio** | Ativos Circulantes / Passivos Circulantes | >1 = liquidez |
| **Quick Ratio (Acid Test)** | (Ativos Circ. - Estoques) / Passivos Circ. | >1 = boa liquidez |
| **D/E Ratio** | Dívida Total / Patrimônio Líquido | Alavancagem |
| **WACC** | E/(D+E)×Re + D/(D+E)×Rd×(1-T) | Custo médio ponderado de capital |

### Fórmulas Python
```python
def financial_kpis(revenue, cogs, opex, net_income, total_assets, equity, debt):
    return {
        'gross_margin': (revenue - cogs) / revenue * 100,
        'operating_margin': (revenue - cogs - opex) / revenue * 100,
        'net_margin': net_income / revenue * 100,
        'roa': net_income / total_assets * 100,
        'roe': net_income / equity * 100,
        'de_ratio': debt / equity,
    }
```

---

## 4. Operações

| Métrica | Fórmula | Interpretação |
|---------|---------|---------------|
| **Lead Time** | Data Entrega - Data Pedido | Tempo total do processo |
| **Cycle Time** | Tempo ativo de produção | Tempo só de trabalho |
| **Throughput** | Unidades Produzidas / Tempo | Capacidade de produção |
| **Utilização** | Tempo Produtivo / Tempo Disponível × 100 | Eficiência de uso |
| **OEE** | Disponibilidade × Performance × Qualidade | >85% = world-class |
| **Yield** | Unidades Boas / Unidades Totais × 100 | Taxa de aprovação |
| **MTBF** | Tempo Operação / Nº Falhas | Confiabilidade |
| **MTTR** | Tempo Total Reparo / Nº Reparos | Manutenibilidade |
| **Backlog** | Pedidos em Espera | Capacidade vs Demanda |
| **On-Time Delivery** | Entregas no Prazo / Total Entregas × 100 | Confiabilidade logística |

---

## 5. RH / People Analytics

| Métrica | Fórmula | Benchmark |
|---------|---------|-----------|
| **Turnover (Voluntário)** | Demissões Voluntárias / Headcount Médio × 100 | <10% anual (ideal) |
| **Turnover (Total)** | Total Saídas / Headcount Médio × 100 | |
| **eNPS** | % Promotores - % Detratores | >50 excelente |
| **Absenteísmo** | Horas Ausentes / Horas Programadas × 100 | <3% |
| **Time-to-Hire** | Data Contratação - Data Abertura Vaga | <30 dias (ideal) |
| **Cost-per-Hire** | Gasto Total Recrutamento / Contratações | |
| **Offer Acceptance Rate** | Ofertas Aceitas / Ofertas Feitas × 100 | >85% |
| **Revenue per Employee** | Receita / Headcount | Produtividade |
| **Training ROI** | (Ganho Pós-Treinamento - Custo) / Custo × 100 | |
| **Diversity Index** | Shannon/Simpson Index | Diversidade demográfica |
| **Span of Control** | Reportes Diretos / Manager | 5-8 (ideal) |
| **Internal Mobility** | Movimentações Internas / Headcount × 100 | |

---

## 6. Produto / SaaS

| Métrica | Fórmula | Benchmark |
|---------|---------|-----------|
| **DAU/MAU** | Daily Active / Monthly Active | >20% bom engajamento |
| **Stickiness** | DAU/MAU × 100 | |
| **MRR** | Σ Receita Recorrente Mensal | Growth rate > 10% MoM (early stage) |
| **ARR** | MRR × 12 | |
| **Churn Rate (MRR)** | MRR Perdido / MRR Início | <2% mensal |
| **NRR** | (MRR início + expansion - contraction - churn) / MRR início | >120% excelente |
| **ARPU** | Receita / Usuários Ativos | |
| **Feature Adoption** | Usuários Feature / Total Usuários | |
| **Time to Value** | Tempo até 1ª ação de valor | Menor = melhor |
| **Activation Rate** | Usuários que atingiram "aha moment" / Signups | |
| **WAU Growth** | (WAU semana N - WAU semana N-1) / WAU semana N-1 | |
| **Session Frequency** | Sessões / Usuário / Período | |
| **Retention (D1/D7/D30)** | Usuários ativos dia N / Cohort inicial | D1>40%, D30>20% |
| **NPS** | % Promotores (9-10) - % Detratores (0-6) | >50 excelente |

---

## 7. Saúde e Epidemiologia

| Métrica | Fórmula | Uso |
|---------|---------|-----|
| **Prevalência** | Casos Existentes / População × 1000 | Carga da doença |
| **Incidência** | Novos Casos / Pop. em Risco × 1000 | Velocidade de aparecimento |
| **Mortalidade** | Óbitos / População × 100.000 | Gravidade |
| **Letalidade (CFR)** | Óbitos / Casos × 100 | Severidade |
| **NNT** | 1 / (Risco Controle - Risco Tratamento) | Eficácia do tratamento |
| **NNH** | 1 / (Risco Tratamento - Risco Controle) | Risco do tratamento |
| **Sensibilidade** | VP / (VP + FN) × 100 | Capacidade de detectar doentes |
| **Especificidade** | VN / (VN + FP) × 100 | Capacidade de excluir saudáveis |
| **VPP** | VP / (VP + FP) × 100 | Probabilidade de doença dado + |
| **VPN** | VN / (VN + FN) × 100 | Probabilidade saudável dado - |
| **Odds Ratio** | (a×d) / (b×c) | Associação em caso-controle |
| **Risco Relativo** | (a/(a+b)) / (c/(c+d)) | Associação em coorte |
| **R0** | Casos secundários / Caso primário | Transmissibilidade |

---

## 8. Educação

| Métrica | Fórmula | Uso |
|---------|---------|-----|
| **Taxa de Aprovação** | Aprovados / Matriculados × 100 | |
| **Taxa de Evasão** | Evadidos / Matriculados × 100 | |
| **Nota Média** | Σ Notas / N | |
| **Coeficiente de Variação** | σ / μ × 100 | Homogeneidade da turma |
| **Índice de Dificuldade** | Acertos / Tentativas | Por questão |
| **Discriminação** | r(questão, total) | Qualidade da questão |
| **Alfa de Cronbach** | Confiabilidade do instrumento | >0.7 aceitável |

---

## 9. Supply Chain / Logística

| Métrica | Fórmula | Interpretação |
|---------|---------|---------------|
| **Giro de Estoque** | CMV / Estoque Médio | Velocidade de reposição |
| **Dias de Estoque** | 365 / Giro de Estoque | Cobertura em dias |
| **Fill Rate** | Pedidos Completos / Total Pedidos × 100 | Nível de serviço |
| **OTIF** | On Time AND In Full / Total | Perfeição da entrega |
| **Cost per Unit Shipped** | Custo Logístico / Unidades Enviadas | Eficiência |
| **Warehouse Utilization** | Espaço Usado / Espaço Total × 100 | |
| **Order Accuracy** | Pedidos sem Erro / Total × 100 | |

---

## 10. Fórmulas Universais

### Crescimento
```python
def growth_rate(current, previous):
    """Taxa de crescimento percentual."""
    if previous == 0:
        return float('inf') if current > 0 else 0
    return (current - previous) / previous * 100

def cagr(initial, final, years):
    """Compound Annual Growth Rate."""
    if initial <= 0:
        return None
    return ((final / initial) ** (1 / years) - 1) * 100

def mom_growth(series):
    """Month-over-Month growth."""
    return series.pct_change() * 100
```

### Proporções e Concentração
```python
def gini_coefficient(values):
    """Coeficiente de Gini (desigualdade 0-1)."""
    sorted_vals = np.sort(values)
    n = len(sorted_vals)
    index = np.arange(1, n + 1)
    return (2 * np.sum(index * sorted_vals) / (n * np.sum(sorted_vals))) - (n + 1) / n

def hhi(shares):
    """Herfindahl-Hirschman Index (concentração de mercado)."""
    return np.sum(np.array(shares) ** 2)

def entropy(probabilities):
    """Shannon entropy."""
    p = np.array(probabilities)
    p = p[p > 0]
    return -np.sum(p * np.log2(p))
```

### Intervalos de Confiança
```python
from scipy import stats

def confidence_interval(data, confidence=0.95):
    """IC para a média."""
    n = len(data)
    mean = np.mean(data)
    se = stats.sem(data)
    h = se * stats.t.ppf((1 + confidence) / 2, n - 1)
    return {'mean': mean, 'lower': mean - h, 'upper': mean + h, 'margin_of_error': h}

def proportion_ci(successes, trials, confidence=0.95):
    """IC para proporção (Wilson)."""
    from statsmodels.stats.proportion import proportion_confint
    lower, upper = proportion_confint(successes, trials, alpha=1-confidence, method='wilson')
    return {'proportion': successes/trials, 'lower': lower, 'upper': upper}
```
