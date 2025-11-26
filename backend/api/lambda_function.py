"""
TroutTracker API Lambda Function
Provides REST API endpoints to query trout stocking data and feedback
"""
import json
import os
import boto3
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import uuid4
from boto3.dynamodb.conditions import Key, Attr

# AWS clients
dynamodb = boto3.resource('dynamodb')
STOCKING_TABLE_NAME = 'TroutTracker-StockingData'
table = dynamodb.Table(STOCKING_TABLE_NAME)
FEEDBACK_TABLE_NAME = 'TroutTracker-Feedback'
feedback_table = dynamodb.Table(FEEDBACK_TABLE_NAME)
ses_region = os.environ.get('SES_REGION', os.environ.get('AWS_REGION', 'us-west-2'))
ses_client = boto3.client('ses', region_name=ses_region)
lambda_client = boto3.client('lambda')
LAKE_MATCHER_FUNCTION_NAME = os.environ.get('LAKE_MATCHER_FUNCTION_NAME')


def invoke_lake_matcher(lake_name: str, county: Optional[str] = None) -> Optional[Dict]:
    """Invoke the Lake Matcher Lambda and return its payload."""
    if not lake_name or not LAKE_MATCHER_FUNCTION_NAME:
        return None

    try:
        payload = {'wdfwName': lake_name}
        if county:
            payload['county'] = county
        response = lambda_client.invoke(
            FunctionName=LAKE_MATCHER_FUNCTION_NAME,
            InvocationType='RequestResponse',
            Payload=json.dumps(payload)
        )
        payload_stream = response.get('Payload')
        if not payload_stream:
            return None
        raw_body = payload_stream.read()
        if hasattr(payload_stream, 'close'):
            payload_stream.close()
        if not raw_body:
            return None
        if isinstance(raw_body, (bytes, bytearray)):
            raw_body = raw_body.decode('utf-8')
        match_payload = json.loads(raw_body)
        if 'statusCode' in match_payload:
            status_code = match_payload.get('statusCode', 500)
            body = match_payload.get('body')
            if status_code != 200:
                print(f"[LakeMatcher] Invocation error for {lake_name}: status={status_code}")
                return None
            if isinstance(body, str):
                match_payload = json.loads(body)
            else:
                match_payload = body
        return match_payload
    except Exception as exc:
        print(f"[LakeMatcher] Invocation failed for {lake_name}: {exc}")
        return None


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
        # Calculate date range (date-only to avoid partial-day offsets)
        safe_days = max(1, days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=safe_days)

        # Scan table (in production, should use GSI for more efficient queries)
        response = table.scan()
        items = response.get('Items', [])
        
        # Handle pagination
        while 'LastEvaluatedKey' in response:
            response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
            items.extend(response.get('Items', []))
        
        # Parse stocking dates for filtering/sorting
        def parse_date(date_str):
            try:
                return datetime.strptime(date_str, '%b %d, %Y').date()
            except Exception:
                return None

        # Keep only records that fall inside the requested time range
        filtered_items = []
        for item in items:
            stock_date = parse_date(item.get('stock_date', ''))
            if stock_date and start_date <= stock_date <= end_date:
                filtered_items.append(item)

        # Sort by date (newest first); invalid dates fall to the end
        def sort_key(item):
            stock_date = parse_date(item.get('stock_date', ''))
            return stock_date or date(1900, 1, 1)

        filtered_items.sort(key=sort_key, reverse=True)
        
        return filtered_items
        
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
            # Return the most recent record - convert date string to datetime for proper sorting
            def parse_date(date_str):
                try:
                    return datetime.strptime(date_str, '%b %d, %Y')
                except:
                    return datetime(1900, 1, 1)
            
            items.sort(key=lambda x: parse_date(x.get('stock_date', '')), reverse=True)
            return items[0]
        
        return None
        
    except Exception as e:
        print(f"Error querying lake data: {str(e)}")
        raise


def get_statistics(days: int = 30) -> Dict:
    """
    Get statistics

    Returns:
        Dictionary of statistics
    """
    try:
        safe_days = max(1, days)
        items = get_trout_plants(days=safe_days)

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


