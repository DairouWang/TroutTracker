"""
TroutTracker Lambda Scraper Function
Scrapes trout stocking data from WDFW website and stores it in DynamoDB
"""
import json
import os
import math
import re
import boto3
import requests
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
import time

# AWS client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'TroutStockingData')
table = dynamodb.Table(table_name)

# Google Geocoding API
GOOGLE_GEOCODING_API_KEY = os.environ.get('GOOGLE_GEOCODING_API_KEY', '')
GOOGLE_PLACES_API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY', GOOGLE_GEOCODING_API_KEY)
ACCESS_POINT_SEARCH_RADIUS_METERS = int(os.environ.get('ACCESS_POINT_SEARCH_RADIUS', '5000'))
ACCESS_POINT_MAX_DISTANCE_METERS = int(os.environ.get('ACCESS_POINT_MAX_DISTANCE', '3000'))
ACCESS_POINT_KEYWORDS = [
    'boat', 'launch', 'ramp', 'access', 'landing', 'marina', 'dock', 'parking', 'fishing'
]
ACCESS_POINT_MIN_REVIEWS = int(os.environ.get('ACCESS_POINT_MIN_REVIEWS', '1'))

ALLOWED_ACCESS_TYPES = {
    'boat_ramp',
    'boat_launch',
    'marina',
    'parking',
    'rv_park',
    'campground',
    'park',
    'tourist_attraction',
    'point_of_interest'
}

DISALLOWED_PLACE_TYPES = {
    'route',
    'street_address',
    'premise',
    'geocode'
}

DISALLOWED_NAME_PATTERNS = [
    r'\broad\b', r'\brd\b', r'\bstreet\b', r'\bst\b', r'\bdrive\b', r'\bdr\b',
    r'\bavenue\b', r'\bave\b', r'\bway\b', r'\blane\b', r'\bln\b', r'\btrail\b',
    r'\btrl\b', r'\bhighway\b', r'\bhwy\b', r'\bcourt\b', r'\bct\b', r'\bcircle\b',
    r'\bcir\b', r'\bboulevard\b', r'\bblvd\b', r'\bplace\b', r'\bpl\b'
]

DISALLOWED_NAME_REGEXES = [re.compile(pattern, re.IGNORECASE) for pattern in DISALLOWED_NAME_PATTERNS]

ABBREVIATION_REPLACEMENTS = [
    (r'\bLk\b', 'Lake'),
    (r'\bLks\b', 'Lakes'),
    (r'\bMt\b', 'Mount'),
    (r'\bMtn\b', 'Mountain'),
    (r'\bCr\b', 'Creek'),
    (r'\bPk\b', 'Peak'),
    (r'\bPt\b', 'Point'),
    (r'\bHbr\b', 'Harbor'),
    (r'\bSt\b', 'Saint'),
    (r'\bCtr\b', 'Center')
]


def clean_lake_name(name: str) -> str:
    if not name:
        return ''
    # Remove trailing parenthetical descriptors like "(County)" or "(Lake)"
    cleaned = re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()
    return cleaned or name


def normalize_county_name(name: str) -> str:
    if not name:
        return ''
    normalized = name.lower()
    normalized = normalized.replace('county', '')
    normalized = re.sub(r'[^a-z]', '', normalized)
    return normalized


def components_match_county(address_components: List[Dict], county: str) -> bool:
    target = normalize_county_name(county)
    if not target:
        return True

    for component in address_components or []:
        if 'administrative_area_level_2' in component.get('types', []):
            value = component.get('long_name') or component.get('short_name') or ''
            if normalize_county_name(value) == target:
                return True

    return False


def address_matches_county(address: str, county: str) -> bool:
    target = normalize_county_name(county)
    if not target:
        return True
    normalized = normalize_county_name(address or '')
    return target in normalized


def expand_lake_name(name: str) -> str:
    """Expand common abbreviations (e.g., Lk -> Lake) to help map searches."""
    expanded = name or ''
    for pattern, replacement in ABBREVIATION_REPLACEMENTS:
        expanded = re.sub(pattern, replacement, expanded, flags=re.IGNORECASE)
    # Collapse repeated whitespace
    return " ".join(expanded.split())


