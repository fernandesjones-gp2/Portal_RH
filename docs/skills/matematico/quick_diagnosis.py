#!/usr/bin/env python3
"""
quick_diagnosis.py — Diagnóstico rápido de um arquivo de dados.

Uso: python3 quick_diagnosis.py <filepath> [--format json|text]

Aceita: CSV, XLSX, JSON, TSV, Parquet
Saída: Cartão de diagnóstico com shape, tipos, missing, amostra, sugestões.
"""

import sys
import json
import argparse
from pathlib import Path

try:
    import pandas as pd
    import numpy as np
except ImportError:
    print("ERRO: pandas e numpy são necessários.")
    print("Instale com: pip install pandas numpy openpyxl --break-system-packages")
    sys.exit(1)


def load_data(filepath: str) -> pd.DataFrame:
    """Carrega dados de múltiplos formatos."""
    path = Path(filepath)
    ext = path.suffix.lower()

    loaders = {
        '.csv': lambda: pd.read_csv(filepath, encoding='utf-8', on_bad_lines='skip'),
        '.tsv': lambda: pd.read_csv(filepath, sep='\t', encoding='utf-8', on_bad_lines='skip'),
        '.xlsx': lambda: pd.read_excel(filepath, engine='openpyxl'),
        '.xls': lambda: pd.read_excel(filepath),
        '.json': lambda: pd.read_json(filepath),
        '.parquet': lambda: pd.read_parquet(filepath),
    }

    if ext not in loaders:
        # Tenta CSV como fallback
        try:
            return pd.read_csv(filepath, encoding='utf-8', on_bad_lines='skip')
        except Exception:
            raise ValueError(f"Formato não suportado: {ext}")

    try:
        df = loaders[ext]()
    except UnicodeDecodeError:
        df = pd.read_csv(filepath, encoding='latin-1', on_bad_lines='skip')

    return df


def classify_columns(df: pd.DataFrame) -> dict:
    """Classifica colunas automaticamente."""
    classification = {
        "numeric_continuous": [],
        "numeric_discrete": [],
        "categorical": [],
        "datetime": [],
        "binary": [],
        "text": [],
        "identifier": [],
    }

    for col in df.columns:
        n_unique = df[col].nunique()
        n_rows = len(df)

        # Datetime
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            classification["datetime"].append(col)
            continue

        if df[col].dtype == 'object':
            try:
                pd.to_datetime(df[col].dropna().head(50), infer_datetime_format=True)
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
        if n_unique == 2:
            classification["binary"].append(col)
        elif n_unique / n_rows > 0.8:
            avg_len = df[col].dropna().astype(str).str.len().mean()
            if avg_len > 50:
                classification["text"].append(col)
            else:
                classification["identifier"].append(col)
        else:
            classification["categorical"].append(col)

    return {k: v for k, v in classification.items() if v}


def diagnose(df: pd.DataFrame) -> dict:
    """Diagnóstico completo do DataFrame."""
    diagnosis = {
        "shape": {"rows": df.shape[0], "columns": df.shape[1]},
        "memory_mb": round(df.memory_usage(deep=True).sum() / 1e6, 2),
        "column_types": df.dtypes.astype(str).value_counts().to_dict(),
        "classification": classify_columns(df),
        "missing": {},
        "numeric_summary": {},
        "categorical_summary": {},
        "quality": {
            "duplicate_rows": int(df.duplicated().sum()),
            "duplicate_pct": round(df.duplicated().mean() * 100, 2),
            "complete_rows_pct": round(df.dropna().shape[0] / len(df) * 100, 2),
            "constant_columns": [col for col in df.columns if df[col].nunique() <= 1],
        },
        "suggestions": [],
    }

    # Missing values
    for col in df.columns:
        n_miss = int(df[col].isnull().sum())
        if n_miss > 0:
            diagnosis["missing"][col] = {
                "count": n_miss,
                "pct": round(n_miss / len(df) * 100, 2),
            }

    # Numéricas
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        data = df[col].dropna()
        if len(data) == 0:
            continue
        diagnosis["numeric_summary"][col] = {
            "mean": round(float(data.mean()), 4),
            "median": round(float(data.median()), 4),
            "std": round(float(data.std()), 4),
            "min": float(data.min()),
            "max": float(data.max()),
            "skewness": round(float(data.skew()), 4),
            "kurtosis": round(float(data.kurtosis()), 4),
            "zeros_pct": round(float((data == 0).mean() * 100), 2),
        }

    # Categóricas
    cat_cols = df.select_dtypes(include=['object', 'category']).columns
    for col in cat_cols:
        diagnosis["categorical_summary"][col] = {
            "n_unique": int(df[col].nunique()),
            "top_3": df[col].value_counts().head(3).to_dict(),
            "cardinality_ratio": round(df[col].nunique() / len(df), 4),
        }

    # Sugestões automáticas
    suggestions = diagnosis["suggestions"]

    if len(numeric_cols) >= 2:
        suggestions.append("📊 Correlação: Gerar heatmap de correlação entre variáveis numéricas")

    if len(numeric_cols) >= 1:
        suggestions.append("📈 Distribuição: Analisar histogramas e boxplots das variáveis numéricas")

    if diagnosis["classification"].get("datetime"):
        suggestions.append("📅 Séries Temporais: Detectadas colunas de data — analisar tendências e sazonalidade")

    if diagnosis["classification"].get("categorical"):
        suggestions.append("🏷️ Segmentação: Variáveis categóricas permitem análise por grupos")

    if len(numeric_cols) >= 3:
        suggestions.append("🔍 PCA: Com 3+ variáveis numéricas, PCA pode revelar padrões latentes")

    if diagnosis["missing"]:
        high_miss = [c for c, v in diagnosis["missing"].items() if v["pct"] > 30]
        if high_miss:
            suggestions.append(f"⚠️ Missing Values: {len(high_miss)} colunas com >30% missing — avaliar imputação ou remoção")

    if diagnosis["quality"]["duplicate_pct"] > 5:
        suggestions.append(f"⚠️ Duplicatas: {diagnosis['quality']['duplicate_pct']}% de linhas duplicadas")

    return diagnosis


