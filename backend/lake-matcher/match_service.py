import os
from decimal import Decimal
from typing import Any, Dict, Optional

from cache import check_cache, write_cache
from manual_override import manual_override_check
from matcher import find_matching_lake
from normalizer import normalize_name


def _serialize_decimal(value: Any) -> Any:
  if isinstance(value, Decimal):
    return float(value)
  if isinstance(value, dict):
    return {k: _serialize_decimal(v) for k, v in value.items()}
  if isinstance(value, list):
    return [_serialize_decimal(v) for v in value]
  return value


def match_lake_name(wdfw_name: str) -> Dict[str, Any]:
  if not wdfw_name or not isinstance(wdfw_name, str):
    raise ValueError("wdfwName must be a non-empty string")

  trimmed = wdfw_name.strip()
  if not trimmed:
    raise ValueError("wdfwName must be a non-empty string")

  manual = manual_override_check(trimmed)
  if manual:
    return manual

  cached = check_cache(trimmed)
  if cached:
    return cached

  normalized = normalize_name(trimmed)
  result = find_matching_lake(normalized)

  if result:
    write_cache(trimmed, result)
    return _serialize_decimal(result)

  return {
    "officialName": None,
    "lat": None,
    "lng": None,
    "matched_score": 0,
    "source": "algorithm"
  }
