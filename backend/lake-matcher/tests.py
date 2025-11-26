import os
import sys
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
os.environ["GNIS_DATA_PATH"] = str(BASE_DIR / "data" / "sample_gnis.json")
os.environ["LAKE_MATCH_CACHE_TABLE"] = ""

sys.path.insert(0, str(BASE_DIR))

import match_service  # noqa: E402
from normalizer import normalize_name  # noqa: E402


class MatcherTests(unittest.TestCase):
  def test_manual_override(self):
    result = match_service.match_lake_name("LEWIS CO PRK PD-S")
    self.assertEqual(result["officialName"], "South Lewis County Regional Park Pond")
    self.assertEqual(result["source"], "manual_override")

  def test_normalization(self):
    normalized = normalize_name("Sunset LK (SNOH)")
    self.assertEqual(normalized["countyHint"], "snohomish")
    self.assertIn("lake", normalized["tokens"])

  def test_algorithm_match(self):
    result = match_service.match_lake_name("Battle Ground Lk")
    self.assertEqual(result["officialName"], "Battle Ground Lake")
    self.assertEqual(result["source"], "algorithm")


if __name__ == "__main__":
  unittest.main()
