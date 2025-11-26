import math
import os
from typing import Dict, List, Optional

from gnis_loader import load_gnis_database
from normalizer import normalize_name

MIN_TOKEN_SCORE = int(os.getenv("MIN_TOKEN_SCORE", "3"))


def _levenshtein(a: str, b: str) -> int:
  if a == b:
    return 0
  if not a:
    return len(b)
  if not b:
    return len(a)
  prev_row = list(range(len(b) + 1))
  for i, ca in enumerate(a, 1):
    row = [i]
    for j, cb in enumerate(b, 1):
      cost = 0 if ca == cb else 1
      row.append(min(row[-1] + 1, prev_row[j] + 1, prev_row[j - 1] + cost))
    prev_row = row
  return prev_row[-1]


def _tokens_partially_match(a: str, b: str) -> bool:
  if a == b:
    return False
  if len(a) < 3 or len(b) < 3:
    return False
  return a in b or b in a


def _compute_token_score(query_tokens: List[str], query_string: str, candidate_tokens: List[str]) -> Dict[str, int]:
  if not query_tokens or not candidate_tokens:
    return {"score": -math.inf, "exact": 0, "partial": 0}

  exact = 0
  partial = 0
  used = set()

  for idx, token in enumerate(candidate_tokens):
    if token in query_tokens:
      exact += 1
      used.add(idx)

  for i, candidate in enumerate(candidate_tokens):
    if i in used:
      continue
    for token in query_tokens:
      if _tokens_partially_match(token, candidate):
        partial += 1
        used.add(i)
        break

  candidate_string = " ".join(candidate_tokens)
  penalty = min(_levenshtein(query_string, candidate_string), 10)
  score = exact * 3 + partial - penalty
  return {"score": score, "exact": exact, "partial": partial}


def _county_boost(input_county: Optional[str], candidate_county: Optional[str]) -> int:
  if not input_county or not candidate_county:
    return 0
  return 2 if input_county.lower() in candidate_county.lower() else 0


def _fuzzy_fallback(records: List[Dict], query_string: str):
  best = None
  for record in records:
    normalized = record.get("normalized", {}).get("normalized")
    if not normalized:
      normalized = normalize_name(record["official_name"])["normalized"]
    distance = _levenshtein(query_string, normalized)
    score = max(1, 20 - distance)
    if not best or score > best["score"]:
      best = {"record": record, "score": score}
  if not best:
    return None
  return {
    "officialName": best["record"]["official_name"],
    "lat": best["record"]["latitude"],
    "lng": best["record"]["longitude"],
    "matched_score": best["score"],
    "source": "algorithm",
    "strategy": "fuzzy"
  }


def find_matching_lake(normalized_input: Dict) -> Optional[Dict]:
  records = load_gnis_database()
  county_hint = normalized_input.get("countyHint")
  query_tokens = normalized_input.get("tokens") or []
  query_string = normalized_input.get("normalized") or ""

  candidates = records
  if county_hint:
    narrowed = [
      record for record in records
      if record.get("county_name") and county_hint.lower() in record["county_name"].lower()
    ]
    if narrowed:
      candidates = narrowed

  best_match = None
  for record in candidates:
    token_sets = [record.get("tokens") or []]
    for alt in record.get("alternative_names") or record.get("alternative_names", []):
      norm_alt = normalize_name(alt)
      token_sets.append(norm_alt["tokens"])

    for token_set in token_sets:
      result = _compute_token_score(query_tokens, query_string, token_set)
      score = result["score"] + _county_boost(county_hint, record.get("county_name"))
      if best_match is None or score > best_match["matched_score"]:
        best_match = {
          "officialName": record["official_name"],
          "lat": record["latitude"],
          "lng": record["longitude"],
          "matched_score": score,
          "source": "algorithm",
          "strategy": "token",
          "feature_type": record.get("feature_type"),
          "county_name": record.get("county_name")
        }

  if best_match and best_match["matched_score"] >= MIN_TOKEN_SCORE:
    return best_match

  return _fuzzy_fallback(records, query_string)
