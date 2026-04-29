#!/usr/bin/env python3
"""
Converte a primeira aba de um arquivo XLSX para CSV compatível com BigQuery.

Uso:
    python xlsx_to_csv.py input.xlsx output.csv
    python xlsx_to_csv.py input.xlsx output.csv --delimiter ","
    python xlsx_to_csv.py input.xlsx output.csv --encoding utf-8

Regras de quoting aplicadas:
- Campos que contêm o delimitador, aspas duplas ou quebras de linha são
  envolvidos em aspas duplas.
- Aspas duplas dentro de campos são escapadas duplicando-as ("").
- Valores None/NaN são exportados como string vazia.
"""

import argparse
import csv
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("Dependência ausente: instale com  pip install openpyxl")


def cell_value(cell) -> str:
    """Retorna o valor da célula como string limpa."""
    value = cell.value
    if value is None:
        return ""
    # openpyxl pode retornar floats para inteiros (ex: 1.0 → "1")
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return str(value)


def xlsx_to_csv(
    input_path: Path,
    output_path: Path,
    delimiter: str = ",",
    encoding: str = "utf-8-sig",  # utf-8-sig adiciona BOM — facilita abertura no Excel
) -> int:
    """Converte a primeira aba do XLSX para CSV. Retorna o número de linhas escritas."""
    wb = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
    ws = wb.worksheets[0]

    rows_written = 0
    with output_path.open("w", newline="", encoding=encoding) as f:
        writer = csv.writer(
            f,
            delimiter=delimiter,
            quotechar='"',
            quoting=csv.QUOTE_MINIMAL,  # só coloca aspas quando necessário
            lineterminator="\r\n",      # BigQuery aceita \r\n e \n
        )
        for row in ws.iter_rows():
            writer.writerow([cell_value(c) for c in row])
            rows_written += 1

    wb.close()
    return rows_written


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Converte a primeira aba de um XLSX para CSV (BigQuery-friendly)."
    )
    parser.add_argument("input", help="Arquivo XLSX de entrada")
    parser.add_argument("output", help="Arquivo CSV de saída")
    parser.add_argument(
        "--delimiter",
        default=",",
        help="Delimitador de campo (padrão: vírgula)",
    )
    parser.add_argument(
        "--encoding",
        default="utf-8-sig",
        help="Encoding do CSV de saída (padrão: utf-8-sig)",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        sys.exit(f"Arquivo não encontrado: {input_path}")

    print(f"Convertendo '{input_path}' → '{output_path}'")
    print(f"  Aba: {openpyxl.load_workbook(input_path, read_only=True).worksheets[0].title!r}")
    print(f"  Delimitador: {args.delimiter!r}  |  Encoding: {args.encoding}")

    n = xlsx_to_csv(input_path, output_path, args.delimiter, args.encoding)
    print(f"  Concluído: {n} linhas escritas.")


if __name__ == "__main__":
    main()
