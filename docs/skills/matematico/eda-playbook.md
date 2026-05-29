# EDA Playbook — Catálogo de Técnicas Exploratórias

## Índice
1. Diagnóstico Inicial
2. Análise Univariada
3. Análise Bivariada
4. Análise Multivariada
5. Qualidade dos Dados
6. Detecção de Outliers
7. Análise Temporal
8. Receitas Prontas (snippets)

---

## 1. Diagnóstico Inicial

Executar SEMPRE antes de qualquer análise:

```python
import pandas as pd
import numpy as np

def full_diagnosis(df: pd.DataFrame) -> dict:
    """Diagnóstico completo de um DataFrame."""
    diagnosis = {
        "shape": df.shape,
        "memory_mb": df.memory_usage(deep=True).sum() / 1e6,
        "dtypes": df.dtypes.value_counts().to_dict(),
        "columns": {}
    }

    for col in df.columns:
        col_info = {
            "dtype": str(df[col].dtype),
            "n_unique": df[col].nunique(),
            "n_missing": df[col].isnull().sum(),
            "pct_missing": round(df[col].isnull().mean() * 100, 2),
        }

        if pd.api.types.is_numeric_dtype(df[col]):
            col_info.update({
                "mean": round(df[col].mean(), 4),
                "median": round(df[col].median(), 4),
                "std": round(df[col].std(), 4),
                "min": df[col].min(),
                "max": df[col].max(),
                "skewness": round(df[col].skew(), 4),
                "kurtosis": round(df[col].kurtosis(), 4),
                "cv": round(df[col].std() / df[col].mean(), 4) if df[col].mean() != 0 else None,
                "iqr": round(df[col].quantile(0.75) - df[col].quantile(0.25), 4),
                "zeros_pct": round((df[col] == 0).mean() * 100, 2),
            })
        elif pd.api.types.is_categorical_dtype(df[col]) or df[col].dtype == 'object':
            col_info.update({
                "top_values": df[col].value_counts().head(5).to_dict(),
                "cardinality_ratio": round(df[col].nunique() / len(df), 4),
            })

        diagnosis["columns"][col] = col_info

    return diagnosis
```

### Classificação Automática de Variáveis

```python
def classify_variables(df: pd.DataFrame) -> dict:
    """Classifica variáveis automaticamente."""
    classification = {
        "numeric_continuous": [],
        "numeric_discrete": [],
        "categorical_nominal": [],
        "categorical_ordinal": [],  # difícil auto-detectar, marcar candidatos
        "datetime": [],
        "text": [],
        "binary": [],
        "identifier": [],  # IDs, não usar em análise
    }

    for col in df.columns:
        n_unique = df[col].nunique()
        n_rows = len(df)

        # Datetime
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            classification["datetime"].append(col)
            continue

        # Tenta converter para datetime
        if df[col].dtype == 'object':
            try:
                pd.to_datetime(df[col].dropna().head(100))
                classification["datetime"].append(col)
                continue
            except (ValueError, TypeError):
                pass

        # Numérico
        if pd.api.types.is_numeric_dtype(df[col]):
            if n_unique == 2:
                classification["binary"].append(col)
            elif n_unique / n_rows > 0.9 and n_unique > 100:
                classification["identifier"].append(col)
            elif n_unique <= 20:
                classification["numeric_discrete"].append(col)
            else:
                classification["numeric_continuous"].append(col)
            continue

        # Categórico / Texto
        if df[col].dtype == 'object' or pd.api.types.is_categorical_dtype(df[col]):
            if n_unique == 2:
                classification["binary"].append(col)
            elif n_unique / n_rows > 0.8:
                if df[col].str.len().mean() > 50:
                    classification["text"].append(col)
                else:
                    classification["identifier"].append(col)
            else:
                classification["categorical_nominal"].append(col)

    return classification
```

---

## 2. Análise Univariada

### Variáveis Numéricas

