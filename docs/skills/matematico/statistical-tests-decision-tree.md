# Árvore de Decisão — Testes Estatísticos

## Índice
1. Fluxograma Mestre
2. Testes por Objetivo
3. Verificação de Pressupostos
4. Interpretação de Resultados
5. Tamanho de Efeito
6. Poder Estatístico e Tamanho Amostral

---

## 1. Fluxograma Mestre

```
OBJETIVO DA ANÁLISE
│
├── COMPARAR GRUPOS (diferença entre médias/medianas)
│   ├── 2 Grupos
│   │   ├── Amostras Independentes?
│   │   │   ├── Normal + Var. Iguais → t-test independente (Student)
│   │   │   ├── Normal + Var. Diferentes → Welch's t-test
│   │   │   └── Não-Normal → Mann-Whitney U
│   │   └── Amostras Pareadas?
│   │       ├── Normal → t-test pareado
│   │       └── Não-Normal → Wilcoxon signed-rank
│   │
│   ├── 3+ Grupos
│   │   ├── Independentes
│   │   │   ├── Normal + Homocedasticidade → ANOVA one-way
│   │   │   │   └── Post-hoc: Tukey HSD, Bonferroni, Scheffé
│   │   │   ├── Normal + Heterocedasticidade → Welch's ANOVA
│   │   │   │   └── Post-hoc: Games-Howell
│   │   │   └── Não-Normal → Kruskal-Wallis
│   │   │       └── Post-hoc: Dunn's test
│   │   └── Pareados (medidas repetidas)
│   │       ├── Normal → ANOVA de medidas repetidas
│   │       └── Não-Normal → Friedman test
│   │
│   └── 2+ Fatores
│       ├── Normal → ANOVA fatorial (two-way)
│       └── Não-Normal → Aligned Rank Transform ANOVA
│
├── ASSOCIAÇÃO / CORRELAÇÃO
│   ├── 2 Variáveis Numéricas
│   │   ├── Linear + Normal → Pearson (r)
│   │   ├── Monotônica / Ordinal → Spearman (ρ)
│   │   └── Ordinal + Empates → Kendall (τ)
│   │
│   ├── 2 Variáveis Categóricas
│   │   ├── 2×2 (n > 40) → Chi-quadrado
│   │   ├── 2×2 (n < 40 ou célula < 5) → Fisher exato
│   │   ├── R×C (n > 5 por célula) → Chi-quadrado de independência
│   │   └── Força de associação → Cramér's V, Phi (φ)
│   │
│   ├── 1 Numérica + 1 Categórica
│   │   ├── 2 Categorias → Point-Biserial
│   │   └── 3+ Categorias → Eta-squared (η²) via ANOVA
│   │
│   └── Múltiplas Variáveis
│       ├── Correlação parcial (controlando confounders)
│       └── Análise de correlação canônica
│
├── PREDIÇÃO / MODELAGEM
│   ├── Y Contínuo
│   │   ├── 1 Preditor → Regressão Linear Simples
│   │   ├── N Preditores → Regressão Linear Múltipla
│   │   └── Relação não-linear → Regressão Polinomial / GAM
│   │
│   ├── Y Binário (0/1)
│   │   └── Regressão Logística
│   │
│   ├── Y Categórico (3+ classes)
│   │   └── Regressão Logística Multinomial
│   │
│   ├── Y Contagem (inteiro ≥ 0)
│   │   ├── Poisson Regression
│   │   └── Negative Binomial (overdispersão)
│   │
│   └── Y Temporal (série)
│       ├── Estacionária → ARIMA
│       ├── Sazonal → SARIMA
│       └── Múltiplas séries → VAR
│
├── DISTRIBUIÇÃO
│   ├── Normalidade
│   │   ├── n ≤ 5000 → Shapiro-Wilk (mais poderoso)
│   │   ├── n > 5000 → D'Agostino-Pearson
│   │   ├── Qualquer n → Kolmogorov-Smirnov (conservador)
│   │   └── Visual → Q-Q Plot + Histograma
│   │
│   ├── Homocedasticidade (igualdade de variâncias)
│   │   ├── Normal → Bartlett
│   │   └── Não-Normal → Levene
│   │
│   ├── Aderência a distribuição conhecida
│   │   └── Chi-quadrado goodness of fit / KS test
│   │
│   └── Estacionariedade (séries temporais)
│       ├── ADF (H0: não-estacionária)
│       └── KPSS (H0: estacionária)
│
└── REDUÇÃO DE DIMENSIONALIDADE
    ├── PCA (linear, variância)
    ├── t-SNE (não-linear, vizinhos, visualização)
    └── UMAP (não-linear, topologia, mais rápido)
```

