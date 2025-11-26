import json
import os
from pathlib import Path
from threading import Lock
from typing import Dict, List

from normalizer import normalize_name

DEFAULT_GNIS_DATA_PATH = Path(__file__).resolve().parent / "data" / "gnis_wa_lakes.json"
HYDROGRAPHY_DATA_PATH = os.getenv("HYDROGRAPHY_DATA_PATH")

_records: List[Dict] = []
_loaded = False
_lock = Lock()


def _load_json(path: Path) -> List[Dict]:
  if not path.exists():
    raise FileNotFoundError(f"GNIS dataset missing at {path}")
  with open(path, "r", encoding="utf-8") as handle:
    return json.load(handle)


def _hydrate(records: List[Dict]) -> List[Dict]:
  hydrated = []
  for record in records:
    normalized = normalize_name(record.get("official_name", ""))
    hydrated.append(
      {
        **record,
        "normalized": normalized,
        "tokens": normalized["tokens"]
      }
    )
  return hydrated


def load_gnis_database() -> List[Dict]:
  global _records, _loaded
  if _loaded:
    return _records

  with _lock:
    if _loaded:
      return _records

    gnis_records = _load_json(Path(os.getenv("GNIS_DATA_PATH", DEFAULT_GNIS_DATA_PATH)))
    hydrated = _hydrate(gnis_records)

    if HYDROGRAPHY_DATA_PATH:
      hydro_path = Path(HYDROGRAPHY_DATA_PATH)
      if hydro_path.exists():
        hydro_records = _hydrate(_load_json(hydro_path))
        hydrated.extend(hydro_records)
      else:
        print(f"[lake-matcher] Hydrography dataset not found at {hydro_path}, ignoring.")

    seen = set()
    deduped: List[Dict] = []
    for record in hydrated:
      key = (record["official_name"], record["latitude"], record["longitude"])
      if key in seen:
        continue
      seen.add(key)
      deduped.append(record)

    _records = deduped
    _loaded = True
    return _records
