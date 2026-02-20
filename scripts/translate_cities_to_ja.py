#!/usr/bin/env python3
"""Translate CITIES_ENG names to Japanese and append to CITIES_JA.

- Skips Tokyo (already in top 100).
- Skips duplicates by longitude/latitude already in CITIES_JA.
- Appends after the current max INDEX in CITIES_JA.
- Writes CSV for review.

Requires OPENAI_API_KEY or --api-key.
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


def openai_post(api_key: str, model: str, names: list[str]) -> list[str]:
    system = (
        "You are a precise translator. Translate English city names to Japanese. "
        "Return ONLY a JSON array of strings in the same order. "
        "Use the most common Japanese exonyms. No extra text."
    )
    user = {"type": "input_text", "text": "Cities: " + ", ".join(names)}
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

    # Extract text from responses API
    text_chunks = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                text_chunks.append(content.get("text", ""))
    text = "\n".join(text_chunks).strip()

    # Extract JSON array
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"No JSON array found in response: {text[:200]}")
    return json.loads(text[start : end + 1])


def fetch_eng_cities(conn: sqlite3.Connection) -> list[tuple[str, str, str]]:
    cur = conn.execute('SELECT "NAME", "LONGITUDE", "LATITUDE" FROM CITIES_ENG')
    return [(row[0], row[1], row[2]) for row in cur.fetchall()]


def fetch_existing_coords(conn: sqlite3.Connection) -> set[tuple[str, str]]:
    cur = conn.execute('SELECT "LONGITUDE", "LATITUDE" FROM CITIES_JA')
    return {(row[0], row[1]) for row in cur.fetchall()}


def next_index(conn: sqlite3.Connection) -> int:
    cur = conn.execute('SELECT COALESCE(MAX("INDEX"), 0) FROM CITIES_JA')
    return int(cur.fetchone()[0]) + 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Translate CITIES_ENG -> CITIES_JA")
    parser.add_argument("--db", default=DB_DEFAULT)
    parser.add_argument("--env", default=ENV_DEFAULT, help="Path to .env file")
    parser.add_argument("--api-key", default=os.getenv("OPENAI_API_KEY"))
    parser.add_argument("--model", default=MODEL_DEFAULT)
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--csv", default="scripts/cities_ja_translated.csv")
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume by skipping names already in the CSV",
    )
    args = parser.parse_args()

    load_env_file(args.env)
    if not args.api_key:
        args.api_key = os.getenv("OPENAI_API_KEY")

    if not args.api_key:
        raise SystemExit("Missing OPENAI_API_KEY or --api-key")

    conn = sqlite3.connect(args.db)
    try:
        eng_rows = fetch_eng_cities(conn)
        existing_coords = fetch_existing_coords(conn)
        start_idx = next_index(conn)

        # Optional resume: load already translated EN names from CSV
        already_done = set()
        if args.resume and os.path.exists(args.csv):
            import csv

            with open(args.csv, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    name_en = (row.get("NAME_EN") or "").strip()
                    if name_en:
                        already_done.add(name_en.lower())

        to_translate: list[tuple[str, str, str]] = []
        for name, lng, lat in eng_rows:
            if not name:
                continue
            if name.strip().lower() == "tokyo":
                continue
            if (lng, lat) in existing_coords:
                continue
            if name.strip().lower() in already_done:
                continue
            to_translate.append((name.strip(), lng, lat))

        if not to_translate:
            print("No cities to translate.")
            return 0

        # Prepare CSV output
        import csv

        with open(args.csv, "a", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            if f.tell() == 0:
                writer.writerow(["INDEX", "NAME_JA", "LONGITUDE", "LATITUDE", "NAME_EN"])

            batch_size = max(1, args.batch_size)
            idx = start_idx
            for i in range(0, len(to_translate), batch_size):
                batch = to_translate[i : i + batch_size]
                names = [b[0] for b in batch]

                translated = openai_post(args.api_key, args.model, names)
                if len(translated) != len(names):
                    raise RuntimeError(
                        f"Translation count mismatch. Expected {len(names)} got {len(translated)}"
                    )

                rows_to_insert = []
                for (name_en, lng, lat), name_ja in zip(batch, translated):
                    name_ja = str(name_ja).strip()
                    if not name_ja:
                        name_ja = name_en  # fallback
                    rows_to_insert.append((idx, name_ja, lng, lat))
                    writer.writerow([idx, name_ja, lng, lat, name_en])
                    idx += 1

                conn.executemany(
                    'INSERT INTO CITIES_JA ("INDEX", "NAME", "LONGITUDE", "LATITUDE") VALUES (?, ?, ?, ?)',
                    rows_to_insert,
                )
                conn.commit()

                time.sleep(0.2)

        print(f"Inserted {idx - start_idx} cities into CITIES_JA.")
        print(f"CSV: {args.csv}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
