#!/usr/bin/env python3
import argparse
import csv
import json
import os
import re
import sqlite3
import sys
import time
import urllib.request
from typing import Dict, Any, List, Set

API_URL = "https://api.openai.com/v1/chat/completions"
ENV_DEFAULT = "scripts/.env"

TRANSLATABLE_EXCLUDE = {"MOON_DATE_NUMBER"}


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


def load_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info('{table}')")
    rows = cur.fetchall()
    return [r[1] for r in rows]


def fetch_rows(conn: sqlite3.Connection, table: str, columns: List[str], limit: int | None) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    col_sql = ", ".join(columns)
    sql = f"SELECT {col_sql} FROM {table}"
    if limit:
        sql += f" LIMIT {int(limit)}"
    cur.execute(sql)
    rows = cur.fetchall()
    result = []
    for row in rows:
        result.append({col: row[idx] for idx, col in enumerate(columns)})
    return result


def call_openai(api_key: str, model: str, system: str, user: str, temperature: float = 0.2, max_retries: int = 3) -> str:
    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }

    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(API_URL, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = resp.read().decode("utf-8")
                parsed = json.loads(body)
                content = parsed["choices"][0]["message"]["content"]
                return content
        except Exception:
            if attempt == max_retries:
                raise
            sleep_time = 2 * attempt
            time.sleep(sleep_time)

    raise RuntimeError("OpenAI request failed")


def clean_json(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
    cleaned = cleaned.replace("```json", "").replace("```", "")
    # Remove trailing commas before } or ]
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
    return cleaned


def extract_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            snippet = text[start : end + 1]
            try:
                return json.loads(snippet)
            except Exception:
                cleaned = clean_json(snippet)
                return json.loads(cleaned)
        raise


def translate_row(
    api_key: str,
    model: str,
    row: Dict[str, Any],
    columns: List[str],
    source_lang: str,
    target_lang: str,
) -> Dict[str, Any]:
    payload = {}
    for col in columns:
        if col in TRANSLATABLE_EXCLUDE:
            payload[col] = row.get(col)
        else:
            payload[col] = row.get(col) or ""

    system = (
        f"You are a professional translator. Translate from {source_lang} to {target_lang}. "
        "Preserve meaning, tone, and line breaks. Do not add new fields. "
        "Return ONLY valid JSON with the exact same keys."
    )
    user = json.dumps(payload, ensure_ascii=False)

    response = call_openai(api_key, model, system, user)
    translated = extract_json(response)

    for col in columns:
        if col not in translated:
            translated[col] = payload[col]

    translated["MOON_DATE_NUMBER"] = payload.get("MOON_DATE_NUMBER")

    return translated


def load_completed(csv_path: str) -> Set[str]:
    if not os.path.exists(csv_path):
        return set()
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {row.get("MOON_DATE_NUMBER") for row in reader if row.get("MOON_DATE_NUMBER")}


def main() -> int:
    parser = argparse.ArgumentParser(description="Translate MOON_DAY_INFO_ENG to Japanese and export CSV.")
    parser.add_argument("--db", required=True, help="Path to sqlite DB")
    parser.add_argument("--table", default="MOON_DAY_INFO_ENG", help="Source table name")
    parser.add_argument("--out", required=True, help="Output CSV path")
    parser.add_argument("--model", default="gpt-4o-mini", help="OpenAI model")
    parser.add_argument("--env", default=ENV_DEFAULT, help="Path to .env file")
    parser.add_argument("--limit", type=int, default=None, help="Limit rows (for testing)")
    parser.add_argument("--rate", type=float, default=0.2, help="Delay between requests (seconds)")
    parser.add_argument("--dry-run", action="store_true", help="Do not call API, only output headers")
    parser.add_argument("--resume", action="store_true", help="Resume from existing CSV")

    args = parser.parse_args()

    load_env_file(args.env)
    api_key = os.environ.get("OPENAI_API_KEY")
    if not args.dry_run and not api_key:
        print("OPENAI_API_KEY is required.", file=sys.stderr)
        return 1

    conn = sqlite3.connect(args.db)
    columns = load_columns(conn, args.table)
    if not columns:
        print(f"No columns found for {args.table}", file=sys.stderr)
        return 1

    rows = fetch_rows(conn, args.table, columns, args.limit)
    if args.dry_run:
        with open(args.out, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
        print(f"Dry run: wrote headers to {args.out}")
        return 0

    completed = load_completed(args.out) if args.resume else set()
    write_header = not os.path.exists(args.out) or not args.resume

    with open(args.out, "a" if args.resume else "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        if write_header:
            writer.writeheader()
        for idx, row in enumerate(rows, 1):
            if args.resume and row.get("MOON_DATE_NUMBER") in completed:
                continue
            translated = translate_row(api_key, args.model, row, columns, "English", "Japanese")
            writer.writerow(translated)
            if args.rate > 0:
                time.sleep(args.rate)
            if idx % 5 == 0:
                print(f"Translated {idx}/{len(rows)}")

    print(f"Done. CSV saved to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
