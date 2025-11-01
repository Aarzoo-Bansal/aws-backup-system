// lib/cleaner-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import * as path from 'path';

interface CleanerStackProps extends cdk.StackProps {
  destBucket: s3.IBucket;
  backupTable: dynamodb.ITable;
  indexName: string;
}

export class CleanerStack extends cdk.Stack {
  public readonly cleanerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: CleanerStackProps) {
    super(scope, id, props);

    // Cleaner Lambda Function
    this.cleanerFunction = new lambda.Function(this, 'CleanerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'cleaner.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/cleaner')),
      timeout: cdk.Duration.seconds(60),
      environment: {
        DEST_BUCKET: props.destBucket.bucketName,
        BACKUP_TABLE: props.backupTable.tableName,
        INDEX_NAME: props.indexName
      },
    });

    // Grant permissions
    props.destBucket.grantDelete(this.cleanerFunction);
    props.backupTable.grantReadWriteData(this.cleanerFunction);

    // EventBridge Rule - Run every 1 minute
    const cleanerRule = new events.Rule(this, 'CleanerScheduleRule', {
      ruleName: 'BackupCleanerSchedule',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });

    cleanerRule.addTarget(new targets.LambdaFunction(this.cleanerFunction));

    // Output
    new cdk.CfnOutput(this, 'CleanerFunctionName', {
      value: this.cleanerFunction.functionName,
    });
  }
}