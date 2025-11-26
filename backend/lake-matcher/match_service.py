import os
from decimal import Decimal
from typing import Any, Dict, Optional

from cache import check_cache, write_cache
from manual_override import manual_override_check
from matcher import find_matching_lake
from normalizer import normalize_name


def _build_cache_key(lake_name: str, county_hint: Optional[str]) -> str:
  if county_hint:
    return f"{lake_name}|{county_hint}"
  return lake_name


def _serialize_decimal(value: Any) -> Any:
  if isinstance(value, Decimal):
    return float(value)
  if isinstance(value, dict):
    return {k: _serialize_decimal(v) for k, v in value.items()}
  if isinstance(value, list):
    return [_serialize_decimal(v) for v in value]
  return value


def match_lake_name(wdfw_name: str, county: Optional[str] = None) -> Dict[str, Any]:
  if not wdfw_name or not isinstance(wdfw_name, str):
    raise ValueError("wdfwName must be a non-empty string")

  trimmed = wdfw_name.strip()
  if not trimmed:
    raise ValueError("wdfwName must be a non-empty string")

  manual = manual_override_check(trimmed)
  if manual:
    return manual

  normalized = normalize_name(trimmed, explicit_county=county)
  county_hint = normalized.get("countyHint")
  cache_key = _build_cache_key(trimmed, county_hint)

  cached = check_cache(cache_key)
  if not cached and county_hint:
    cached = check_cache(trimmed)
  if cached:
    return cached

  result = find_matching_lake(normalized)

  if result:
    write_cache(cache_key, result)
    return _serialize_decimal(result)

  return {
    "officialName": None,
    "lat": None,
    "lng": None,
    "matched_score": 0,
    "source": "algorithm"
  }