def format_text(diagnosis: dict, df: pd.DataFrame) -> str:
    """Formata o diagnóstico como texto legível."""
    lines = []
    lines.append("=" * 60)
    lines.append("📋 CARTÃO DE DIAGNÓSTICO DOS DADOS")
    lines.append("=" * 60)

    s = diagnosis["shape"]
    lines.append(f"\n📐 Dimensões: {s['rows']:,} linhas × {s['columns']} colunas")
    lines.append(f"💾 Memória: {diagnosis['memory_mb']} MB")

    # Tipos
    lines.append(f"\n📊 Tipos de Dados:")
    for dtype, count in diagnosis["column_types"].items():
        lines.append(f"   {dtype}: {count} colunas")

    # Classificação
    lines.append(f"\n🏷️ Classificação Automática:")
    for category, cols in diagnosis["classification"].items():
        label = category.replace('_', ' ').title()
        lines.append(f"   {label}: {', '.join(cols)}")

    # Missing
    if diagnosis["missing"]:
        lines.append(f"\n⚠️ Missing Values:")
        for col, info in sorted(diagnosis["missing"].items(), key=lambda x: x[1]["pct"], reverse=True):
            bar = "█" * int(info["pct"] / 5) + "░" * (20 - int(info["pct"] / 5))
            lines.append(f"   {col}: {info['count']:,} ({info['pct']}%) {bar}")
    else:
        lines.append(f"\n✅ Sem Missing Values!")

    # Qualidade
    q = diagnosis["quality"]
    lines.append(f"\n🔍 Qualidade:")
    lines.append(f"   Duplicatas: {q['duplicate_rows']:,} ({q['duplicate_pct']}%)")
    lines.append(f"   Linhas completas: {q['complete_rows_pct']}%")
    if q["constant_columns"]:
        lines.append(f"   Colunas constantes: {', '.join(q['constant_columns'])}")

    # Amostra
    lines.append(f"\n📄 Amostra (5 primeiras linhas):")
    lines.append(df.head().to_string())

    # Sugestões
    if diagnosis["suggestions"]:
        lines.append(f"\n💡 Sugestões de Análise:")
        for sug in diagnosis["suggestions"]:
            lines.append(f"   {sug}")

    lines.append("\n" + "=" * 60)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Diagnóstico rápido de dados")
    parser.add_argument("filepath", help="Caminho do arquivo de dados")
    parser.add_argument("--format", choices=["json", "text"], default="text", help="Formato de saída")
    args = parser.parse_args()

    try:
        df = load_data(args.filepath)
    except Exception as e:
        print(f"ERRO ao carregar arquivo: {e}")
        sys.exit(1)

    diagnosis = diagnose(df)

    if args.format == "json":
        print(json.dumps(diagnosis, indent=2, ensure_ascii=False, default=str))
    else:
        print(format_text(diagnosis, df))


if __name__ == "__main__":
    main()
