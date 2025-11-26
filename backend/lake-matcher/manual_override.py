import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional


@lru_cache(maxsize=1)
def _load_overrides() -> Dict[str, Dict[str, float]]:
  override_path = os.getenv(
    "MANUAL_OVERRIDE_PATH",
    Path(__file__).resolve().parent / "manual_override.json"
  )
  try:
    with open(override_path, "r", encoding="utf-8") as handle:
      return json.load(handle)
  except FileNotFoundError:
    return {}


def manual_override_check(wdfw_name: str) -> Optional[Dict[str, float]]:
  overrides = _load_overrides()
  override = overrides.get(wdfw_name)
  if not override:
    return None
  return {
    "officialName": override["official_name"],
    "lat": override["lat"],
    "lng": override["lng"],
    "matched_score": 9007199254740991,
    "source": "manual_override"
  }
