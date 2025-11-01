# lambda/cleaner/cleaner.py
import boto3
import os
import json
from datetime import datetime, timedelta

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

DEST_BUCKET = os.environ['DEST_BUCKET']
BACKUP_TABLE = os.environ['BACKUP_TABLE']
INDEX_NAME = os.environ['INDEX_NAME']

table = dynamodb.Table(BACKUP_TABLE)

def handler(event, context):
    print(f"Cleaner triggered at {datetime.utcnow().isoformat()}")
    
    # Calculate cutoff time (10 seconds ago)
    cutoff_time = datetime.utcnow() - timedelta(seconds=10)
    cutoff_time_str = cutoff_time.isoformat()
    
    print(f"Looking for items disowned before: {cutoff_time_str}")
    
    try:
        # Query the GSI to find disowned items older than 10 seconds
        response = table.query(
            IndexName=INDEX_NAME,
            KeyConditionExpression='#status = :disowned AND disowned_at < :cutoff',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':disowned': 'disowned',
                ':cutoff': cutoff_time_str
            }
        )
        
        items = response.get('Items', [])
        print(f"Found {len(items)} items to clean up")
        
        # Delete each disowned copy
        for item in items:
            copy_name = item['copy_name']
            source_object = item['source_object']
            copy_timestamp = item['copy_timestamp']
            
            print(f"Deleting copy: {copy_name}")
            
            # Delete from S3
            try:
                s3.delete_object(Bucket=DEST_BUCKET, Key=copy_name)
                print(f"Deleted {copy_name} from S3")
            except Exception as e:
                print(f"Error deleting from S3: {e}")
            
            # Delete from DynamoDB
            try:
                table.delete_item(
                    Key={
                        'source_object': source_object,
                        'copy_timestamp': copy_timestamp
                    }
                )
                print(f"Deleted {copy_name} from DynamoDB")
            except Exception as e:
                print(f"Error deleting from DynamoDB: {e}")
        
        print(f"Cleanup complete. Deleted {len(items)} items.")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Successfully cleaned up {len(items)} disowned copies'
            })
        }
        
    except Exception as e:
        print(f"Error during cleanup: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': f'Error: {str(e)}'
            })
        }