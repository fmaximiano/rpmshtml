#!/usr/bin/env python3
"""
Converte a primeira aba de um arquivo XLSX para CSV compatível com BigQuery.

Uso:
    python xlsx_to_csv.py input.xlsx output.csv
    python xlsx_to_csv.py input.xlsx output.csv --delimiter ","
    python xlsx_to_csv.py input.xlsx output.csv --encoding utf-8
    python xlsx_to_csv.py input.xlsx output.csv --keep-newlines

Regras de quoting aplicadas (RFC 4180):
- Campos que contêm o delimitador ou aspas duplas são envolvidos em aspas duplas.
- Aspas duplas dentro de campos são escapadas duplicando-as ("").
- Valores None/NaN são exportados como string vazia.
- Por padrão, quebras de linha INTERNAS a células são substituídas por espaço,
  pois o BigQuery não aceita campos multilinhas sem a flag allow_quoted_newlines.
  Use --keep-newlines para preservá-las (e habilite allow_quoted_newlines no BQ).
"""

import argparse
import csv
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("Dependência ausente: instale com  pip install openpyxl")

_NEWLINES = re.compile(r"\r\n|\r|\n")


def cell_value(cell, newline_replacement: str) -> str:
    """Retorna o valor da célula como string limpa e segura para CSV."""
    value = cell.value
    if value is None:
        return ""
    # openpyxl pode retornar floats para inteiros (ex: 1.0 → "1")
    if isinstance(value, float):
        if value == int(value):
            return str(int(value))
        return str(value)
    text = str(value)
    if newline_replacement is not None:
        text = _NEWLINES.sub(newline_replacement, text)
    return text


def xlsx_to_csv(
    input_path: Path,
    output_path: Path,
    delimiter: str = ",",
    encoding: str = "utf-8-sig",
    newline_replacement: str | None = " ",
) -> tuple[int, int]:
    """
    Converte a primeira aba do XLSX para CSV.
    Retorna (linhas_escritas, celulas_com_newline).
    """
    wb = openpyxl.load_workbook(input_path, read_only=True, data_only=True)
    ws = wb.worksheets[0]

    rows_written = 0
    cells_with_newlines = 0

    with output_path.open("w", newline="", encoding=encoding) as f:
        writer = csv.writer(
            f,
            delimiter=delimiter,
            quotechar='"',
            quoting=csv.QUOTE_MINIMAL,
            lineterminator="\r\n",
        )
        for row in ws.iter_rows():
            values = []
            for c in row:
                raw = c.value
                v = cell_value(c, newline_replacement)
                # detecta se havia newline antes da substituição
                if (
                    newline_replacement is not None
                    and isinstance(raw, str)
                    and _NEWLINES.search(raw)
                ):
                    cells_with_newlines += 1
                values.append(v)
            writer.writerow(values)
            rows_written += 1

    wb.close()
    return rows_written, cells_with_newlines


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
    parser.add_argument(
        "--keep-newlines",
        action="store_true",
        help=(
            "Preserva quebras de linha internas às células (requer "
            "allow_quoted_newlines habilitado no BigQuery)."
        ),
    )
    parser.add_argument(
        "--newline-replacement",
        default=" ",
        metavar="STR",
        help=(
            "String usada para substituir quebras de linha internas "
            "(padrão: espaço). Ignorado se --keep-newlines estiver ativo."
        ),
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        sys.exit(f"Arquivo não encontrado: {input_path}")

    newline_replacement = None if args.keep_newlines else args.newline_replacement

    wb_peek = openpyxl.load_workbook(input_path, read_only=True)
    sheet_title = wb_peek.worksheets[0].title
    wb_peek.close()

    print(f"Convertendo '{input_path}' → '{output_path}'")
    print(f"  Aba: {sheet_title!r}  |  Delimitador: {args.delimiter!r}  |  Encoding: {args.encoding}")
    if newline_replacement is not None:
        print(f"  Quebras de linha internas → substituídas por {newline_replacement!r}")
    else:
        print("  Quebras de linha internas → preservadas (certifique-se de habilitar allow_quoted_newlines no BigQuery)")

    rows, newline_cells = xlsx_to_csv(
        input_path, output_path, args.delimiter, args.encoding, newline_replacement
    )
    print(f"  Concluído: {rows} linhas escritas.")
    if newline_cells:
        print(f"  Aviso: {newline_cells} célula(s) continham quebras de linha internas e foram tratadas.")


if __name__ == "__main__":
    main()
