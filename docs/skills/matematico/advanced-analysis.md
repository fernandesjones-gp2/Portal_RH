# Análises Avançadas — Referência de Implementação

## Índice
1. Testes de Hipótese
2. Regressão
3. Séries Temporais
4. Clustering e Segmentação
5. Análise de Sobrevivência
6. Análise de BI / Negócios

---

## 1. Testes de Hipótese

### Árvore de Decisão para Testes

```
Objetivo: Comparar grupos?
├── 2 grupos
│   ├── Pareados (mesmos indivíduos)?
│   │   ├── Normal → t-test pareado
│   │   └── Não-normal → Wilcoxon signed-rank
│   └── Independentes?
│       ├── Normal + variâncias iguais → t-test independente
│       ├── Normal + variâncias diferentes → Welch's t-test
│       └── Não-normal → Mann-Whitney U
├── 3+ grupos
│   ├── Normal → ANOVA (+ Tukey HSD post-hoc)
│   └── Não-normal → Kruskal-Wallis (+ Dunn's post-hoc)
└── Variáveis categóricas?
    ├── 2×2 → Chi-quadrado / Fisher exato
    └── R×C → Chi-quadrado de independência
```

### Implementações

```python
from scipy import stats
from statsmodels.stats.multicomp import pairwise_tukeyhsd

def two_sample_test(group_a, group_b, paired=False, alpha=0.05):
    """Seleciona e executa o teste apropriado para 2 amostras."""
    results = {"alpha": alpha}

    # Testes de normalidade
    _, p_a = stats.shapiro(group_a) if len(group_a) <= 5000 else stats.normaltest(group_a)
    _, p_b = stats.shapiro(group_b) if len(group_b) <= 5000 else stats.normaltest(group_b)
    is_normal = p_a > alpha and p_b > alpha
    results["normality"] = {"group_a_p": round(p_a, 6), "group_b_p": round(p_b, 6), "is_normal": is_normal}

    if paired:
        if is_normal:
            stat, p = stats.ttest_rel(group_a, group_b)
            results["test"] = "Paired t-test"
        else:
            stat, p = stats.wilcoxon(group_a, group_b)
            results["test"] = "Wilcoxon signed-rank"
    else:
        if is_normal:
            # Teste de Levene para igualdade de variâncias
            _, p_lev = stats.levene(group_a, group_b)
            equal_var = p_lev > alpha
            stat, p = stats.ttest_ind(group_a, group_b, equal_var=equal_var)
            results["test"] = "Independent t-test" if equal_var else "Welch's t-test"
            results["levene_p"] = round(p_lev, 6)
        else:
            stat, p = stats.mannwhitneyu(group_a, group_b, alternative='two-sided')
            results["test"] = "Mann-Whitney U"

    results["statistic"] = round(stat, 6)
    results["p_value"] = round(p, 6)
    results["significant"] = p < alpha

    # Tamanho do efeito (Cohen's d)
    pooled_std = np.sqrt((np.std(group_a)**2 + np.std(group_b)**2) / 2)
    if pooled_std > 0:
        cohens_d = abs(np.mean(group_a) - np.mean(group_b)) / pooled_std
        results["cohens_d"] = round(cohens_d, 4)
        results["effect_interpretation"] = (
            "negligenciável" if cohens_d < 0.2 else
            "pequeno" if cohens_d < 0.5 else
            "médio" if cohens_d < 0.8 else
            "grande"
        )

    return results

def multi_group_test(df, value_col, group_col, alpha=0.05):
    """Teste para 3+ grupos com post-hoc."""
    groups = [group[value_col].dropna().values for _, group in df.groupby(group_col)]
    results = {"alpha": alpha, "n_groups": len(groups)}

    # Normalidade por grupo
    normal_all = all(stats.shapiro(g)[1] > alpha for g in groups if len(g) <= 5000)

    if normal_all:
        stat, p = stats.f_oneway(*groups)
        results["test"] = "One-way ANOVA"
        results["statistic"] = round(stat, 6)
        results["p_value"] = round(p, 6)

        if p < alpha:
            tukey = pairwise_tukeyhsd(df[value_col].dropna(), df[group_col].dropna())
            results["post_hoc"] = "Tukey HSD"
            results["pairwise"] = str(tukey)
    else:
        stat, p = stats.kruskal(*groups)
        results["test"] = "Kruskal-Wallis"
        results["statistic"] = round(stat, 6)
        results["p_value"] = round(p, 6)

    results["significant"] = p < alpha

    # Eta-squared (tamanho do efeito para ANOVA)
    grand_mean = df[value_col].mean()
    ss_between = sum(len(g) * (np.mean(g) - grand_mean)**2 for g in groups)
    ss_total = sum((val - grand_mean)**2 for g in groups for val in g)
    if ss_total > 0:
        results["eta_squared"] = round(ss_between / ss_total, 4)

    return results
```

