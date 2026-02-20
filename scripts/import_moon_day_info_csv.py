#!/usr/bin/env python3
import argparse
import csv
import sqlite3
from typing import List


def get_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info('{table}')")
    return [r[1] for r in cur.fetchall()]


def create_table_like(conn: sqlite3.Connection, source_table: str, target_table: str):
    cur = conn.cursor()
    cur.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        (source_table,),
    )
    row = cur.fetchone()
    if not row or not row[0]:
        raise RuntimeError(f"Source table {source_table} not found")
    create_sql = row[0].replace(source_table, target_table)
    cur.execute(f"DROP TABLE IF EXISTS {target_table}")
    cur.execute(create_sql)
    conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description="Import translated CSV into a new sqlite table.")
    parser.add_argument("--db", required=True, help="Path to sqlite DB")
    parser.add_argument("--csv", required=True, help="CSV file path")
    parser.add_argument("--source-table", default="MOON_DAY_INFO_ENG", help="Source table to mirror schema")
    parser.add_argument("--target-table", default="MOON_DAY_INFO_JA", help="Target table name")
    parser.add_argument("--truncate", action="store_true", help="Drop and recreate target table")

    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    if args.truncate:
        create_table_like(conn, args.source_table, args.target_table)

    columns = get_columns(conn, args.target_table)
    if not columns:
        raise RuntimeError(f"Target table {args.target_table} not found or has no columns")

    with open(args.csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [row for row in reader]

    if not rows:
        print("No rows found in CSV.")
        return 1

    for row in rows:
        for col in columns:
            if col not in row:
                row[col] = None

    placeholders = ",".join(["?"] * len(columns))
    col_sql = ",".join(columns)
    sql = f"INSERT INTO {args.target_table} ({col_sql}) VALUES ({placeholders})"

    values = []
    for row in rows:
        values.append([row.get(col) for col in columns])

    cur = conn.cursor()
    cur.executemany(sql, values)
    conn.commit()

    print(f"Imported {len(values)} rows into {args.target_table}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