```python
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

def univariate_numeric(df: pd.DataFrame, col: str, figsize=(14, 4)):
    """Análise univariada completa para variável numérica."""
    data = df[col].dropna()

    fig, axes = plt.subplots(1, 3, figsize=figsize)
    fig.suptitle(f'Distribuição: {col}', fontsize=14, fontweight='bold')

    # Histograma + KDE
    sns.histplot(data, kde=True, ax=axes[0], color='#2E86AB')
    axes[0].set_title('Histograma + KDE')
    axes[0].axvline(data.mean(), color='red', linestyle='--', label=f'Média: {data.mean():.2f}')
    axes[0].axvline(data.median(), color='green', linestyle='--', label=f'Mediana: {data.median():.2f}')
    axes[0].legend(fontsize=8)

    # Boxplot
    sns.boxplot(x=data, ax=axes[1], color='#A23B72')
    axes[1].set_title('Boxplot')

    # Q-Q Plot
    stats.probplot(data, dist="norm", plot=axes[2])
    axes[2].set_title('Q-Q Plot (Normal)')

    plt.tight_layout()
    return fig

def normality_tests(data: pd.Series) -> dict:
    """Bateria de testes de normalidade."""
    data = data.dropna()
    results = {}

    # Shapiro-Wilk (melhor para n < 5000)
    if len(data) <= 5000:
        stat, p = stats.shapiro(data)
        results["shapiro_wilk"] = {"statistic": round(stat, 6), "p_value": round(p, 6)}

    # D'Agostino-Pearson (melhor para n > 20)
    if len(data) > 20:
        stat, p = stats.normaltest(data)
        results["dagostino_pearson"] = {"statistic": round(stat, 6), "p_value": round(p, 6)}

    # Kolmogorov-Smirnov
    stat, p = stats.kstest(data, 'norm', args=(data.mean(), data.std()))
    results["kolmogorov_smirnov"] = {"statistic": round(stat, 6), "p_value": round(p, 6)}

    # Anderson-Darling
    result = stats.anderson(data, dist='norm')
    results["anderson_darling"] = {
        "statistic": round(result.statistic, 6),
        "critical_values": dict(zip([f"{s}%" for s in result.significance_level], result.critical_values))
    }

    return results
```

### Variáveis Categóricas

```python
def univariate_categorical(df: pd.DataFrame, col: str, top_n=15, figsize=(12, 5)):
    """Análise univariada completa para variável categórica."""
    data = df[col].dropna()
    freq = data.value_counts()

    fig, axes = plt.subplots(1, 2, figsize=figsize)
    fig.suptitle(f'Distribuição: {col}', fontsize=14, fontweight='bold')

    # Bar chart (top N)
    freq.head(top_n).plot(kind='barh', ax=axes[0], color='#2E86AB')
    axes[0].set_title(f'Frequência (Top {top_n})')
    axes[0].invert_yaxis()

    # Pareto (acumulado)
    cumsum = freq.cumsum() / freq.sum() * 100
    axes[1].bar(range(min(top_n, len(freq))), freq.head(top_n).values, color='#A23B72', alpha=0.7)
    ax2 = axes[1].twinx()
    ax2.plot(range(min(top_n, len(cumsum))), cumsum.head(top_n).values, 'r-o', linewidth=2)
    ax2.set_ylabel('% Acumulado')
    ax2.axhline(80, color='gray', linestyle='--', alpha=0.5)
    axes[1].set_title('Pareto')

    plt.tight_layout()
    return fig
```

---

## 3. Análise Bivariada

### Numérica × Numérica

```python
def bivariate_numeric(df: pd.DataFrame, col_x: str, col_y: str, figsize=(12, 5)):
    """Análise bivariada numérica × numérica."""
    fig, axes = plt.subplots(1, 2, figsize=figsize)

    # Scatter com regressão
    sns.regplot(data=df, x=col_x, y=col_y, ax=axes[0],
                scatter_kws={'alpha': 0.5, 'color': '#2E86AB'},
                line_kws={'color': 'red'})

    # Correlações
    r_pearson = df[col_x].corr(df[col_y], method='pearson')
    r_spearman = df[col_x].corr(df[col_y], method='spearman')
    axes[0].set_title(f'Pearson: {r_pearson:.3f} | Spearman: {r_spearman:.3f}')

    # Hexbin (para grandes volumes)
    if len(df) > 1000:
        axes[1].hexbin(df[col_x].dropna(), df[col_y].dropna(), gridsize=25, cmap='YlOrRd')
        axes[1].set_title('Density Hexbin')
    else:
        sns.kdeplot(data=df, x=col_x, y=col_y, ax=axes[1], cmap='YlOrRd', fill=True)
        axes[1].set_title('KDE 2D')

    plt.tight_layout()
    return fig
```

### Numérica × Categórica

```python
def bivariate_num_cat(df: pd.DataFrame, num_col: str, cat_col: str, figsize=(12, 5)):
    """Análise bivariada numérica × categórica."""
    fig, axes = plt.subplots(1, 2, figsize=figsize)

    # Boxplot agrupado
    order = df.groupby(cat_col)[num_col].median().sort_values(ascending=False).index
    sns.boxplot(data=df, x=cat_col, y=num_col, order=order, ax=axes[0], palette='Set2')
    axes[0].set_title(f'{num_col} por {cat_col}')
    axes[0].tick_params(axis='x', rotation=45)

    # Violin plot
    sns.violinplot(data=df, x=cat_col, y=num_col, order=order, ax=axes[1], palette='Set2')
    axes[1].set_title(f'Distribuição: {num_col} por {cat_col}')
    axes[1].tick_params(axis='x', rotation=45)

    plt.tight_layout()
    return fig
```