---

## 2. Testes por Objetivo — Guia Rápido

### Quero saber se dois grupos são diferentes

| Cenário | Teste | Scipy |
|---------|-------|-------|
| 2 grupos independentes, normal | `stats.ttest_ind(a, b)` | Paramétrico |
| 2 grupos independentes, não-normal | `stats.mannwhitneyu(a, b)` | Não-paramétrico |
| 2 grupos pareados, normal | `stats.ttest_rel(a, b)` | Paramétrico |
| 2 grupos pareados, não-normal | `stats.wilcoxon(a, b)` | Não-paramétrico |
| 3+ grupos independentes, normal | `stats.f_oneway(*groups)` | ANOVA |
| 3+ grupos independentes, não-normal | `stats.kruskal(*groups)` | Kruskal-Wallis |

### Quero saber se duas variáveis estão relacionadas

| Cenário | Teste | Scipy |
|---------|-------|-------|
| 2 numéricas, linear | `stats.pearsonr(x, y)` | r, p-value |
| 2 numéricas, monotônica | `stats.spearmanr(x, y)` | ρ, p-value |
| 2 categóricas | `stats.chi2_contingency(table)` | χ², p-value |

### Quero verificar a distribuição

| Cenário | Teste | Scipy |
|---------|-------|-------|
| Normalidade (n<5000) | `stats.shapiro(data)` | W, p-value |
| Normalidade (n>5000) | `stats.normaltest(data)` | K², p-value |
| Igualdade variâncias | `stats.levene(*groups)` | W, p-value |
| Estacionariedade | `adfuller(series)` (statsmodels) | ADF, p-value |

---

## 3. Verificação de Pressupostos

### Checklist Antes de Qualquer Teste Paramétrico

```python
def check_assumptions(data, groups=None, alpha=0.05):
    """Verifica pressupostos para testes paramétricos."""
    results = {"can_use_parametric": True, "issues": []}

    # 1. Normalidade
    if len(data) <= 5000:
        _, p_norm = stats.shapiro(data)
    else:
        _, p_norm = stats.normaltest(data)

    if p_norm < alpha:
        results["can_use_parametric"] = False
        results["issues"].append(f"Não-normal (p={p_norm:.4f})")
    results["normality_p"] = round(p_norm, 6)

    # 2. Outliers extremos
    z_scores = np.abs(stats.zscore(data))
    n_extreme = (z_scores > 3).sum()
    if n_extreme / len(data) > 0.05:
        results["issues"].append(f"{n_extreme} outliers extremos ({n_extreme/len(data)*100:.1f}%)")
    results["n_extreme_outliers"] = int(n_extreme)

    # 3. Tamanho amostral
    if len(data) < 30:
        results["issues"].append(f"n={len(data)} < 30 (CLT pode não se aplicar)")
    results["n"] = len(data)

    # 4. Homocedasticidade (se grupos fornecidos)
    if groups is not None and len(groups) >= 2:
        _, p_lev = stats.levene(*groups)
        if p_lev < alpha:
            results["issues"].append(f"Variâncias não homogêneas (Levene p={p_lev:.4f})")
        results["levene_p"] = round(p_lev, 6)

    return results
```

---

## 4. Interpretação de Resultados

### P-valor — O que ele realmente significa

| p-value | Interpretação Correta | NÃO significa |
|---------|----------------------|---------------|
| p < 0.001 | Evidência muito forte contra H0 | "Resultado muito importante" |
| p < 0.01 | Evidência forte contra H0 | "Certeza de que H1 é verdade" |
| p < 0.05 | Evidência moderada contra H0 | "A diferença é grande" |
| p > 0.05 | Evidência insuficiente contra H0 | "Os grupos são iguais" |

