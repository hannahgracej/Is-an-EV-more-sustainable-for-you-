const test = require("node:test");
const assert = require("node:assert/strict");

delete process.env.TABLE_NAME;

const { handler, resetStoreForTests } = require("../lambda/index.js");
const { runComparison } = require("../../calc.js");

const visitor = "visitor-test-001";
const otherVisitor = "visitor-test-002";

const inputs = {
  visitorId: visitor,
  curFuel: "gasoline",
  curYear: 2018,
  curSize: "suv",
  curMPG: 22,
  curMilesPerYear: 12000,
  curAgeOwned: 5,
  evModel: "Chevrolet Bolt EV",
  evMilesPerYear: 12000,
  evYears: 10,
  gridMix: "california",
  gasPrice: 3.5,
  evPrice: 27495,
  elecPrice: 0.27,
  tradeIn: 8000,
  federalCredit: 7500,
  stateCredit: 7500,
};

function event({ method, path, body, query }) {
  return {
    rawPath: path,
    queryStringParameters: query || null,
    body: body === undefined ? null : JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: { http: { method }, requestId: "test" },
  };
}

test.beforeEach(() => {
  resetStoreForTests();
});

test("saved analysis matches the shared calculation engine", async () => {
  const response = await handler(event({ method: "POST", path: "/analyses", body: inputs }));
  assert.equal(response.statusCode, 201);
  const saved = JSON.parse(response.body);

  const { visitorId, ...calcInputs } = inputs;
  assert.deepEqual(saved.result, runComparison(calcInputs));
  assert.equal(saved.factorsVersion, "2026.1");
  assert.equal(saved.summary.evModel, "Chevrolet Bolt EV");
  assert.equal(saved.summary.comparisonYears, 10);
  assert.equal(typeof saved.id, "string");

  const fetched = await handler(event({ method: "GET", path: `/analyses/${saved.id}` }));
  assert.equal(fetched.statusCode, 200);
  assert.equal(JSON.parse(fetched.body).id, saved.id);

  const listed = await handler(event({
    method: "GET",
    path: "/analyses",
    query: { visitorId: visitor },
  }));
  const analyses = JSON.parse(listed.body).analyses;
  assert.equal(analyses.length, 1);
  assert.equal(analyses[0].id, saved.id);
  assert.equal(analyses[0].result, undefined);
  assert.equal(analyses[0].carbonSavings, saved.result.savings);
});

test("a visitor list does not include someone else's analyses", async () => {
  await handler(event({ method: "POST", path: "/analyses", body: inputs }));
  const listed = await handler(event({
    method: "GET",
    path: "/api/analyses",
    query: { visitorId: otherVisitor },
  }));
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(JSON.parse(listed.body).analyses, []);
});

test("unknown models and missing visitors are rejected", async () => {
  const badModel = await handler(event({
    method: "POST",
    path: "/analyses",
    body: { ...inputs, evModel: "Not A Car" },
  }));
  assert.equal(badModel.statusCode, 400);
  assert.equal(JSON.parse(badModel.body).fields.evModel, "is not in the catalog");

  const missing = await handler(event({ method: "GET", path: "/analyses" }));
  assert.equal(missing.statusCode, 400);
});

test("unknown ids return 404 and the catalog is served", async () => {
  const missing = await handler(event({
    method: "GET",
    path: "/analyses/00000000-0000-4000-8000-000000000000",
  }));
  assert.equal(missing.statusCode, 404);

  const reference = await handler(event({ method: "GET", path: "/reference" }));
  assert.equal(reference.statusCode, 200);
  const catalog = JSON.parse(reference.body);
  assert.ok(catalog.models.some((model) => model.name === "Chevrolet Bolt EV"));
  assert.ok(catalog.grids.includes("california"));
  assert.equal(catalog.factorsVersion, "2026.1");
});

test("suggestions are three different models for carbon, cost, and both", async () => {
  const { evModel, visitorId, ...base } = inputs;
  const response = await handler(event({ method: "POST", path: "/suggestions", body: base }));
  assert.equal(response.statusCode, 200);
  const suggestions = JSON.parse(response.body).suggestions;
  assert.equal(suggestions.length, 3);
  assert.equal(new Set(suggestions.map((item) => item.name)).size, 3);
  assert.equal(suggestions[0].category, "carbon");
  assert.equal(suggestions[0].name, "Nissan Leaf S");
  assert.equal(suggestions[1].category, "cost");
  assert.equal(suggestions[1].name, "Chevrolet Bolt EV");
  assert.equal(suggestions[2].category, "balance");
  assert.ok(suggestions[0].carbonSavings >= suggestions[1].carbonSavings);
  assert.ok(suggestions[1].costSavings > suggestions[0].costSavings);
  assert.ok(suggestions[2].costSavings > 0);

  const rejected = await handler(event({
    method: "POST",
    path: "/analyses",
    body: { ...inputs, evModel: "suggest" },
  }));
  assert.equal(rejected.statusCode, 400);
});

test("health check reports the factors version", async () => {
  const response = await handler(event({ method: "GET", path: "/health" }));
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).ok, true);
});

test("a zero credit is stored as zero and broken JSON is rejected", async () => {
  const response = await handler(event({
    method: "POST",
    path: "/analyses",
    body: { ...inputs, federalCredit: 0, stateCredit: 0, tradeIn: 0 },
  }));
  assert.equal(response.statusCode, 201);
  const saved = JSON.parse(response.body);
  assert.equal(saved.inputs.federalCredit, 0);
  assert.equal(saved.inputs.stateCredit, 0);
  assert.equal(saved.inputs.tradeIn, 0);
  assert.equal(saved.result.cost.ev.effectivePrice, saved.result.cost.ev.stickerPrice);

  const broken = await handler({
    rawPath: "/analyses",
    queryStringParameters: null,
    body: "{",
    isBase64Encoded: false,
    requestContext: { http: { method: "POST" }, requestId: "test" },
  });
  assert.equal(broken.statusCode, 400);
  assert.match(JSON.parse(broken.body).error, /JSON/);
});
