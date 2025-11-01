// lib/replicator-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import * as path from 'path';

interface ReplicatorStackProps extends cdk.StackProps {
  sourceBucket: s3.IBucket;
  destBucket: s3.IBucket;
  backupTable: dynamodb.ITable;
}

export class ReplicatorStack extends cdk.Stack {
  public readonly replicatorFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ReplicatorStackProps) {
    super(scope, id, props);

    // Replicator Lambda Function
    this.replicatorFunction = new lambda.Function(this, 'ReplicatorFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'replicator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/replicator')),
      timeout: cdk.Duration.seconds(60),
      environment: {
        SOURCE_BUCKET: props.sourceBucket.bucketName,
        DEST_BUCKET: props.destBucket.bucketName,
        BACKUP_TABLE: props.backupTable.tableName
      },
    });

    // Grant permissions
    props.sourceBucket.grantRead(this.replicatorFunction);
    props.destBucket.grantReadWrite(this.replicatorFunction);
    props.backupTable.grantReadWriteData(this.replicatorFunction);

    // EventBridge Rule for S3 events (PUT and DELETE)
    const s3Rule = new events.Rule(this, 'S3EventRule', {
      ruleName: 'BackupS3EventRule',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created', 'Object Deleted'],
        detail: {
          bucket: {
            name: [props.sourceBucket.bucketName],
          },
        },
      },
    });

    s3Rule.addTarget(new targets.LambdaFunction(this.replicatorFunction));

    // Output
    new cdk.CfnOutput(this, 'ReplicatorFunctionName', {
      value: this.replicatorFunction.functionName,
    });
  }
}