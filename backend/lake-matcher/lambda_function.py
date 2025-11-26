import json
from match_service import match_lake_name


def _extract_params(event):
  lake_name = None
  county = None

  def _apply_candidate(data):
    nonlocal lake_name, county
    if not isinstance(data, dict):
      return
    if not lake_name:
      if data.get("wdfwName"):
        lake_name = data["wdfwName"]
      elif data.get("name"):
        lake_name = data["name"]
    if not county and data.get("county"):
      county = data["county"]

  if isinstance(event, dict):
    _apply_candidate(event)
    qs = event.get("queryStringParameters") or {}
    _apply_candidate(qs)
    body = event.get("body")
    if body:
      try:
        payload = json.loads(body)
        _apply_candidate(payload)
      except (json.JSONDecodeError, TypeError):
        pass

  return lake_name, county


def handler(event, _context):
  try:
    lake_name, county = _extract_params(event or {})
    if not lake_name:
      return {
        "statusCode": 400,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"message": "Missing wdfwName parameter"})
      }

    result = match_lake_name(lake_name, county=county)
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
