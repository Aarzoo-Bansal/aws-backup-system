# lambda/replicator/replicator.py
import boto3
import os
import json
from datetime import datetime
from decimal import Decimal

# creating clients
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# fetching the values of data from enviornment variables
SOURCE_BUCKET = os.environ['SOURCE_BUCKET']
DEST_BUCKET = os.environ['DEST_BUCKET']
BACKUP_TABLE = os.environ['BACKUP_TABLE']

# getting the table object from the table name
table = dynamodb.Table(BACKUP_TABLE)

# starting function which is called when the lambda runs
def handler(event, context):
    print(f"Received the following event: {json.dumps(event)}")
    
    # Extract event details
    detail = event.get('detail', {})
    event_name = event.get('detail-type', '')
    
    # Get object key
    object_key = detail.get('object', {}).get('key', '')
    
    if not object_key:
        print("No object key found in event")
        return {'statusCode': 400, 'body': 'No object key'}
    
    print(f"Processing {event_name} for object: {object_key}")
    
    # if we have received a PUT request
    if 'Created' in event_name:
        handle_put_event(object_key)
    # if we received a delete request
    elif 'Deleted' in event_name:
        handle_delete_event(object_key)
    
    return {'statusCode': 200, 'body': 'Success'}

def handle_put_event(source_object):
    """Handle PUT event - create backup copy and manage version limit"""
    
    # Generate unique copy name with timestamp
    timestamp = datetime.utcnow().isoformat()
    copy_name = f"{source_object}-{timestamp.replace(':', '-').replace('.', '-')}"
    
    print(f"Creating copy: {copy_name}")
    
    # Copy object from source to destination
    try:
        s3.copy_object(
            CopySource={'Bucket': SOURCE_BUCKET, 'Key': source_object},
            Bucket=DEST_BUCKET,
            Key=copy_name
        )
        print(f"Successfully copied to {DEST_BUCKET}/{copy_name}")
    except Exception as e:
        print(f"Error copying object: {e}")
        raise
    
    # Add entry to DynamoDB
    try:
        table.put_item(
            Item={
                'source_object': source_object,
                'copy_timestamp': timestamp,
                'copy_name': copy_name,
                'status': 'active'
            }
        )
        print(f"Added DynamoDB entry for {copy_name}")
    except Exception as e:
        print(f"Error adding to DynamoDB: {e}")
        raise
    
    # Check if we have more than 3 copies and delete oldest if needed
    manage_copy_limit(source_object)

def manage_copy_limit(source_object):
    """Ensure only 3 most recent copies exist, delete oldest if more"""
    
    try:
        # Query all active copies for this source object, sorted by timestamp
        response = table.query(
            KeyConditionExpression='source_object = :obj',
            FilterExpression='#status = :active',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':obj': source_object,
                ':active': 'active'
            },
            ScanIndexForward=True  # Sort ascending (oldest first)
        )
        
        items = response.get('Items', [])
        print(f"Found {len(items)} active copies for {source_object}")
        
        # If more than 3 copies, delete the oldest ones
        if len(items) > 3:
            copies_to_delete = items[:-3]  # Keep last 3, delete the rest
            
            for item in copies_to_delete:
                copy_name = item['copy_name']
                print(f"Deleting oldest copy: {copy_name}")
                
                # Delete from S3
                s3.delete_object(Bucket=DEST_BUCKET, Key=copy_name)
                
                # Delete from DynamoDB
                table.delete_item(
                    Key={
                        'source_object': item['source_object'],
                        'copy_timestamp': item['copy_timestamp']
                    }
                )
                print(f"Deleted {copy_name}")
                
    except Exception as e:
        print(f"Error managing copy limit: {e}")
        raise

def handle_delete_event(source_object):
    """Handle DELETE event - mark copies as disowned"""
    
    print(f"Marking copies of {source_object} as disowned")
    
    try:
        # Query all active copies for this source object
        response = table.query(
            KeyConditionExpression='source_object = :obj',
            FilterExpression='#status = :active',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':obj': source_object,
                ':active': 'active'
            }
        )
        
        items = response.get('Items', [])
        print(f"Found {len(items)} active copies to mark as disowned")
        
        # Mark each copy as disowned
        disowned_time = datetime.utcnow().isoformat()
        
        for item in items:
            table.update_item(
                Key={
                    'source_object': item['source_object'],
                    'copy_timestamp': item['copy_timestamp']
                },
                UpdateExpression='SET #status = :disowned, disowned_at = :time',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':disowned': 'disowned',
                    ':time': disowned_time
                }
            )
            print(f"Marked {item['copy_name']} as disowned")
            
    except Exception as e:
        print(f"Error marking copies as disowned: {e}")
        raise