### Correlação Multivariável

```python
def correlation_analysis(df: pd.DataFrame, method='pearson', figsize=(10, 8)):
    """Heatmap de correlação com significância."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    corr = df[numeric_cols].corr(method=method)

    # Máscara triangular
    mask = np.triu(np.ones_like(corr, dtype=bool), k=1)

    fig, ax = plt.subplots(figsize=figsize)
    sns.heatmap(corr, mask=mask, annot=True, fmt='.2f', cmap='RdBu_r',
                center=0, vmin=-1, vmax=1, ax=ax, square=True,
                linewidths=0.5, cbar_kws={'shrink': 0.8})
    ax.set_title(f'Correlação ({method.title()})', fontsize=14, fontweight='bold')

    plt.tight_layout()
    return fig, corr
```

---

## 4. Análise Multivariada

### PCA (Análise de Componentes Principais)

```python
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

def pca_analysis(df: pd.DataFrame, n_components=None, figsize=(12, 5)):
    """PCA com variância explicada e biplot."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    data = df[numeric_cols].dropna()

    scaler = StandardScaler()
    scaled = scaler.fit_transform(data)

    if n_components is None:
        n_components = min(len(numeric_cols), 10)

    pca = PCA(n_components=n_components)
    components = pca.fit_transform(scaled)

    fig, axes = plt.subplots(1, 2, figsize=figsize)

    # Variância explicada
    cumvar = np.cumsum(pca.explained_variance_ratio_)
    axes[0].bar(range(1, n_components+1), pca.explained_variance_ratio_, alpha=0.7, color='#2E86AB')
    axes[0].plot(range(1, n_components+1), cumvar, 'ro-')
    axes[0].axhline(0.95, color='gray', linestyle='--', alpha=0.5)
    axes[0].set_xlabel('Componente')
    axes[0].set_ylabel('Variância Explicada')
    axes[0].set_title('Scree Plot')

    # Biplot (PC1 × PC2)
    axes[1].scatter(components[:, 0], components[:, 1], alpha=0.5, s=20, c='#2E86AB')
    for i, col in enumerate(numeric_cols):
        axes[1].annotate(col,
                        (pca.components_[0, i]*3, pca.components_[1, i]*3),
                        fontsize=8, color='red', fontweight='bold',
                        arrowprops=dict(arrowstyle='->', color='red', lw=0.8))
    axes[1].set_xlabel(f'PC1 ({pca.explained_variance_ratio_[0]:.1%})')
    axes[1].set_ylabel(f'PC2 ({pca.explained_variance_ratio_[1]:.1%})')
    axes[1].set_title('Biplot')

    plt.tight_layout()
    return fig, pca
```

---

## 5. Qualidade dos Dados

```python
def data_quality_report(df: pd.DataFrame) -> dict:
    """Relatório de qualidade dos dados."""
    report = {
        "total_rows": len(df),
        "total_cols": len(df.columns),
        "duplicate_rows": df.duplicated().sum(),
        "duplicate_pct": round(df.duplicated().mean() * 100, 2),
        "complete_rows": df.dropna().shape[0],
        "completeness_pct": round(df.dropna().shape[0] / len(df) * 100, 2),
        "total_missing": df.isnull().sum().sum(),
        "total_cells": df.size,
        "missing_pct_total": round(df.isnull().sum().sum() / df.size * 100, 2),
        "columns_with_missing": (df.isnull().sum() > 0).sum(),
        "columns_all_missing": (df.isnull().sum() == len(df)).sum(),
        "constant_columns": (df.nunique() <= 1).sum(),
        "high_cardinality": [(col, df[col].nunique()) for col in df.select_dtypes(include='object').columns
                            if df[col].nunique() / len(df) > 0.8],
    }
    return report

def missing_values_analysis(df: pd.DataFrame, figsize=(12, 6)):
    """Visualização detalhada de missing values."""
    missing = df.isnull().sum()
    missing = missing[missing > 0].sort_values(ascending=False)

    if len(missing) == 0:
        print("Sem missing values!")
        return None

    fig, axes = plt.subplots(1, 2, figsize=figsize)

    # Bar chart de missing
    missing_pct = (missing / len(df) * 100)
    colors = ['#e74c3c' if p > 50 else '#f39c12' if p > 20 else '#2ecc71' for p in missing_pct]
    missing_pct.plot(kind='barh', ax=axes[0], color=colors)
    axes[0].set_xlabel('% Missing')
    axes[0].set_title('Missing Values por Coluna')
    axes[0].axvline(50, color='red', linestyle='--', alpha=0.3)

    # Heatmap de padrão de missing (amostra)
    sample = df[missing.index].head(100)
    sns.heatmap(sample.isnull(), cbar=False, ax=axes[1], cmap='YlOrRd')
    axes[1].set_title('Padrão de Missing (primeiras 100 linhas)')

    plt.tight_layout()
    return fig
```