def send_feedback(name: str, email: str, message: str, to_email: str) -> Dict:
    """
    Send feedback email using AWS SES

    Args:
        name: Sender name
        email: Sender email
        message: Feedback message
        to_email: Recipient email address

    Returns:
        Dictionary with send status
    """
    try:
        subject = f"TroutTracker Feedback from {name or 'Anonymous'}"
        body_text = f"""
TroutTracker Feedback

From: {name or 'Not provided'}
Email: {email}
Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Message:
{message}
"""

        body_html = f"""
<html>
<head></head>
<body>
  <h2>TroutTracker Feedback</h2>
  <p><strong>From:</strong> {name or 'Not provided'}</p>
  <p><strong>Email:</strong> {email}</p>
  <p><strong>Date:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
  <hr>
  <p><strong>Message:</strong></p>
  <p>{message.replace(chr(10), '<br>')}</p>
</body>
</html>
"""

        response = ses_client.send_email(
            Source=to_email,  # Must be verified in SES
            Destination={
                'ToAddresses': [to_email]
            },
            Message={
                'Subject': {
                    'Data': subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Text': {
                        'Data': body_text,
                        'Charset': 'UTF-8'
                    },
                    'Html': {
                        'Data': body_html,
                        'Charset': 'UTF-8'
                    }
                }
            },
            ReplyToAddresses=[email] if email else []
        )

        return {
            'success': True,
            'message_id': response['MessageId']
        }

    except Exception as e:
        print(f"Error sending feedback: {str(e)}")
        raise


def save_feedback(name: str, email: str, message: str, to_email: str) -> Dict:
    """Persist feedback to DynamoDB for record-keeping."""
    if not feedback_table:
        raise Exception('Feedback table is not configured')

    item = {
        'id': str(uuid4()),
        'name': name or 'Anonymous',
        'email': email,
        'message': message,
        'to_email': to_email,
        'created_at': datetime.utcnow().isoformat()
    }

    try:
        feedback_table.put_item(Item=item)
        return item
    except Exception as e:
        print(f"Error saving feedback: {str(e)}")
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
            days = int(query_params.get('days', '30'))
            stats = get_statistics(days)

            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps(stats, cls=DecimalEncoder)
            }

        elif path == '/match-lake' and http_method in ('GET', 'POST'):
            if not LAKE_MATCHER_FUNCTION_NAME:
                return {
                    'statusCode': 503,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({'message': 'Lake matcher is not configured'})
                }

            requested_name = None
            requested_county = None
            if http_method == 'GET':
                requested_name = (query_params.get('wdfwName') or query_params.get('name') or '').strip()
                requested_county = (query_params.get('county') or '').strip()
            else:
                try:
                    body = json.loads(event.get('body', '{}'))
                except json.JSONDecodeError:
                    body = {}
                requested_name = (body.get('wdfwName') or body.get('name') or '').strip()
                requested_county = (body.get('county') or '').strip()

            if not requested_name:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({'message': 'wdfwName parameter is required'})
                }

            match_result = invoke_lake_matcher(requested_name, requested_county or None)
            if match_result is None:
                return {
                    'statusCode': 502,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({'message': 'Lake matcher invocation failed'})
                }

            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps(match_result)
            }

        elif path == '/feedback' and http_method == 'POST':
            # Send feedback
            try:
                body = json.loads(event.get('body', '{}'))
                name = body.get('name', '')
                email = body.get('email', '')
                message = body.get('message', '')
                to_email = body.get('to', 'trouttrackerinfo@gmail.com')
                print(f"[Feedback] Payload received: name={name}, email={email}, message_len={len(message)}, to={to_email}")
                print(f"[Feedback] Using feedback table: {FEEDBACK_TABLE_NAME}")

                if not email or not message:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        'body': json.dumps({'message': 'Email and message are required'})
                    }

                saved = save_feedback(name, email, message, to_email)
                print(f"[Feedback] Saved record id: {saved['id']}")
                result = send_feedback(name, email, message, to_email)
                print(f"[Feedback] Email sent, SES message id: {result['message_id']}")

                return {
                    'statusCode': 200,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'message': 'Feedback sent successfully',
                        'message_id': result['message_id'],
                        'record_id': saved['id']
                    })
                }
            except Exception as e:
                print(f"Feedback error: {str(e)}")
                return {
                    'statusCode': 500,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({'message': f'Failed to send feedback: {str(e)}'})
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
