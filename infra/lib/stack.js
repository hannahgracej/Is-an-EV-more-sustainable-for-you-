/*
  One stack for the whole product.

  Browser  ->  CloudFront
                 |-- default  ->  private S3 bucket (the existing HTML/CSS/JS)
                 |-- /api/*   ->  HTTP API  ->  Lambda  ->  DynamoDB

  CloudFront strips the /api prefix and keeps the viewer on one origin, so the
  production site does not need a CORS preflight. The bucket is not public;
  CloudFront reads it with origin access control.
*/

const path = require("path");
const cdk = require("aws-cdk-lib");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const lambda = require("aws-cdk-lib/aws-lambda");
const logs = require("aws-cdk-lib/aws-logs");
const apigwv2 = require("aws-cdk-lib/aws-apigatewayv2");
const integrations = require("aws-cdk-lib/aws-apigatewayv2-integrations");
const s3 = require("aws-cdk-lib/aws-s3");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const s3deploy = require("aws-cdk-lib/aws-s3-deployment");

const ROOT = path.join(__dirname, "../..");

class EvCompareStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, "Analyses", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    table.addGlobalSecondaryIndex({
      indexName: "byVisitor",
      partitionKey: { name: "visitorId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const apiLogs = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const apiFn = new lambda.Function(this, "Api", {
      description: "Validates inputs, runs the EV comparison, and stores the result",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "backend/lambda/index.handler",
      code: lambda.Code.fromAsset(ROOT, {
        exclude: lambdaExclude(),
      }),
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      logGroup: apiLogs,
      environment: {
        TABLE_NAME: table.tableName,
        VISITOR_INDEX: "byVisitor",
        FACTORS_VERSION: "2026.1",
      },
    });
    table.grant(apiFn, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");

    const integration = new integrations.HttpLambdaIntegration("ApiIntegration", apiFn);
    const httpApi = new apigwv2.HttpApi(this, "HttpApi");
    const routes = [
      { path: "/health", methods: [apigwv2.HttpMethod.GET] },
      { path: "/reference", methods: [apigwv2.HttpMethod.GET] },
      { path: "/analyses", methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST] },
      { path: "/suggestions", methods: [apigwv2.HttpMethod.POST] },
      { path: "/analyses/{id}", methods: [apigwv2.HttpMethod.GET] },
      { path: "/{proxy+}", methods: [apigwv2.HttpMethod.OPTIONS] },
    ];
    for (const route of routes) {
      httpApi.addRoutes({ path: route.path, methods: route.methods, integration });
    }

    const stage = httpApi.defaultStage.node.defaultChild;
    stage.defaultRouteSettings = {
      throttlingBurstLimit: 20,
      throttlingRateLimit: 10,
    };

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const stripApiPrefix = new cloudfront.Function(this, "StripApiPrefix", {
      comment: "Browser calls /api/analyses; API Gateway routes are /analyses",
      code: cloudfront.FunctionCode.fromInline([
        "function handler(event) {",
        "  var request = event.request;",
        "  if (request.uri.indexOf('/api/') === 0) {",
        "    request.uri = request.uri.substring(4) || '/';",
        "  }",
        "  return request;",
        "}",
      ].join("\n")),
    });

    const distribution = new cloudfront.Distribution(this, "Site", {
      comment: "EV sustainability comparison",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(`${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [{
            function: stripApiPrefix,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          }],
        },
      },
    });

    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [s3deploy.Source.asset(ROOT, { exclude: siteExclude() })],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    new cdk.CfnOutput(this, "SiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "ApiUrl", {
      value: httpApi.url,
    });
    new cdk.CfnOutput(this, "TableName", {
      value: table.tableName,
    });
  }
}

function lambdaExclude() {
  return [
    "infra",
    "infra/**",
    ".git",
    ".git/**",
    ".github",
    ".github/**",
    "node_modules",
    "node_modules/**",
    "cdk.out",
    "cdk.out/**",
    "README.md",
    "index.html",
    "style.css",
    "app.js",
    "chart.js",
    "config.js",
    "package.json",
    ".gitignore",
    "backend/local-server.js",
    "backend/test",
    "backend/test/**",
  ];
}

function siteExclude() {
  return [
    "infra",
    "infra/**",
    "backend",
    "backend/**",
    ".git",
    ".git/**",
    ".github",
    ".github/**",
    "node_modules",
    "node_modules/**",
    "cdk.out",
    "cdk.out/**",
    "README.md",
    "package.json",
    "package-lock.json",
    ".gitignore",
  ];
}

module.exports = { EvCompareStack };