---

## 2. Regressão

### Regressão Linear Múltipla

```python
import statsmodels.api as sm
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

def linear_regression_report(df, target_col, feature_cols, figsize=(14, 10)):
    """Regressão linear com diagnóstico completo."""
    X = df[feature_cols].dropna()
    y = df.loc[X.index, target_col]
    X_const = sm.add_constant(X)

    model = sm.OLS(y, X_const).fit()

    # Diagnóstico visual
    fig, axes = plt.subplots(2, 2, figsize=figsize)
    fig.suptitle('Diagnóstico de Regressão', fontsize=14, fontweight='bold')

    residuals = model.resid
    fitted = model.fittedvalues

    # Resíduos vs Ajustados
    axes[0, 0].scatter(fitted, residuals, alpha=0.5, s=20)
    axes[0, 0].axhline(0, color='red', linestyle='--')
    axes[0, 0].set_xlabel('Valores Ajustados')
    axes[0, 0].set_ylabel('Resíduos')
    axes[0, 0].set_title('Resíduos vs Ajustados')

    # Q-Q dos resíduos
    stats.probplot(residuals, dist="norm", plot=axes[0, 1])
    axes[0, 1].set_title('Q-Q dos Resíduos')

    # Histograma dos resíduos
    axes[1, 0].hist(residuals, bins=30, edgecolor='black', alpha=0.7)
    axes[1, 0].set_title('Distribuição dos Resíduos')

    # Coeficientes
    coefs = model.params[1:]  # excluir intercepto
    colors = ['#2ecc71' if p < 0.05 else '#e74c3c' for p in model.pvalues[1:]]
    axes[1, 1].barh(coefs.index, coefs.values, color=colors)
    axes[1, 1].set_title('Coeficientes (verde=sig, vermelho=não sig)')
    axes[1, 1].axvline(0, color='gray', linestyle='--')

    plt.tight_layout()

    report = {
        "r_squared": round(model.rsquared, 4),
        "adj_r_squared": round(model.rsquared_adj, 4),
        "f_statistic": round(model.fvalue, 4),
        "f_pvalue": round(model.f_pvalue, 6),
        "aic": round(model.aic, 2),
        "bic": round(model.bic, 2),
        "durbin_watson": round(sm.stats.stattools.durbin_watson(residuals), 4),
        "rmse": round(np.sqrt(mean_squared_error(y, fitted)), 4),
        "mae": round(mean_absolute_error(y, fitted), 4),
        "summary": model.summary(),
        "figure": fig
    }
    return report
```

### Regressão Logística

```python
def logistic_regression_report(df, target_col, feature_cols):
    """Regressão logística com métricas de classificação."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import classification_report, roc_auc_score, roc_curve
    from sklearn.model_selection import cross_val_score

    X = df[feature_cols].dropna()
    y = df.loc[X.index, target_col]

    # Statsmodels para p-values e interpretabilidade
    X_const = sm.add_constant(X)
    logit_model = sm.Logit(y, X_const).fit(disp=0)

    # Scikit-learn para ROC e cross-validation
    lr = LogisticRegression(max_iter=1000)
    cv_scores = cross_val_score(lr, X, y, cv=5, scoring='roc_auc')
    lr.fit(X, y)
    y_prob = lr.predict_proba(X)[:, 1]

    report = {
        "summary": logit_model.summary(),
        "odds_ratios": np.exp(logit_model.params).round(4).to_dict(),
        "roc_auc": round(roc_auc_score(y, y_prob), 4),
        "cv_auc_mean": round(cv_scores.mean(), 4),
        "cv_auc_std": round(cv_scores.std(), 4),
    }
    return report
```

