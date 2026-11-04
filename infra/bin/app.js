#!/usr/bin/env node
const cdk = require("aws-cdk-lib");
const { EvCompareStack } = require("../lib/stack");

const app = new cdk.App();

new EvCompareStack(app, "EvCompare", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-west-2",
  },
  description: "EV comparison site: CloudFront, S3, API Gateway, Lambda, DynamoDB",
});
