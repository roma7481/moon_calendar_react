#!/usr/bin/env python3
"""Translate zodiac tables to Japanese.

- ZODIAC_INFO_ENG -> ZODIAC_INFO_JA (translate NAME, INFO from EN->JA)
- ZODIAC_GARDEN_RU -> ZODIAC_GARDEN_JA (translate NAME, INFO from RU->JA)

Creates target tables if missing and overwrites existing rows.
Outputs CSVs for review.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import time
import urllib.request

DB_DEFAULT = "assets/database/moon_calendar_translated_2.db"
MODEL_DEFAULT = "gpt-4.1-mini"
ENV_DEFAULT = "scripts/.env"


def load_env_file(path: str) -> None:
    if not path or not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = value


def openai_post(api_key: str, model: str, source_lang: str, rows: list[dict]) -> list[dict]:
    system = (
        "You are a precise translator. Translate to Japanese. "
        "Return ONLY a JSON array of objects with keys: name, info. "
        "Do not change order. No extra text."
    )

    # Prepare compact JSON input
    user_payload = json.dumps(
        [{"name": r["name"], "info": r["info"]} for r in rows], ensure_ascii=False
    )
    user = {
        "type": "input_text",
        "text": f"Source language: {source_lang}. Translate these items: {user_payload}",
    }

    payload = {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": system}]},
            {"role": "user", "content": [user]},
        ],
        "temperature": 0.2,
    }

    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.load(resp)

    text_chunks = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                text_chunks.append(content.get("text", ""))
    text = "\n".join(text_chunks).strip()

    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"No JSON array found in response: {text[:200]}")

    return json.loads(text[start : end + 1])


def ensure_table(conn: sqlite3.Connection, table: str) -> None:
    conn.execute(
        f'CREATE TABLE IF NOT EXISTS {table} ("ZODIAC" TEXT, "NAME" TEXT, "INFO" TEXT)'
    )


def fetch_rows(conn: sqlite3.Connection, table: str) -> list[dict]:
    cur = conn.execute(f'SELECT "ZODIAC", "NAME", "INFO" FROM {table}')
    rows = []
    for zodiac, name, info in cur.fetchall():
        rows.append({"zodiac": zodiac, "name": name or "", "info": info or ""})
    return rows


def replace_table(conn: sqlite3.Connection, table: str, rows: list[dict]) -> None:
    conn.execute(f'DELETE FROM {table}')
    conn.executemany(
        f'INSERT INTO {table} ("ZODIAC", "NAME", "INFO") VALUES (?, ?, ?)',
        [(r["zodiac"], r["name"], r["info"]) for r in rows],
    )
    conn.commit()


def write_csv(path: str, rows: list[dict], source_lang: str) -> None:
    import csv

    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["ZODIAC", "NAME_JA", "INFO_JA", f"NAME_{source_lang}", f"INFO_{source_lang}"])
        for r in rows:
            writer.writerow([r["zodiac"], r["name_ja"], r["info_ja"], r["name_src"], r["info_src"]])


def translate_table(
    conn: sqlite3.Connection,
    api_key: str,
    model: str,
    source_table: str,
    target_table: str,
    source_lang: str,
    csv_path: str,
    batch_size: int,
) -> None:
    ensure_table(conn, target_table)
    source_rows = fetch_rows(conn, source_table)

    translated_rows = []
    for i in range(0, len(source_rows), batch_size):
        batch = source_rows[i : i + batch_size]
        translated = openai_post(api_key, model, source_lang, batch)
        if len(translated) != len(batch):
            raise RuntimeError(
                f"Translation count mismatch for {source_table}. Expected {len(batch)} got {len(translated)}"
            )

        for src, tr in zip(batch, translated):
            name_ja = str(tr.get("name", "")).strip() or src["name"]
            info_ja = str(tr.get("info", "")).strip() or src["info"]
            translated_rows.append(
                {
                    "zodiac": src["zodiac"],
                    "name": name_ja,
                    "info": info_ja,
                    "name_src": src["name"],
                    "info_src": src["info"],
                    "name_ja": name_ja,
                    "info_ja": info_ja,
                }
            )

        time.sleep(0.2)

    replace_table(conn, target_table, translated_rows)
    write_csv(csv_path, translated_rows, source_lang)


def main() -> int:
    parser = argparse.ArgumentParser(description="Translate zodiac tables to Japanese")
    parser.add_argument("--db", default=DB_DEFAULT)
    parser.add_argument("--env", default=ENV_DEFAULT, help="Path to .env file")
    parser.add_argument("--api-key", default=os.getenv("OPENAI_API_KEY"))
    parser.add_argument("--model", default=MODEL_DEFAULT)
    parser.add_argument("--batch-size", type=int, default=6)
    parser.add_argument(
        "--csv-info",
        default="scripts/zodiac_info_ja.csv",
        help="CSV output for ZODIAC_INFO",
    )
    parser.add_argument(
        "--csv-garden",
        default="scripts/zodiac_garden_ja.csv",
        help="CSV output for ZODIAC_GARDEN",
    )
    args = parser.parse_args()

    load_env_file(args.env)
    if not args.api_key:
        args.api_key = os.getenv("OPENAI_API_KEY")

    if not args.api_key:
        raise SystemExit("Missing OPENAI_API_KEY or --api-key")

    conn = sqlite3.connect(args.db)
    try:
        translate_table(
            conn,
            args.api_key,
            args.model,
            "ZODIAC_INFO_ENG",
            "ZODIAC_INFO_JA",
            "EN",
            args.csv_info,
            args.batch_size,
        )
        translate_table(
            conn,
            args.api_key,
            args.model,
            "ZODIAC_GARDEN_RU",
            "ZODIAC_GARDEN_JA",
            "RU",
            args.csv_garden,
            args.batch_size,
        )
    finally:
        conn.close()

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