---

## 3. Séries Temporais

### ARIMA/SARIMA

```python
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.stattools import adfuller, kpss

def stationarity_tests(series):
    """Testes de estacionariedade ADF e KPSS."""
    results = {}

    # ADF (H0: não-estacionária)
    adf_result = adfuller(series.dropna())
    results["adf"] = {
        "statistic": round(adf_result[0], 4),
        "p_value": round(adf_result[1], 6),
        "is_stationary": adf_result[1] < 0.05,
        "critical_values": {k: round(v, 4) for k, v in adf_result[4].items()}
    }

    # KPSS (H0: estacionária)
    kpss_result = kpss(series.dropna(), regression='c')
    results["kpss"] = {
        "statistic": round(kpss_result[0], 4),
        "p_value": round(kpss_result[1], 6),
        "is_stationary": kpss_result[1] > 0.05,
    }

    # Interpretação conjunta
    if results["adf"]["is_stationary"] and results["kpss"]["is_stationary"]:
        results["conclusion"] = "Estacionária (ambos testes concordam)"
    elif not results["adf"]["is_stationary"] and not results["kpss"]["is_stationary"]:
        results["conclusion"] = "Não-estacionária (ambos testes concordam)"
    else:
        results["conclusion"] = "Resultados conflitantes — investigar tendência/sazonalidade"

    return results

def auto_arima_forecast(series, forecast_periods=12, figsize=(14, 6)):
    """Forecast com seleção automática de parâmetros ARIMA."""
    # Grid search simplificado
    best_aic = np.inf
    best_order = None
    best_model = None

    for p in range(4):
        for d in range(3):
            for q in range(4):
                try:
                    model = ARIMA(series, order=(p, d, q)).fit()
                    if model.aic < best_aic:
                        best_aic = model.aic
                        best_order = (p, d, q)
                        best_model = model
                except:
                    continue

    forecast = best_model.forecast(steps=forecast_periods)
    conf_int = best_model.get_forecast(steps=forecast_periods).conf_int()

    fig, ax = plt.subplots(figsize=figsize)
    ax.plot(series, label='Observado', color='#2E86AB')
    forecast_idx = pd.date_range(series.index[-1], periods=forecast_periods+1, freq=series.index.freq)[1:]
    ax.plot(forecast_idx, forecast, label='Forecast', color='#E74C3C', linestyle='--')
    ax.fill_between(forecast_idx, conf_int.iloc[:, 0], conf_int.iloc[:, 1], alpha=0.2, color='#E74C3C')
    ax.legend()
    ax.set_title(f'ARIMA{best_order} Forecast (AIC: {best_aic:.2f})')
    plt.tight_layout()

    return {"model": best_model, "order": best_order, "aic": best_aic, "figure": fig}
```

---

## 4. Clustering e Segmentação

