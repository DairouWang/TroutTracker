import os
from datetime import datetime
from typing import Any, Dict, Optional

try:
  import boto3
except ImportError:  # pragma: no cover
  boto3 = None

_dynamodb = None


def _client():
  if boto3 is None:
    return None
  global _dynamodb
  if _dynamodb is None:
    _dynamodb = boto3.client("dynamodb")
  return _dynamodb


def _table_name() -> Optional[str]:
  return os.getenv("LAKE_MATCH_CACHE_TABLE")


def check_cache(lake_name: str) -> Optional[Dict[str, Any]]:
  table = _table_name()
  if not table or boto3 is None:
    return None

  try:
    client = _client()
    if client is None:
      return None
    response = client.get_item(
      TableName=table,
      Key={"lake_name": {"S": lake_name}}
    )
  except Exception as exc:  # pragma: no cover
    print(f"[lake-matcher] Cache lookup failed: {exc}")
    return None

  item = response.get("Item")
  if not item:
    return None

  return {
    "officialName": item.get("official_name", {}).get("S"),
    "lat": float(item["lat"]["N"]) if "lat" in item else None,
    "lng": float(item["lng"]["N"]) if "lng" in item else None,
    "matched_score": float(item["matched_score"]["N"]) if "matched_score" in item else None,
    "source": "cache"
  }


def write_cache(lake_name: str, result: Dict[str, Any]) -> None:
  table = _table_name()
  if not table or boto3 is None:
    return

  try:
    item = {
      "lake_name": {"S": lake_name},
      "official_name": {"S": result.get("officialName", "") or ""},
      "lat": {"N": str(result.get("lat"))},
      "lng": {"N": str(result.get("lng"))},
      "matched_score": {"N": str(result.get("matched_score", 0))},
      "created_at": {"S": datetime.utcnow().isoformat()}
    }
    client = _client()
    if client is None:
      return
    client.put_item(TableName=table, Item=item)
  except Exception as exc:  # pragma: no cover
    print(f"[lake-matcher] Cache write failed: {exc}")
