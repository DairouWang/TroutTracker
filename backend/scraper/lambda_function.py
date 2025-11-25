"""
TroutTracker Lambda Scraper Function
Scrapes trout stocking data from WDFW website and stores it in DynamoDB
"""
import json
import os
import boto3
import requests
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Optional
import time

# AWS client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'TroutStockingData')
table = dynamodb.Table(table_name)

# Google Geocoding API
GOOGLE_GEOCODING_API_KEY = os.environ.get('GOOGLE_GEOCODING_API_KEY', '')

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
    
    try:
        # Build search query - prioritize county, then state
        search_query = f"{lake_name}, {county} County, Washington State, USA" if county else f"{lake_name}, Washington State, USA"
        
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
                print(f"Geocoding result not in Washington State: {lake_name}")
                return None
            
            return {
                'lat': Decimal(str(location['lat'])),
                'lng': Decimal(str(location['lng']))
            }
        else:
            print(f"Geocoding failed: {lake_name} - {data.get('status', 'UNKNOWN')}")
            return None
            
    except Exception as e:
        print(f"Geocoding error {lake_name}: {str(e)}")
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
            if coordinates:
                item['coordinates'] = coordinates
            
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

