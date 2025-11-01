// lib/storage-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly sourceBucket: s3.Bucket;
  public readonly destBucket: s3.Bucket;
  public readonly backupTable: dynamodb.Table;
  public readonly indexName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Source S3 Bucket
    this.sourceBucket = new s3.Bucket(this, 'SourceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      eventBridgeEnabled: true, // Enable EventBridge notifications
    });

    // Destination S3 Bucket
    this.destBucket = new s3.Bucket(this, 'DestinationBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
    });

    // DynamoDB Table
    // Partition key = source object
    // Sort Key = time
    this.backupTable = new dynamodb.Table(this, 'BackupTable', {
      partitionKey: {
        name: 'source_object',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'copy_timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Global Secondary Index for Cleaner to query disowned items
    // Partition Key: Status
    // Sort Key: time
    this.indexName = 'DisownedIndex'
    this.backupTable.addGlobalSecondaryIndex({
      indexName: 'DisownedIndex',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'disowned_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    /************************************************************************************************************/
    // Exporting the source bucket name so that it is visible to other stacks.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      value: this.sourceBucket.bucketName,
      exportName: 'SourceBucketName', // This value will be used by other stacks to get the source bucket name
    });

    // Exporting the name of the destination bucket
    new cdk.CfnOutput(this, 'DestBucketName', {
      value: this.destBucket.bucketName,
      exportName: 'DestBucketName', 
    });

    // Exporting the name of the DynamoDb Table
    new cdk.CfnOutput(this, 'BackupTableName', {
      value: this.backupTable.tableName,
      exportName: 'BackupTableName',
    });

    // Exporting the name of the index
    new cdk.CfnOutput(this, 'IndexName', {
        value: this.indexName,
        exportName: 'IndexName'
    })
  }


}