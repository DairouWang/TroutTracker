#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path

ALLOWED_TYPES = {"lake", "reservoir", "pond"}


def parse_number(value: str):
  if value in (None, "", " "):
    return None
  try:
    return float(value)
  except ValueError:
    return None


def main():
  if len(sys.argv) < 2:
    print("Usage: python scripts/preprocess_gnis.py <GNIS_Lakes.txt> [output.json]")
    sys.exit(1)

  input_path = Path(sys.argv[1]).expanduser().resolve()
  output_path = (
    Path(sys.argv[2]).expanduser().resolve()
    if len(sys.argv) > 2
    else Path(__file__).resolve().parents[1] / "data" / "gnis_wa_lakes.json"
  )

  with input_path.open("r", encoding="utf-8") as handle:
    reader = csv.DictReader(handle, delimiter="|")
    washington_records = []
    for row in reader:
      state = (row.get("STATE_ALPHA") or "").strip().upper()
      if state != "WA":
        continue
      feature_type = (row.get("FEATURE_CLASS") or "").strip()
      if feature_type.lower() not in ALLOWED_TYPES:
        continue
      lat = parse_number(row.get("PRIM_LAT_DEC") or row.get("LATITUDE"))
      lng = parse_number(row.get("PRIM_LONG_DEC") or row.get("LONGITUDE"))
      if lat is None or lng is None:
        continue

      variant_field = row.get("VARIANT_NAME") or row.get("ALTERNATE_NAMES") or ""
      alternatives = [
        alt.strip() for alt in variant_field.replace(";", "|").split("|") if alt.strip()
      ]

      washington_records.append(
        {
          "gnis_id": row.get("FEATURE_ID"),
          "official_name": (row.get("FEATURE_NAME") or "").strip(),
          "feature_type": feature_type,
          "county_name": (row.get("COUNTY_NAME") or "").strip(),
          "latitude": lat,
          "longitude": lng,
          "alternative_names": alternatives
        }
      )

  output_path.parent.mkdir(parents=True, exist_ok=True)
  with output_path.open("w", encoding="utf-8") as target:
    json.dump(washington_records, target, indent=2)
  print(f"Processed {len(washington_records)} Washington waterbodies → {output_path}")


if __name__ == "__main__":
  main()