```python
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

def optimal_kmeans(df, feature_cols, max_k=10, figsize=(12, 5)):
    """K-Means com método do cotovelo e silhouette."""
    X = StandardScaler().fit_transform(df[feature_cols].dropna())

    inertias = []
    silhouettes = []

    for k in range(2, max_k + 1):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X)
        inertias.append(km.inertia_)
        silhouettes.append(silhouette_score(X, labels))

    fig, axes = plt.subplots(1, 2, figsize=figsize)

    # Elbow
    axes[0].plot(range(2, max_k+1), inertias, 'bo-')
    axes[0].set_xlabel('Número de Clusters (K)')
    axes[0].set_ylabel('Inércia')
    axes[0].set_title('Método do Cotovelo')

    # Silhouette
    axes[1].plot(range(2, max_k+1), silhouettes, 'ro-')
    axes[1].set_xlabel('Número de Clusters (K)')
    axes[1].set_ylabel('Silhouette Score')
    axes[1].set_title('Silhouette Score')

    best_k = silhouettes.index(max(silhouettes)) + 2
    axes[1].axvline(best_k, color='green', linestyle='--', label=f'Melhor K={best_k}')
    axes[1].legend()

    plt.tight_layout()
    return {"best_k": best_k, "silhouettes": silhouettes, "figure": fig}

def cluster_profile(df, feature_cols, labels, figsize=(12, 6)):
    """Perfil dos clusters (radar chart / resumo)."""
    df_clustered = df[feature_cols].copy()
    df_clustered['cluster'] = labels

    profile = df_clustered.groupby('cluster').mean()
    profile_std = df_clustered.groupby('cluster').std()
    profile_count = df_clustered.groupby('cluster').size()

    # Heatmap normalizado
    from sklearn.preprocessing import MinMaxScaler
    scaler = MinMaxScaler()
    profile_norm = pd.DataFrame(scaler.fit_transform(profile),
                                columns=profile.columns, index=profile.index)

    fig, ax = plt.subplots(figsize=figsize)
    sns.heatmap(profile_norm, annot=True, fmt='.2f', cmap='YlOrRd',
                ax=ax, linewidths=0.5, cbar_kws={'label': 'Normalizado [0,1]'})
    ax.set_title('Perfil dos Clusters (normalizado)', fontweight='bold')
    ax.set_ylabel('Cluster')

    plt.tight_layout()
    return {"profile": profile, "counts": profile_count, "figure": fig}
```

---

## 5. Análise de Sobrevivência (Kaplan-Meier simplificado)

```python
def kaplan_meier(durations, events, group_col=None, groups=None, figsize=(10, 6)):
    """Kaplan-Meier survival curve (sem lifelines, implementação pura)."""
    fig, ax = plt.subplots(figsize=figsize)

    def _km_curve(t, e, label=None):
        df_km = pd.DataFrame({'time': t, 'event': e}).sort_values('time')
        unique_times = sorted(df_km['time'].unique())
        n_at_risk = len(df_km)
        survival = 1.0
        times_plot, surv_plot = [0], [1.0]

        for t_i in unique_times:
            d_i = ((df_km['time'] == t_i) & (df_km['event'] == 1)).sum()
            survival *= (1 - d_i / n_at_risk)
            times_plot.append(t_i)
            surv_plot.append(survival)
            n_at_risk -= (df_km['time'] == t_i).sum()

        ax.step(times_plot, surv_plot, where='post', label=label, linewidth=2)

    if groups is not None and group_col is not None:
        for g in groups.unique():
            mask = groups == g
            _km_curve(durations[mask], events[mask], label=str(g))
        ax.legend()
    else:
        _km_curve(durations, events)

    ax.set_xlabel('Tempo')
    ax.set_ylabel('Probabilidade de Sobrevivência')
    ax.set_title('Curva de Kaplan-Meier')
    ax.set_ylim(0, 1.05)
    plt.tight_layout()
    return fig
```

---

## 6. Análise de BI / Negócios

### RFM (Recência, Frequência, Monetário)

