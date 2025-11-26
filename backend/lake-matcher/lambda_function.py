import json
from match_service import match_lake_name


def _extract_lake_name(event):
  if not event:
    return None
  if isinstance(event, dict):
    if event.get("wdfwName"):
      return event["wdfwName"]
    if event.get("name"):
      return event["name"]
    qs = event.get("queryStringParameters") or {}
    if qs.get("wdfwName"):
      return qs["wdfwName"]
    if qs.get("name"):
      return qs["name"]
    body = event.get("body")
    if body:
      try:
        payload = json.loads(body)
        if payload.get("wdfwName"):
          return payload["wdfwName"]
        if payload.get("name"):
          return payload["name"]
      except (json.JSONDecodeError, TypeError):
        return None
  return None


def handler(event, _context):
  try:
    lake_name = _extract_lake_name(event)
    if not lake_name:
      return {
        "statusCode": 400,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"message": "Missing wdfwName parameter"})
      }

    result = match_lake_name(lake_name)
    return {
      "statusCode": 200,
      "headers": {"Access-Control-Allow-Origin": "*"},
      "body": json.dumps(result)
    }
  except Exception as exc:  # pragma: no cover
    print(f"[lake-matcher] Handler error: {exc}")
    return {
      "statusCode": 500,
      "headers": {"Access-Control-Allow-Origin": "*"},
      "body": json.dumps({"message": "Matcher failure"})
    }