def build_lake_name_variants(name: str) -> List[str]:
    """Return a list of name variants to improve geocoding/Places lookups."""
    variants = []
    base = (name or '').strip()
    if base:
        variants.append(base)
    expanded = expand_lake_name(base)
    if expanded and expanded.lower() != base.lower():
        variants.append(expanded)

    # Ensure we include a version that explicitly contains "Lake"
    lower_base = base.lower()
    if base and 'lake' not in lower_base:
        variants.append(f"{base} Lake")
        variants.append(f"Lake {base}")
    if expanded and 'lake' not in expanded.lower():
        variants.append(f"{expanded} Lake")

    # Remove duplicates while preserving order
    seen = set()
    deduped = []
    for variant in variants:
        normalized = variant.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(normalized)

    return deduped or [name]


def _places_nearby(location: Tuple[float, float], keyword: str, radius: int) -> List[Dict]:
    if not GOOGLE_PLACES_API_KEY:
        return []

    params = {
        'location': f"{location[0]},{location[1]}",
        'keyword': keyword,
        'radius': radius,
        'key': GOOGLE_PLACES_API_KEY
    }

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get('results', [])
    except Exception as e:
        print(f"Places nearby error ({keyword}): {str(e)}")
        return []


def _places_text_search(query: str, place_type: Optional[str] = None) -> List[Dict]:
    if not GOOGLE_PLACES_API_KEY:
        return []

    params = {
        'query': query,
        'key': GOOGLE_PLACES_API_KEY,
        'region': 'us'
    }
    if place_type:
        params['type'] = place_type

    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data.get('results', [])
    except Exception as e:
        print(f"Places text search error ({query}): {str(e)}")
        return []


def find_lake_place(lake_name: str, county: str = "") -> Optional[Dict]:
    """Use Google Places Text Search to locate the actual lake feature."""
    if not GOOGLE_PLACES_API_KEY:
        return None

    name_variants = build_lake_name_variants(lake_name)
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    type_preferences = [
        'natural_feature',
        'park',
        'point_of_interest'
    ]

    for variant in name_variants:
        query = f"{variant}, {county} County, Washington State, USA" if county else f"{variant}, Washington State, USA"
        params = {
            'query': query,
            'key': GOOGLE_PLACES_API_KEY,
            'type': 'natural_feature'
        }

        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"Places text search error for {variant}: {str(e)}")
            continue

        results = data.get('results', [])
        for result in results:
            types = result.get('types', [])
            name = result.get('name', '')
            if not types:
                continue

            type_rank = None
            for t in types:
                if t in type_preferences:
                    rank = type_preferences.index(t)
                    if type_rank is None or rank < type_rank:
                        type_rank = rank

            if type_rank is None and 'natural_feature' not in types and 'park' not in types:
                continue

            name_lower = name.lower()
            if 'lake' not in name_lower and 'reservoir' not in name_lower and 'pond' not in name_lower:
                continue

            location = result.get('geometry', {}).get('location')
            if not location:
                continue

            if county and not address_matches_county(result.get('formatted_address', ''), county):
                continue

            return {
                'lat': Decimal(str(location['lat'])),
                'lng': Decimal(str(location['lng'])),
                'source': 'lake_place',
                'place_id': result.get('place_id'),
                'place_name': name,
                'vicinity': result.get('formatted_address')
            }

    return None

# WDFW API endpoint (actual API discovered from network requests)
# Note: WDFW website uses dynamic loading, data comes from backend API
WDFW_API_URL = "https://wdfw.wa.gov/fishing/reports/stocking/trout-plants"


