import re
from typing import Dict, List, Optional

TOKEN_EXPANSIONS = {
  "lk": ["lake"],
  "lks": ["lakes"],
  "pd": ["pond"],
  "pnd": ["pond"],
  "prk": ["park"],
  "pk": ["park"],
  "res": ["reservoir"],
  "co": ["county"],
  "cnty": ["county"],
  "st": ["saint"],
  "mt": ["mount"],
  "mtn": ["mountain"],
  "ctr": ["center"],
  "ctrs": ["centers"],
  "no": ["number"],
  "n": ["north"],
  "s": ["south"],
  "e": ["east"],
  "w": ["west"],
  "ne": ["northeast"],
  "nw": ["northwest"],
  "se": ["southeast"],
  "sw": ["southwest"]
}

COUNTY_ABBREVIATIONS = {
  "ADAM": "adams",
  "ASOT": "asotin",
  "BENT": "benton",
  "CHEL": "chelan",
  "CLAL": "clallam",
  "CLAR": "clark",
  "COWL": "cowlitz",
  "DOUG": "douglas",
  "FERR": "ferry",
  "FRAN": "franklin",
  "GARF": "garfield",
  "GRAN": "grant",
  "GRAY": "grays harbor",
  "ISLA": "island",
  "JEFF": "jefferson",
  "KING": "king",
  "KITS": "kitsap",
  "KITT": "kittitas",
  "KLIC": "klickitat",
  "LEWI": "lewis",
  "LINC": "lincoln",
  "MASO": "mason",
  "OKAN": "okanogan",
  "PACI": "pacific",
  "PEND": "pend oreille",
  "PIER": "pierce",
  "SANJ": "san juan",
  "SKAG": "skagit",
  "SKAM": "skamania",
  "SNOH": "snohomish",
  "SPOK": "spokane",
  "STEV": "stevens",
  "THUR": "thurston",
  "WAHK": "wahkiakum",
  "WALL": "walla walla",
  "WHAT": "whatcom",
  "WHIT": "whitman",
  "YAKI": "yakima"
}


def _normalize_county_input(value: Optional[str]) -> Optional[str]:
  if not value:
    return None
  cleaned = (
    value.lower()
    .replace("county", " ")
    .replace("cnty", " ")
  )
  cleaned = re.sub(r"[^a-z\s]", " ", cleaned)
  cleaned = re.sub(r"\s+", " ", cleaned).strip()
  return cleaned or None


def _detect_county_hint(raw_name: str) -> Optional[str]:
  uppercase = raw_name.upper()
  matches = re.findall(r"\(([A-Z]{3,5})\)", uppercase)
  for code in matches:
    if code in COUNTY_ABBREVIATIONS:
      return COUNTY_ABBREVIATIONS[code]

  for code, county in COUNTY_ABBREVIATIONS.items():
    if f"{code} CO" in uppercase or f"{code} COUNTY" in uppercase:
      return county

  for county in COUNTY_ABBREVIATIONS.values():
    if county.upper() in uppercase:
      return county
  return None


def _normalize_token(token: str) -> List[str]:
  lower = token.lower()
  if lower in TOKEN_EXPANSIONS:
    return TOKEN_EXPANSIONS[lower]
  if lower.upper() in COUNTY_ABBREVIATIONS:
    return COUNTY_ABBREVIATIONS[lower.upper()].split()
  return [lower]


def normalize_name(raw_name: str, explicit_county: Optional[str] = None) -> Dict[str, any]:
  if not isinstance(raw_name, str):
    return {"normalized": "", "tokens": [], "countyHint": None}

  detected = _detect_county_hint(raw_name)
  county_hint = _normalize_county_input(explicit_county) or _normalize_county_input(detected)
  working = (
    raw_name.replace("&", " and ")
    .replace("-", " ")
    .replace("_", " ")
    .replace("/", " ")
  )
  working = re.sub(r"[()]", " ", working)
  working = re.sub(r"[^0-9a-zA-Z\s]", " ", working)
  working = working.lower()

  tokens = [token for token in working.split() if token]
  expanded: List[str] = []
  for token in tokens:
    expanded.extend(_normalize_token(token))

  deduped: List[str] = []
  seen = set()
  for token in expanded:
    if token and token not in seen:
      seen.add(token)
      deduped.append(token)

  return {
    "normalized": " ".join(deduped),
    "tokens": deduped,
    "countyHint": county_hint
  }