---

## 6. Detecção de Outliers

```python
def detect_outliers(df: pd.DataFrame, col: str, methods=None) -> dict:
    """Detecção de outliers por múltiplos métodos."""
    data = df[col].dropna()
    results = {}

    if methods is None:
        methods = ['iqr', 'zscore', 'modified_zscore']

    if 'iqr' in methods:
        Q1, Q3 = data.quantile(0.25), data.quantile(0.75)
        IQR = Q3 - Q1
        lower, upper = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
        outliers = data[(data < lower) | (data > upper)]
        results['iqr'] = {
            'n_outliers': len(outliers),
            'pct': round(len(outliers) / len(data) * 100, 2),
            'bounds': (round(lower, 4), round(upper, 4)),
        }

    if 'zscore' in methods:
        z = np.abs(stats.zscore(data))
        outliers = data[z > 3]
        results['zscore'] = {
            'n_outliers': len(outliers),
            'pct': round(len(outliers) / len(data) * 100, 2),
            'threshold': 3.0,
        }

    if 'modified_zscore' in methods:
        median = data.median()
        mad = np.median(np.abs(data - median))
        if mad != 0:
            modified_z = 0.6745 * (data - median) / mad
            outliers = data[np.abs(modified_z) > 3.5]
            results['modified_zscore'] = {
                'n_outliers': len(outliers),
                'pct': round(len(outliers) / len(data) * 100, 2),
                'threshold': 3.5,
            }

    return results
```

---

## 7. Análise Temporal

```python
def temporal_analysis(df: pd.DataFrame, date_col: str, value_col: str, figsize=(14, 10)):
    """Análise temporal completa com decomposição."""
    from statsmodels.tsa.seasonal import seasonal_decompose

    ts = df.set_index(date_col)[value_col].sort_index()
    ts = ts.asfreq(pd.infer_freq(ts.index)) if pd.infer_freq(ts.index) else ts

    fig, axes = plt.subplots(4, 1, figsize=figsize)

    # Série original
    axes[0].plot(ts, color='#2E86AB', linewidth=1)
    axes[0].set_title('Série Original', fontweight='bold')
    axes[0].fill_between(ts.index, ts.values, alpha=0.1, color='#2E86AB')

    # Decomposição (se frequência detectável)
    try:
        decomp = seasonal_decompose(ts.dropna(), model='additive', period=None)
        axes[1].plot(decomp.trend, color='#A23B72', linewidth=1.5)
        axes[1].set_title('Tendência')
        axes[2].plot(decomp.seasonal, color='#F18F01', linewidth=1)
        axes[2].set_title('Sazonalidade')
        axes[3].plot(decomp.resid, color='#C73E1D', linewidth=1, alpha=0.7)
        axes[3].set_title('Resíduo')
    except Exception:
        # Fallback: rolling mean e std
        window = max(7, len(ts) // 20)
        axes[1].plot(ts.rolling(window).mean(), color='#A23B72', linewidth=1.5)
        axes[1].set_title(f'Média Móvel ({window} períodos)')
        axes[2].plot(ts.rolling(window).std(), color='#F18F01', linewidth=1)
        axes[2].set_title(f'Volatilidade ({window} períodos)')
        axes[3].plot(ts.diff(), color='#C73E1D', linewidth=1, alpha=0.7)
        axes[3].set_title('Diferença (1ª ordem)')

    plt.tight_layout()
    return fig
```

---

## 8. Receitas Prontas (Snippets)

### Setup padrão para qualquer análise

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

# Configuração visual
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams.update({
    'figure.dpi': 150,
    'font.size': 10,
    'axes.titlesize': 12,
    'axes.labelsize': 10,
    'figure.figsize': (12, 6),
})
sns.set_palette('husl')
```

### Resumo estatístico expandido

```python
def extended_describe(df: pd.DataFrame) -> pd.DataFrame:
    """describe() turbinado com skewness, kurtosis, CV, IQR."""
    desc = df.describe().T
    desc['skewness'] = df.skew()
    desc['kurtosis'] = df.kurtosis()
    desc['cv'] = desc['std'] / desc['mean']
    desc['iqr'] = desc['75%'] - desc['25%']
    desc['missing'] = df.isnull().sum()
    desc['missing_pct'] = (df.isnull().mean() * 100).round(2)
    return desc.round(4)
```