def geocode_lake(lake_name: str, county: str = "") -> Optional[Dict]:
    """
    Get lake coordinates using Google Geocoding API
    
    Args:
        lake_name: Lake name
        county: County name
        
    Returns:
        Dictionary containing lat and lng, or None if failed
    """
    if not GOOGLE_GEOCODING_API_KEY:
        print("Warning: Google Geocoding API Key not set")
        return None

    lake_place = find_lake_place(lake_name, county)
    if lake_place:
        return lake_place

    name_variants = build_lake_name_variants(lake_name)

    for variant in name_variants:
        try:
            # Build search query - prioritize county, then state
            search_query = f"{variant}, {county} County, Washington State, USA" if county else f"{variant}, Washington State, USA"

            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'address': search_query,
                'key': GOOGLE_GEOCODING_API_KEY,
                # Add bounds to restrict search to Washington State
                # Washington State approximate bounds: 45.5°N to 49°N, -124.8°W to -116.9°W
                'bounds': '45.5,-124.8|49.0,-116.9',
                # Strict bounds to only return results within Washington State
                'region': 'us'
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            if data['status'] == 'OK' and len(data['results']) > 0:
                result = data['results'][0]
                location = result['geometry']['location']

                # Verify result is in Washington State
                address_components = result.get('address_components', [])
                is_in_washington = False
                for component in address_components:
                    if 'administrative_area_level_1' in component.get('types', []):
                        if component.get('short_name') == 'WA' or component.get('long_name') == 'Washington':
                            is_in_washington = True
                            break

                if not is_in_washington:
                    print(f"Geocoding result not in Washington State: {variant}")
                    continue

                if county and not components_match_county(address_components, county):
                    print(f"Geocoding county mismatch for {variant}: expected {county}")
                    continue

                return {
                    'lat': Decimal(str(location['lat'])),
                    'lng': Decimal(str(location['lng'])),
                    'source': 'lake_center',
                    'location_type': result.get('geometry', {}).get('location_type', 'APPROXIMATE')
                }
            else:
                print(f"Geocoding failed: {variant} - {data.get('status', 'UNKNOWN')}")
                continue

        except Exception as e:
            print(f"Geocoding error {variant}: {str(e)}")
            continue

    return None