```python
def rfm_analysis(df, customer_col, date_col, value_col, reference_date=None):
    """Análise RFM com segmentação automática."""
    if reference_date is None:
        reference_date = df[date_col].max() + pd.Timedelta(days=1)

    rfm = df.groupby(customer_col).agg({
        date_col: lambda x: (reference_date - x.max()).days,
        value_col: ['count', 'sum']
    })
    rfm.columns = ['Recency', 'Frequency', 'Monetary']

    # Scoring por quartis (1-4, 4=melhor)
    for metric in ['Frequency', 'Monetary']:
        rfm[f'{metric}_Score'] = pd.qcut(rfm[metric], q=4, labels=[1, 2, 3, 4], duplicates='drop')
    rfm['Recency_Score'] = pd.qcut(rfm['Recency'], q=4, labels=[4, 3, 2, 1], duplicates='drop')

    rfm['RFM_Score'] = (rfm['Recency_Score'].astype(int) +
                         rfm['Frequency_Score'].astype(int) +
                         rfm['Monetary_Score'].astype(int))

    # Segmentos
    def segment(row):
        r, f, m = int(row['Recency_Score']), int(row['Frequency_Score']), int(row['Monetary_Score'])
        if r >= 4 and f >= 4: return 'Champions'
        if r >= 3 and f >= 3: return 'Loyal Customers'
        if r >= 4 and f <= 2: return 'New Customers'
        if r <= 2 and f >= 3: return 'At Risk'
        if r <= 2 and f <= 2: return 'Lost'
        return 'Need Attention'

    rfm['Segment'] = rfm.apply(segment, axis=1)

    return rfm

def cohort_analysis(df, customer_col, date_col, value_col='count', figsize=(14, 8)):
    """Análise de coorte por mês de aquisição."""
    df = df.copy()
    df['order_month'] = df[date_col].dt.to_period('M')
    df['cohort'] = df.groupby(customer_col)[date_col].transform('min').dt.to_period('M')
    df['cohort_index'] = (df['order_month'] - df['cohort']).apply(lambda x: x.n)

    if value_col == 'count':
        cohort_data = df.groupby(['cohort', 'cohort_index'])[customer_col].nunique().reset_index()
        cohort_data.columns = ['cohort', 'cohort_index', 'customers']
        pivot = cohort_data.pivot(index='cohort', columns='cohort_index', values='customers')
    else:
        cohort_data = df.groupby(['cohort', 'cohort_index'])[value_col].sum().reset_index()
        pivot = cohort_data.pivot(index='cohort', columns='cohort_index', values=value_col)

    # Retenção %
    retention = pivot.divide(pivot.iloc[:, 0], axis=0) * 100

    fig, ax = plt.subplots(figsize=figsize)
    sns.heatmap(retention, annot=True, fmt='.0f', cmap='YlOrRd_r', ax=ax,
                linewidths=0.5, cbar_kws={'label': '% Retenção'})
    ax.set_title('Análise de Coorte — Retenção', fontweight='bold')
    ax.set_xlabel('Meses desde Aquisição')
    ax.set_ylabel('Coorte')

    plt.tight_layout()
    return {"retention": retention, "absolute": pivot, "figure": fig}
```

### Análise ABC / Pareto

```python
def abc_analysis(df, item_col, value_col, figsize=(12, 6)):
    """Classificação ABC (Pareto) de itens."""
    abc = df.groupby(item_col)[value_col].sum().sort_values(ascending=False).reset_index()
    abc['cumulative_pct'] = abc[value_col].cumsum() / abc[value_col].sum() * 100
    abc['pct_of_total'] = abc[value_col] / abc[value_col].sum() * 100

    abc['class'] = pd.cut(abc['cumulative_pct'],
                          bins=[0, 80, 95, 100],
                          labels=['A', 'B', 'C'])

    summary = abc.groupby('class').agg(
        n_items=(item_col, 'count'),
        total_value=(value_col, 'sum'),
        pct_items=(item_col, lambda x: len(x) / len(abc) * 100),
        pct_value=(value_col, lambda x: x.sum() / abc[value_col].sum() * 100)
    ).round(2)

    fig, ax = plt.subplots(figsize=figsize)
    colors = abc['class'].map({'A': '#2ecc71', 'B': '#f39c12', 'C': '#e74c3c'})
    ax.bar(range(len(abc)), abc[value_col], color=colors, alpha=0.7)
    ax2 = ax.twinx()
    ax2.plot(range(len(abc)), abc['cumulative_pct'], 'k-', linewidth=2)
    ax2.axhline(80, color='gray', linestyle='--', alpha=0.5, label='80%')
    ax2.axhline(95, color='gray', linestyle=':', alpha=0.5, label='95%')
    ax.set_title('Análise ABC (Pareto)', fontweight='bold')
    ax2.legend()

    plt.tight_layout()
    return {"abc": abc, "summary": summary, "figure": fig}
```
