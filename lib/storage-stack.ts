// lib/storage-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly sourceBucket: s3.Bucket;
  public readonly destBucket: s3.Bucket;
  public readonly backupTable: dynamodb.Table;

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

    // Outputs for other stacks to use
    new cdk.CfnOutput(this, 'SourceBucketName', {
      value: this.sourceBucket.bucketName,
      exportName: 'SourceBucketName',
    });

    new cdk.CfnOutput(this, 'DestBucketName', {
      value: this.destBucket.bucketName,
      exportName: 'DestBucketName',
    });

    new cdk.CfnOutput(this, 'BackupTableName', {
      value: this.backupTable.tableName,
      exportName: 'BackupTableName',
    });
  }
}