def _haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the distance in meters between two lat/lon pairs."""
    radius = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def _build_candidate_from_result(
    result: Dict,
    lake_lat: float,
    lake_lng: float,
    required_terms: Optional[List[str]],
    require_reviews: bool,
    query_label: str,
    county: str,
    stage_label: str
) -> Optional[Dict]:
    location = result.get('geometry', {}).get('location')
    if not location:
        return None

    candidate_lat = location.get('lat')
    candidate_lng = location.get('lng')
    if candidate_lat is None or candidate_lng is None:
        return None

    distance = _haversine_distance_m(lake_lat, lake_lng, candidate_lat, candidate_lng)
    if distance > ACCESS_POINT_MAX_DISTANCE_METERS:
        return None

    types = set(result.get('types', []))
    name = (result.get('name') or '').lower()

    if types & DISALLOWED_PLACE_TYPES:
        return None

    if any(regex.search(name) for regex in DISALLOWED_NAME_REGEXES):
        return None

    address_text = result.get('vicinity') or result.get('formatted_address', '')
    if county and address_text and not address_matches_county(address_text, county):
        return None

    reviews = result.get('user_ratings_total', 0) or 0
    rating = float(result.get('rating') or 0)
    if require_reviews and (reviews < ACCESS_POINT_MIN_REVIEWS or rating <= 0):
        return None

    type_match = bool(ALLOWED_ACCESS_TYPES & types)
    keyword_match = any(keyword in name for keyword in ACCESS_POINT_KEYWORDS)

    required_match = True
    if required_terms:
        required_terms_lower = [term.lower() for term in required_terms]
        type_str = ' '.join(t.lower() for t in types)
        required_match = any(term in name for term in required_terms_lower) or any(term in type_str for term in required_terms_lower)

    if required_terms and not required_match:
        return None

    if not (type_match or keyword_match):
        return None

    candidate = {
        'lat': Decimal(str(candidate_lat)),
        'lng': Decimal(str(candidate_lng)),
        'source': 'access_point',
        'access_point_type': stage_label,
        'place_id': result.get('place_id'),
        'place_name': result.get('name'),
        'vicinity': address_text,
        'distance_m': round(distance, 1),
        'search_query': query_label,
        'rating': rating,
        'user_ratings_total': reviews,
        'place_types': list(types)
    }

    return candidate


def _select_best_candidate(results: List[Dict], **kwargs) -> Optional[Dict]:
    best_candidate = None
    best_score = float('-inf')

    for result in results:
        candidate = _build_candidate_from_result(result, **kwargs)
        if not candidate:
            continue

        score = 0.0
        score += candidate.get('rating', 0) * 2
        score += min(candidate.get('user_ratings_total', 0) / 10.0, 5)
        score -= candidate['distance_m'] / 400.0

        if kwargs.get('required_terms'):
            score += 1.5

        if score > best_score:
            best_score = score
            best_candidate = candidate

    return best_candidate


def find_lake_access_point(lake_name: str, county: str, lake_coordinates: Optional[Dict]) -> Optional[Dict]:
    """Find an access point by prioritizing fishing piers, then boat launches, with review requirements."""
    if not lake_coordinates or not GOOGLE_PLACES_API_KEY:
        return None

    try:
        lake_lat = float(lake_coordinates['lat'])
        lake_lng = float(lake_coordinates['lng'])
    except (KeyError, ValueError, TypeError):
        return None

    name_variants = build_lake_name_variants(lake_name)

    stage_definitions = [
        {
            'mode': 'text',
            'suffixes': ['fishing pier', 'fishing dock'],
            'required_terms': ['pier', 'dock'],
            'label': 'fishing_pier'
        },
        {
            'mode': 'text',
            'suffixes': ['boat launch', 'boat ramp'],
            'required_terms': ['launch', 'ramp'],
            'label': 'boat_launch'
        },
        {
            'mode': 'nearby',
            'keywords': ['fishing pier', 'fishing dock', f"{lake_name} fishing pier"],
            'required_terms': ['pier', 'dock'],
            'radius': min(ACCESS_POINT_SEARCH_RADIUS_METERS, 4000),
            'label': 'fishing_pier'
        },
        {
            'mode': 'nearby',
            'keywords': ['boat launch', 'boat ramp', f"{lake_name} boat launch"],
            'required_terms': ['launch', 'ramp'],
            'radius': ACCESS_POINT_SEARCH_RADIUS_METERS,
            'label': 'boat_launch'
        },
        {
            'mode': 'nearby',
            'keywords': ['fishing access', 'lake parking'],
            'required_terms': None,
            'radius': ACCESS_POINT_SEARCH_RADIUS_METERS,
            'label': 'general_access'
        }
    ]

    # Stage 1/2: Text search for specific piers/launches that include reviews
    for stage in stage_definitions:
        if stage['mode'] == 'text':
            for variant in name_variants:
                for suffix in stage['suffixes']:
                    query = f"{variant} {suffix}".strip()
                    results = _places_text_search(query, place_type=None)
                    candidate = _select_best_candidate(
                        results,
                        lake_lat=lake_lat,
                        lake_lng=lake_lng,
                        required_terms=stage.get('required_terms'),
                        require_reviews=True,
                        query_label=query,
                        county=county,
                        stage_label=stage['label']
                    )
                    if candidate:
                        return candidate

    # Stage 3+: Nearby searches anchored at the lake center
    for stage in stage_definitions:
        if stage['mode'] != 'nearby':
            continue

        radius = stage.get('radius', ACCESS_POINT_SEARCH_RADIUS_METERS)
        for keyword in stage['keywords']:
            results = _places_nearby((lake_lat, lake_lng), keyword, radius)
            candidate = _select_best_candidate(
                results,
                lake_lat=lake_lat,
                lake_lng=lake_lng,
                required_terms=stage.get('required_terms'),
                require_reviews=True,
                query_label=keyword,
                county=county,
                stage_label=stage['label']
            )
            if candidate:
                return candidate

    return None


def scrape_trout_plants() -> List[Dict]:
    """
    Scrape WDFW trout stocking data
    
    Strategy:
    1. First try to parse page HTML directly
    2. If needed, use Playwright for dynamic loading
    
    Returns:
        List of stocking data
    """
    plants = []
    
    try:
        # Method 1: Direct page request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(WDFW_API_URL, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Parse HTML
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find data table
        table = soup.find('table')
        
        if table:
            rows = table.find_all('tr')[1:]  # Skip header
            
            for row in rows:
                cols = row.find_all('td')
                
                if len(cols) >= 6:
                    try:
                        # Extract lake name and county
                        lake_cell = cols[0]
                        lake_link = lake_cell.find('a')
                        lake_name = lake_link.text.strip() if lake_link else cols[0].text.strip()
                        lake_name = clean_lake_name(lake_name)
                        
                        # Extract county information
                        county_link = lake_cell.find_all('a')
                        county = county_link[1].text.strip() if len(county_link) > 1 else ""
                        
                        # Extract region
                        region_link = lake_cell.find_all('a')
                        region = region_link[2].text.strip().replace('Region ', '') if len(region_link) > 2 else ""
                        
                        stock_date = cols[1].text.strip()
                        species = cols[2].text.strip()
                        number = cols[3].text.strip().replace(',', '')
                        fish_per_pound = cols[4].text.strip()
                        hatchery = cols[5].text.strip()
                        
                        plant_data = {
                            'lake_name': lake_name,
                            'stock_date': stock_date,
                            'species': species,
                            'number': int(number) if number.isdigit() else 0,
                            'fish_per_pound': float(fish_per_pound) if fish_per_pound else 0.0,
                            'county': county,
                            'region': region,
                            'hatchery': hatchery
                        }
                        
                        plants.append(plant_data)
                        
                    except Exception as e:
                        print(f"Error parsing row data: {str(e)}")
                        continue
        
        print(f"Successfully scraped {len(plants)} records")
        
    except Exception as e:
        print(f"Scraping error: {str(e)}")
    
    return plants


def save_to_dynamodb(plants: List[Dict]) -> int:
    """
    Save data to DynamoDB
    
    Args:
        plants: List of stocking data
        
    Returns:
        Number of successfully saved records
    """
    saved_count = 0
    
    for plant in plants:
        try:
            # Get coordinates (if not already available)
            coordinates = geocode_lake(plant['lake_name'], plant.get('county', ''))
            access_point = find_lake_access_point(plant['lake_name'], plant.get('county', ''), coordinates)
            
            # Prepare DynamoDB item
            item = {
                'id': f"{plant['lake_name']}_{plant['stock_date']}_{plant['species']}",
                'lake_name': plant['lake_name'],
                'stock_date': plant['stock_date'],
                'species': plant['species'],
                'number': plant['number'],
                'fish_per_pound': Decimal(str(plant['fish_per_pound'])),
                'county': plant.get('county', ''),
                'region': plant.get('region', ''),
                'hatchery': plant.get('hatchery', ''),
                'timestamp': datetime.now().isoformat(),
            }
            
            # Add coordinates
            if access_point:
                item['coordinates'] = access_point
                item['coordinate_origin'] = access_point.get('source', 'access_point')
                if access_point.get('place_id'):
                    item['coordinate_place_id'] = access_point['place_id']
                if access_point.get('place_name'):
                    item['coordinate_place_name'] = access_point['place_name']
            elif coordinates:
                item['coordinates'] = coordinates
                item['coordinate_origin'] = coordinates.get('source', 'lake_center')

            # Save to DynamoDB
            table.put_item(Item=item)
            saved_count += 1
            
            # Avoid exceeding Google API quota limits
            if coordinates:
                time.sleep(0.1)
            
        except Exception as e:
            print(f"Error saving data for {plant['lake_name']}: {str(e)}")
            continue
    
    return saved_count


def lambda_handler(event, context):
    """
    Lambda main function
    
    Args:
        event: Lambda event object
        context: Lambda context object
        
    Returns:
        Response object
    """
    try:
        print("Starting trout stocking data scraping...")
        
        # Scrape data
        plants = scrape_trout_plants()
        
        if not plants:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'No new data found',
                    'records_scraped': 0,
                    'records_saved': 0
                })
            }
        
        # Save to DynamoDB
        saved_count = save_to_dynamodb(plants)
        
        print(f"Scraping complete: {len(plants)} records scraped, {saved_count} saved")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Scraping successful',
                'records_scraped': len(plants),
                'records_saved': saved_count
            })
        }
        
    except Exception as e:
        print(f"Lambda execution error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': f'Error: {str(e)}'
            })
        }


# Local testing
if __name__ == "__main__":
    result = lambda_handler({}, None)
    print(json.dumps(result, indent=2))
