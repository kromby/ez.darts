# ez.darts

A darts scoring app. React + TypeScript frontend, .NET Azure Functions API, hosted on Azure Static Web Apps.

## Layout

| Path                     | What                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| `web/`                   | Frontend: React + TypeScript (Vite), oxlint, Prettier, Vitest         |
| `api/EzDarts.Api/`       | API: .NET 10 isolated-worker Azure Functions (the Static Web App API) |
| `api/EzDarts.Api.Tests/` | API unit tests (xUnit)                                                |
| `api/EzDarts.slnx`       | .NET solution                                                         |
| `swa-cli.config.json`    | SWA CLI config for running frontend + API together                    |
| `infra/`                 | Bicep for the Azure resources                                         |
| `docs/design/`           | v1 design mockups and visual tokens (Big Keys game pad, stats)        |
| `.github/workflows/`     | CI/CD: test on PR, deploy on merge to main, PR preview environments   |

## Prerequisites

- Node.js 22+
- .NET SDK 10
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4 (`func`)
- [Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) 2.1.0 or newer (`npm i -g @azure/static-web-apps-cli@latest`); older versions reject `dotnet-isolated:10.0` in `staticwebapp.config.json`
- [Azurite](https://learn.microsoft.com/azure/storage/common/storage-use-azurite) (`npm i -g azurite`), the local storage emulator

## First-time setup

```bash
cd web && npm install
```

```bash
cp api/EzDarts.Api/local.settings.example.json api/EzDarts.Api/local.settings.json
```

## Run locally

### Everything through the SWA CLI (recommended)

Start Azurite in one terminal:

```bash
azurite --location .azurite --silent
```

Then from the repo root:

```bash
swa start
```

Open http://localhost:4280. The SWA CLI starts the Vite dev server and `func start`, and serves both on one origin with `/api/*` routed to the Functions host, the same as in Azure.

### Frontend and API separately

```bash
cd web && npm run dev
```

```bash
cd api/EzDarts.Api && func start
```

Open http://localhost:5173. Vite proxies `/api` to the Functions host on port 7071. The page shows `API: ok` when the API is reachable (`GET /api/health`).

## Tests, lint and format

Frontend (from `web/`):

```bash
npm run test:run
```

```bash
npm run lint
```

```bash
npm run format:check
```

`npm test` runs Vitest in watch mode; `npm run format` rewrites files with Prettier.

API (from `api/`):

```bash
dotnet test
```

## Conventions

- `.editorconfig` sets formatting for all files: 2-space indent, 4 for C#, LF line endings, UTF-8 without BOM.
- Frontend style is enforced by Prettier (`web/.prettierrc.json`) and oxlint (`web/.oxlintrc.json`).
- API functions use the ASP.NET Core integration (`HttpRequest` / `IActionResult`) and live under the `/api` route prefix.

## Hosting and deployment

Production runs on Azure, all in resource group `ez-rg-darts` (West Europe):

| Resource         | What                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `ez-stapp-darts` | Static Web App (Free plan): the frontend plus the API as managed .NET 10 Functions        |
| `ezstdarts`      | Storage account; the API uses Table Storage through the `StorageConnectionString` setting |

The [CI/CD workflow](.github/workflows/ci-cd.yml) runs on every PR and on every push to `main`:

- **Every PR:** lint, format check, tests and build for both projects, then a deploy to a preview environment. The deploy action comments the preview URL on the PR, and the preview is removed when the PR closes. PRs from forks are tested but not deployed.
- **Merge to `main`:** the same checks, then a deploy to production.

Preview environments include the API and share production's app settings, so they read and write the same storage account.

To check that the deployed API can reach Table Storage, call `GET /api/health/storage`. It writes one fixed row to the `HealthCheck` table and reads it back.

### Household API

Signed-in households keep their players, games and stats in Table Storage, in the `Players`, `Games` and `PlayerStats` tables. Each table uses the household id as its PartitionKey. The server stores what the app sends and never runs game rules.

| Endpoint                 | What                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| `GET /api/players`       | The household's players, removed ones included                         |
| `PUT /api/players/{id}`  | Create or update a player (`201` new, `200` updated, `409` name taken) |
| `GET /api/games`         | Every game, newest first                                               |
| `GET /api/games/{id}`    | One game                                                               |
| `PUT /api/games/{id}`    | Save a game, as often as after every dart; the same save twice is safe |
| `DELETE /api/games/{id}` | Remove a game (one quit before the end)                                |
| `GET /api/stats`         | Stats rows per player, game and ISO week, for the app to add up        |

Every one of them needs a signed-in household and answers `401` without one.

### Stats

When a game finishes, the app works out a summary for each player and saves it with the game: darts thrown, how many were singles, doubles, triples and misses, the player's place, and, for x01, the points scored. Stats are those summaries added up per player, game and ISO week (UTC). For a household the API keeps the sums in `PlayerStats` as games are saved. For a guest, the app adds up the games on the device the same way. Periods, the game filter, head-to-head (from the games' standings) and the x01 3-dart average are worked out in the app from those rows, so a guest and a household get the same numbers for the same games. `web/src/stats/fixtures/` holds games and their expected rows, and both test suites check against it.

### Sign-in

One email-and-password account per household. Accounts live in the `Users` table, sessions in `Sessions` and failed sign-ins in `LoginAttempts`.

| Endpoint                              | What                                                  |
| ------------------------------------- | ----------------------------------------------------- |
| `POST /api/account/register`          | Create the household's account and sign in            |
| `POST /api/account/login`             | Sign in (`401` for a wrong email or password alike)   |
| `GET /api/account/me`                 | Who is signed in on this device, or `401`             |
| `POST /api/account/logout`            | Sign out this device                                  |
| `POST /api/account/logout-everywhere` | Sign out every device                                 |
| `POST /api/account/password`          | Change the password; every other device is signed out |

- **Passwords** are hashed with ASP.NET Core Identity's `PasswordHasher`.
- **Sessions:** a random 32-byte token goes in the `ezd_session` cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api`, lasting 30 days and renewed when used. Only the token's SHA-256 is stored.
- **Lockout:** five failed sign-ins within 15 minutes lock that email out for 15 minutes, whether or not it has an account.
- **Same-site check:** requests that change something must come from the app's own pages, judged by the browser's `Sec-Fetch-Site` header, or `Origin` in older browsers.
- **No clash with Static Web Apps:** the routes and cookie stay clear of its own `/.auth/*` routes and cookies.

Under `func start` locally, an `X-Household-Id` header also stands in for a session, to try the household API without an account:

```bash
curl -H 'X-Household-Id: test' http://localhost:7071/api/players
```

### Provisioning (one time, or after changing `infra/`)

```bash
az group create --name ez-rg-darts --location westeurope
```

```bash
az deployment group create --resource-group ez-rg-darts --parameters infra/main.bicepparam
```

Then give GitHub Actions the deployment token:

```bash
az staticwebapp secrets list --name ez-stapp-darts --resource-group ez-rg-darts --query properties.apiKey -o tsv | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo kromby/ez.darts
```

Re-running the deployment is safe. It also re-applies the `StorageConnectionString` app setting, which picks up a rotated storage key.
