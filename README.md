# Object Backup System

An AWS-based backup system that automatically replicates S3 objects with version control and automated cleanup.

## Architecture Overview

### Components

1. **Storage Stack**: S3 buckets and DynamoDB table
2. **Replicator Stack**: Lambda function triggered by S3 events
3. **Cleaner Stack**: Lambda function scheduled to run every minute

### DynamoDB Schema (No Scan Required!)

**Primary Table:**
- **Partition Key**: `source_object` (source file name)
- **Sort Key**: `copy_timestamp` (ISO 8601 timestamp)
- **Attributes**: 
  - `copy_name`: Name of backup copy in destination bucket
  - `status`: "active" or "disowned"
  - `disowned_at`: Timestamp when marked for deletion (optional)

**Global Secondary Index (DisownedIndex):**
- **Partition Key**: `status`
- **Sort Key**: `disowned_at`
- Used by Cleaner to efficiently find disowned items older than 10 seconds

## Project Structure

```
backup-system/
├── bin/
│   └── backup-system.ts          # CDK app entry point
├── lib/
│   ├── storage-stack.ts          # S3 + DynamoDB
│   ├── replicator-stack.ts       # Replicator Lambda + EventBridge
│   └── cleaner-stack.ts          # Cleaner Lambda + Schedule
├── lambda/
│   ├── replicator/
│   │   └── replicator.py         # Handles PUT/DELETE events
│   └── cleaner/
│       └── cleaner.py            # Cleans up disowned copies
├── package.json
├── tsconfig.json
├── cdk.json
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- Python 3.11
- AWS CLI configured with appropriate credentials
- AWS CDK CLI: `npm install -g aws-cdk`


## How It Works

### Replicator Lambda

**On PUT Event:**
1. Receives S3 Object Created event from EventBridge
2. Copies object to destination bucket with timestamp suffix
3. Adds record to DynamoDB with status="active"
4. Queries DynamoDB to count active copies
5. If >3 copies exist, deletes oldest from S3 and DynamoDB

**On DELETE Event:**
1. Receives S3 Object Deleted event from EventBridge
2. Queries DynamoDB for all active copies of the deleted object
3. Updates status to "disowned" and sets `disowned_at` timestamp
4. Does NOT delete copies immediately

### Cleaner Lambda

**On Schedule (Every Minute):**
1. Queries DisownedIndex GSI for `status="disowned"` AND `disowned_at < (now - 10 seconds)`
2. Deletes matching copies from S3
3. Deletes records from DynamoDB
4. Logs cleanup results

## Key Features

✅ **No Scan Operations**: Uses Query on primary key and GSI
✅ **Version Control**: Maintains up to 3 most recent copies
✅ **Graceful Deletion**: 10-second grace period before cleanup
✅ **Event-Driven**: Automated replication via EventBridge
✅ **Infrastructure as Code**: Complete CDK deployment

## Cleanup

To destroy all resources:

```bash
cdk destroy --all
```
**Note: All the resources were created and named automatically by CDK**

## Quick Demo Reference

### Pre-Demo Checklist
- [ ] All 3 stacks deployed successfully
- [ ] CloudFormation shows CREATE_COMPLETE
- [ ] Have Assignment1.txt and Assignment2.txt files ready
- [ ] Know your source/destination bucket names
- [ ] Have 5 browser tabs open (CloudFormation, S3 source, S3 dest, DynamoDB, Lambda)

### Demo Flow Summary
1. **Show stacks** in CloudFormation (3 stacks, all CREATE_COMPLETE)
2. **Show resources** in each stack
3. **Upload Assignment1.txt** → Verify 1 copy in dest + 1 DDB record
4. **Upload Assignment2.txt** → Verify 2 copies + 2 DDB records  
5. **Re-upload Assignment1.txt 3 times** → Verify only 3 copies remain
6. **Delete Assignment1.txt** → Wait 10s → Invoke Cleaner → All copies gone
7. **Repeat for Assignment2.txt**

## License

MIT