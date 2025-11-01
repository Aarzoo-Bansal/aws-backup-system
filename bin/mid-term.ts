#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { CleanerStack } from '../lib/cleaner-stack';
import { ReplicatorStack } from '../lib/replicator-stack';
import { StorageStack } from '../lib/storage-stack';


const app = new cdk.App();


const storageStack = new StorageStack(app, 'BackupStorageStack', {
  description: 'S3 buckets and DynamoDB table for backup system'
});

const replicatorStack = new ReplicatorStack(app, 'BackupReplicatorStack', {
  description: 'Lambda function to replicate objects from the source to the destination',
  sourceBucket: storageStack.sourceBucket,
  destBucket: storageStack.destBucket,
  backupTable: storageStack.backupTable
});

const cleanerStack = new CleanerStack(app, 'BackupCleanerStack', {
  description: 'Lambda function to clean up the disowned backup copies',
  destBucket: storageStack.destBucket,
  backupTable: storageStack.backupTable
});

cleanerStack.addDependency(storageStack);

app.synth();
