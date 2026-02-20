#!/usr/bin/env python3
"""Seed CITIES_JA from GeoNames top 100 populated places in Japan.

Requires network access. Uses GeoNames searchJSON ordered by population.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import ssl
import urllib.parse
import urllib.request

DEFAULT_DB = "assets/database/moon_calendar_translated_2.db"
DEFAULT_LIMIT = 100


def fetch_geonames(username: str, limit: int, lang: str, insecure: bool) -> list[dict]:
    base_url = "https://api.geonames.org/searchJSON"
    params = {
        "country": "JP",
        "featureClass": "P",
        "orderby": "population",
        "maxRows": str(limit),
        "lang": lang,
        "style": "FULL",
        "username": username,
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    context = None
    if insecure:
        context = ssl._create_unverified_context()

    with urllib.request.urlopen(url, timeout=30, context=context) as resp:
        data = json.load(resp)

    if isinstance(data, dict) and "status" in data:
        status = data["status"]
        raise RuntimeError(f"GeoNames error {status.get('value')}: {status.get('message')}")

    geonames = data.get("geonames") or []
    if not geonames:
        raise RuntimeError("GeoNames returned no results.")

    return geonames


def ensure_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        'CREATE TABLE IF NOT EXISTS CITIES_JA ("INDEX" INTEGER, "NAME" TEXT, "LONGITUDE" TEXT, "LATITUDE" TEXT)'
    )


def seed_table(conn: sqlite3.Connection, rows: list[tuple[int, str, str, str]]) -> None:
    conn.execute("DELETE FROM CITIES_JA")
    conn.executemany(
        'INSERT INTO CITIES_JA ("INDEX", "NAME", "LONGITUDE", "LATITUDE") VALUES (?, ?, ?, ?)', rows
    )
    conn.commit()


def build_rows(geonames: list[dict], limit: int) -> list[tuple[int, str, str, str]]:
    rows: list[tuple[int, str, str, str]] = []
    for idx, item in enumerate(geonames[:limit], start=1):
        name = (item.get("name") or "").strip()
        if not name:
            name = (item.get("toponymName") or "").strip()
        if not name:
            continue
        lat = item.get("lat")
        lng = item.get("lng")
        if lat is None or lng is None:
            continue
        rows.append((idx, name, str(lng), str(lat)))

    if len(rows) < limit:
        raise RuntimeError(f"Only built {len(rows)} rows (expected {limit}).")

    return rows


def write_csv(path: str, rows: list[tuple[int, str, str, str]]) -> None:
    import csv

    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["INDEX", "NAME", "LONGITUDE", "LATITUDE"])
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed CITIES_JA from GeoNames API.")
    parser.add_argument("--db", default=DEFAULT_DB, help="SQLite database path")
    parser.add_argument(
        "--username",
        default=os.getenv("GEONAMES_USERNAME", "astrocbeeapps"),
        help="GeoNames username (env GEONAMES_USERNAME). Default: demo",
    )
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--lang", default="ja", help="Language for place names")
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable SSL verification (workaround for local SSL issues).",
    )
    parser.add_argument("--csv", help="Optional CSV output path")
    args = parser.parse_args()

    geonames = fetch_geonames(args.username, args.limit, args.lang, args.insecure)
    rows = build_rows(geonames, args.limit)

    conn = sqlite3.connect(args.db)
    try:
        ensure_table(conn)
        seed_table(conn, rows)
    finally:
        conn.close()

    if args.csv:
        write_csv(args.csv, rows)

    print(f"Seeded CITIES_JA with {len(rows)} rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