### Template de Interpretação

```
📊 Resultado do [Nome do Teste]:
  • Estatística: [valor]
  • p-valor: [valor]
  • Decisão: [Rejeitar/Não rejeitar] H₀ ao nível α = [0.05]
  • Tamanho do efeito: [valor] ([classificação])
  • Interpretação prática: [em linguagem simples]
  • Intervalo de confiança (95%): [lower, upper]
  • Cuidados: [pressupostos violados, tamanho amostral, etc.]
```

---

## 5. Tamanho de Efeito

| Teste | Medida | Pequeno | Médio | Grande |
|-------|--------|---------|-------|--------|
| t-test | Cohen's d | 0.2 | 0.5 | 0.8 |
| ANOVA | Eta² (η²) | 0.01 | 0.06 | 0.14 |
| ANOVA | Omega² (ω²) | 0.01 | 0.06 | 0.14 |
| Correlação | r | 0.1 | 0.3 | 0.5 |
| Chi-quadrado | Cramér's V (2×2) | 0.1 | 0.3 | 0.5 |
| Chi-quadrado | Cramér's V (3×3) | 0.07 | 0.21 | 0.35 |
| Regressão | R² | 0.02 | 0.13 | 0.26 |
| Regressão | f² | 0.02 | 0.15 | 0.35 |

```python
def cohens_d(group_a, group_b):
    """Cohen's d para two-sample."""
    na, nb = len(group_a), len(group_b)
    var_a, var_b = np.var(group_a, ddof=1), np.var(group_b, ddof=1)
    pooled_std = np.sqrt(((na - 1) * var_a + (nb - 1) * var_b) / (na + nb - 2))
    return abs(np.mean(group_a) - np.mean(group_b)) / pooled_std

def cramers_v(contingency_table):
    """Cramér's V para chi-quadrado."""
    chi2 = stats.chi2_contingency(contingency_table)[0]
    n = contingency_table.sum().sum()
    k = min(contingency_table.shape) - 1
    return np.sqrt(chi2 / (n * k)) if k > 0 else 0
```

---

## 6. Poder Estatístico e Tamanho Amostral

### Poder = P(rejeitar H0 | H0 é falsa)

Regra: poder ≥ 0.80 (80%) é o mínimo aceitável.

```python
from statsmodels.stats.power import TTestIndPower, NormalIndPower

def required_sample_size(effect_size, alpha=0.05, power=0.8, test='t-test'):
    """Calcula tamanho amostral necessário."""
    if test == 't-test':
        analysis = TTestIndPower()
        n = analysis.solve_power(effect_size=effect_size, alpha=alpha, power=power, ratio=1.0)
    elif test == 'proportion':
        from statsmodels.stats.power import zt_ind_solve_power
        n = zt_ind_solve_power(effect_size=effect_size, alpha=alpha, power=power, ratio=1.0)
    return int(np.ceil(n))

# Exemplos:
# Detectar efeito pequeno (d=0.2): n ≈ 394 por grupo
# Detectar efeito médio (d=0.5): n ≈ 64 por grupo
# Detectar efeito grande (d=0.8): n ≈ 26 por grupo
```

### Tabela de Referência Rápida

| Efeito | d | n/grupo (α=0.05, β=0.80) |
|--------|---|---------------------------|
| Pequeno | 0.2 | ~394 |
| Médio | 0.5 | ~64 |
| Grande | 0.8 | ~26 |

### Interpretação do Poder

```
Se p > 0.05 E poder < 0.80:
  → "O teste pode não ter detectado uma diferença real.
     Com n=[atual], só é possível detectar efeitos ≥ [d_mínimo].
     Recomendação: aumentar amostra para pelo menos [n_necessário]."

Se p > 0.05 E poder > 0.80:
  → "Boa confiança de que não há efeito clinicamente relevante.
     O teste teve poder suficiente para detectar efeitos de tamanho [d]."
```
