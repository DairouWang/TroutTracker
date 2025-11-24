"""
TroutTracker API Lambda Function
Provides REST API endpoints to query trout stocking data
"""
import json
import os
import boto3
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from boto3.dynamodb.conditions import Key, Attr

# AWS client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'TroutStockingData')
table = dynamodb.Table(table_name)


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Decimal types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def get_trout_plants(state: str = 'WA', days: int = 30) -> List[Dict]:
    """
    Get trout stocking data from DynamoDB
    
    Args:
        state: State code (currently only supports WA)
        days: Get data from the last N days
        
    Returns:
        List of stocking data
    """
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        start_date_str = start_date.strftime('%b %d, %Y')
        
        # Scan table (in production, should use GSI for more efficient queries)
        response = table.scan()
        items = response.get('Items', [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))
        
        # Sort by date (newest first)
        items.sort(key=lambda x: x.get('stock_date', ''), reverse=True)
        
        return items
        
    except Exception as e:
        print(f"Error querying data: {str(e)}")
        raise


def get_lake_by_name(lake_name: str) -> Optional[Dict]:
    """
    Query data by lake name
    
    Args:
        lake_name: Lake name
        
    Returns:
        Lake data or None
    """
    try:
        response = table.scan(
            FilterExpression=Attr('lake_name').eq(lake_name)
        )
        
        items = response.get('Items', [])
        
        if items:
            # Return the most recent record
            items.sort(key=lambda x: x.get('stock_date', ''), reverse=True)
            return items[0]
        
        return None
        
    except Exception as e:
        print(f"Error querying lake data: {str(e)}")
        raise


def get_statistics() -> Dict:
    """
    Get statistics
    
    Returns:
        Dictionary of statistics
    """
    try:
        response = table.scan()
        items = response.get('Items', [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))
        
        # Calculate statistics
        total_records = len(items)
        unique_lakes = len(set(item['lake_name'] for item in items))
        species_count = {}
        total_fish = 0
        
        for item in items:
            species = item.get('species', 'Unknown')
            species_count[species] = species_count.get(species, 0) + 1
            total_fish += item.get('number', 0)
        
        return {
            'total_records': total_records,
            'unique_lakes': unique_lakes,
            'total_fish_stocked': total_fish,
            'species_breakdown': species_count,
            'last_updated': datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Error getting statistics: {str(e)}")
        raise


def lambda_handler(event, context):
    """
    Lambda main function - API Gateway integration
    
    Args:
        event: API Gateway event object
        context: Lambda context object
        
    Returns:
        API Gateway response object
    """
    try:
        # Parse request
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '/trout')
        query_params = event.get('queryStringParameters', {}) or {}
        
        # CORS preflight request
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                'body': ''
            }
        
        # Route handling
        if path == '/trout' and http_method == 'GET':
            # Get query parameters
            state = query_params.get('state', 'WA')
            days = int(query_params.get('days', '30'))
            lake_name = query_params.get('lake')
            
            # If lake name is specified
            if lake_name:
                data = get_lake_by_name(lake_name)
                response_data = {'data': [data] if data else []}
            else:
                data = get_trout_plants(state, days)
                response_data = {'data': data}
            
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps(response_data, cls=DecimalEncoder)
            }
        
        elif path == '/trout/stats' and http_method == 'GET':
            # Get statistics
            stats = get_statistics()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps(stats, cls=DecimalEncoder)
            }
        
        else:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'message': 'Path not found'})
            }
        
    except Exception as e:
        print(f"API error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'message': f'Server error: {str(e)}'
            })
        }


# Local testing
if __name__ == "__main__":
    # Simulate API Gateway event
    test_event = {
        'httpMethod': 'GET',
        'path': '/trout',
        'queryStringParameters': {
            'state': 'WA',
            'days': '30'
        }
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2))

