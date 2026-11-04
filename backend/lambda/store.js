/*
  Persistence for saved analyses.

  Production uses DynamoDB. Local runs and unit tests leave TABLE_NAME unset
  and use the in-memory map so the handler can be exercised without AWS.

  Table shape:
    pk  id            share-link lookup (GetItem)
    gsi visitorId + createdAt    a visitor's recent comparisons (Query, newest first)

  One entity and two access patterns. A partition key plus one GSI covers both,
  so this is not a single-table design.
*/

const memoryItems = new Map();
const TTL_SECONDS = 365 * 24 * 60 * 60;

function tableName() {
  return process.env.TABLE_NAME || "";
}

function visitorIndex() {
  return process.env.VISITOR_INDEX || "byVisitor";
}

function resetStoreForTests() {
  memoryItems.clear();
}

let dynamoPromise;
function dynamo() {
  if (!dynamoPromise) {
    dynamoPromise = (async () => {
      const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
      const {
        DynamoDBDocumentClient,
        PutCommand,
        GetCommand,
        QueryCommand,
      } = require("@aws-sdk/lib-dynamodb");
      const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true },
      });
      return { doc, PutCommand, GetCommand, QueryCommand };
    })();
  }
  return dynamoPromise;
}

async function putAnalysis(item) {
  item.ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  if (!tableName()) {
    memoryItems.set(item.id, item);
    return;
  }
  const { doc, PutCommand } = await dynamo();
  await doc.send(new PutCommand({ TableName: tableName(), Item: item }));
}

async function getAnalysis(id) {
  if (!tableName()) return memoryItems.get(id) || null;
  const { doc, GetCommand } = await dynamo();
  const out = await doc.send(new GetCommand({ TableName: tableName(), Key: { id } }));
  return out.Item || null;
}

async function listByVisitor(visitorId, limit) {
  if (!tableName()) {
    return [...memoryItems.values()]
      .filter((item) => item.visitorId === visitorId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  const { doc, QueryCommand } = await dynamo();
  const out = await doc.send(new QueryCommand({
    TableName: tableName(),
    IndexName: visitorIndex(),
    KeyConditionExpression: "visitorId = :visitorId",
    ExpressionAttributeValues: { ":visitorId": visitorId },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return out.Items || [];
}

module.exports = { putAnalysis, getAnalysis, listByVisitor, resetStoreForTests };
