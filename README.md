# Is an EV More Sustainable for You?

A web-based tool that helps you compare the lifetime carbon footprint of **keeping your current gas/diesel/hybrid car** versus **switching to an electric vehicle**.

## Open the site

The public site is already published. Open it in a browser:

**https://hannahgracej.github.io/Is-an-EV-more-sustainable-for-you-/**

The calculator and **Suggest one for me** both work on that page. The math runs in your browser there, and comparisons are not saved on a server. If the page looks like an older version, refresh it.

To save a comparison and get a link back to it, run the page and the API on your computer. From this folder, with Node.js 22:

```bash
npm start
```

Then open **http://localhost:3001**. Saved comparisons stay in memory until you stop that process.

After you deploy to AWS, the deploy command prints `SiteUrl`. Open that address. It serves the page and the API, and saved comparisons are kept for a year. The steps are in [Deploying to your AWS account](#deploying-to-your-aws-account).

## How It Works

1. **Enter your current car details** — fuel type, model year, vehicle size, fuel economy (MPG), and annual mileage.
2. **Pick the EV you're considering** — choose from 40+ popular models, or press **Suggest one for me** after entering miles, grid, and state. That shows the biggest carbon cut, the biggest cost savings, and the next car that does well on both.
3. **Select your electricity grid** — carbon intensity varies significantly by region.
4. **Get your results** — see a side-by-side comparison with cumulative emissions charts and a clear verdict.
5. **Keep the result** — on the local server or the AWS site, you get a link back to the comparison, and recent ones for this browser are listed on the first step. On the public GitHub Pages address, the result is shown in the browser and is not stored.

## What's Included in the Calculation

| Factor | Keep Current Car | Switch to EV |
|--------|-----------------|--------------|
| Manufacturing | Already sunk (not counted) | Full vehicle + battery production |
| Fuel / Energy | Gasoline/diesel combustion + upstream extraction & refining | Electricity from your regional grid |
| Maintenance | Tires, fluids, parts | Tires, parts (fewer moving parts) |

### Key Data Sources

- **Fuel CO2**: EPA — 8.887 kg CO2/gallon gasoline, 10.18 kg/gallon diesel
- **Upstream emissions**: ~25% adder for well-to-tank (extraction, refining, transport)
- **EV manufacturing**: Argonne GREET model estimates — 65–175 kg CO2 per kWh of battery capacity
- **Grid intensity**: IEA and EPA eGRID regional averages
- **Vehicle LCA**: Peer-reviewed lifecycle assessment studies

## Architecture

The browser is still the static page. Submitting the form calls an API, which is the copy of record for a saved comparison.

```
browser
  └─ CloudFront
       ├─ /*      private S3 bucket (HTML, CSS, JS)
       └─ /api/*  API Gateway HTTP API → Lambda (Node.js) → DynamoDB
```

CloudFront removes the `/api` prefix before API Gateway sees the request, and it does not forward the viewer's `Host` header. API Gateway rejects requests whose host is the CloudFront domain. One distribution means the production page and the API are the same origin, so the browser does not send a CORS preflight there.

| Piece | What it is for |
| --- | --- |
| Lambda | Validates the form, runs `calc.js`, writes the result |
| DynamoDB | `id` is the share key. A `byVisitor` index lists one browser's recent runs, newest first. Items expire after a year |
| S3 + CloudFront | Hosts the page. The bucket is private; CloudFront reads it with origin access control |
| API Gateway throttle | 10 requests/second, burst 20. This is a public calculator with no accounts |

`data.js` and `calc.js` are the same files in the browser and in Lambda. The API result is what gets stored. If the API cannot be reached, the page still calculates locally and says the comparison was not saved. That keeps the existing GitHub Pages site working.

There is no login. The browser keeps a random `visitorId` in `localStorage` and sends it when saving. That id is not authentication: anyone with a share link can open that one analysis, and anyone who knows a visitor id can list that visitor's titles. The partition key is already separate from the share id, so replacing `visitorId` with a Cognito `sub` later does not change the table.

Every saved row stores `factorsVersion` (`2026.1` today). When the emissions factors change, old links still say which version produced them.

## Running locally

`npm start` is described in [Open the site](#open-the-site). It serves the page and the API on http://localhost:3001.

```bash
npm test
```

The tests call the Lambda handler directly with the in-memory store. They do not need AWS credentials.

## Deploying to your AWS account

The stack is AWS CDK in `infra/`. From a machine where the AWS CLI is already logged in (`aws sts get-caller-identity`):

```bash
cd infra
npm install
npx cdk bootstrap
npx cdk deploy
```

`cdk bootstrap` is once per account and region. The stack uses the region your AWS CLI is configured for. From the West Coast, pin Oregon so the table and the functions sit near you:

```bash
export AWS_REGION=us-west-2
export CDK_DEFAULT_REGION=us-west-2
```

Deploy prints `SiteUrl`. That hostname is the product: the page and `/api` are both on it. If the CLI has no region configured, CDK uses `us-east-1`.

`npx cdk destroy` removes the stack, including the table and the site bucket. The table's removal policy is `DESTROY` so a portfolio account does not keep an empty table behind. A production table would be `RETAIN`.

At demo traffic the expensive parts are idle: Lambda and API Gateway sit on the free tier for a long time at this volume, DynamoDB is on-demand, and CloudFront is limited to North America and Europe (price class 100). Tear the stack down when you are not showing it.

### Deploying from GitHub Actions

`.github/workflows/deploy-aws.yml` is manual (`workflow_dispatch`). It assumes a role with GitHub's OIDC provider, so the repo does not store an access key.

One-time setup in the account:

1. In IAM, add an identity provider for `token.actions.githubusercontent.com` (audience `sts.amazonaws.com`).
2. Create a role that trusts that provider only for `repo:hannahgracej/Is-an-EV-more-sustainable-for-you-:ref:refs/heads/main`.
3. Let that role deploy this stack (CloudFormation plus the services in `infra/lib/stack.js`). `cdk bootstrap` can stay on your own user.
4. Save the role ARN as the repository secret `AWS_DEPLOY_ROLE_ARN`.

Then run the **Deploy to AWS** workflow from the Actions tab. Do the first deploy from your laptop so you can read the template before the pipeline does.

## What to say about it

The useful version is specific. A few claims this repo can back up:

- The calculation used to run only in the browser. It now runs in Lambda from the same `calc.js`, and the stored result is the one the share link reloads. The page still has a fallback so a static host does not go blank.
- DynamoDB is a share-id lookup plus one global secondary index. Listing recent comparisons is a `Query` on `visitorId`, not a `Scan`. There is one entity, so a single-table design would only add a prefix convention.
- The Lambda role can `GetItem`, `PutItem`, and `Query`. It cannot scan or delete the table.
- The site bucket blocks public access. CloudFront uses origin access control. API traffic is uncached; the HTML and scripts use the managed caching policy.
- Request limits live on the API Gateway stage. The handler also rejects unknown models, out-of-range numbers, and bodies over 10 KB.
- Factors are versioned on the item. That is the hook for "what happens when the catalog changes."
- Tests hit the handler with no AWS account. The in-memory store and DynamoDB store implement the same three operations.
- The pipeline uses OIDC. There is no long-lived AWS key in GitHub.

Reasonable next steps, if an interviewer asks what you would add: Cognito in front of the visitor id, a tighter CORS allow-list if the API is ever called from another origin, and point-in-time recovery on the table if the data became something you could not lose. None of those are built, and they do not need to be for the design to be coherent.

## File Structure

```
index.html, style.css, app.js, chart.js, config.js
data.js, calc.js          — catalog and calculation, shared by the page and Lambda
backend/lambda            — API handler
backend/local-server.js   — page + API on one local port
infra/                    — CDK stack (CloudFront, S3, API Gateway, Lambda, DynamoDB)
```

The page itself has no runtime dependencies and no build step. Charts use the canvas API. AWS CDK is installed only when you deploy.
