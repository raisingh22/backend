# OptiFlow Backend

NestJS backend for OptiFlow, an optical shop management system.

## Stack

- NestJS 11
- PostgreSQL
- Prisma 7
- JWT authentication
- class-validator and class-transformer
- Swagger API docs

## Setup

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Update `.env` with your local PostgreSQL connection:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/optiflow"
JWT_SECRET="change-me-to-a-long-random-secret"
PORT=3000
```

Sync Prisma with the database:

```bash
npx prisma db push
npx prisma generate
```

Run the backend:

```bash
npm run start:dev
```

## URLs

API base URL:

```txt
http://localhost:3000/api/v1
```

Swagger docs:

```txt
http://localhost:3000/api/docs
```

Health check:

```txt
GET http://localhost:3000/api/v1/health
```

Postman collection:

```txt
../docs/OptiFlow.postman_collection.json
```

## API Rules

- All current business APIs use `/api/v1`.
- JSON uses camelCase field names.
- Protected routes require `Authorization: Bearer <token>`.
- `workspaceId` always comes from the JWT, never from client body data.
- Unknown request fields are rejected by global validation.
- Customer and prescription data is scoped by workspace.

## Implemented Modules

- Auth
- Customers
- Prescriptions
- Workspace
- Health
- Tasks, currently demo/support code

## Commands

Build:

```bash
npm run build
```

Test:

```bash
npm test -- --runInBand
```

Format:

```bash
npm run format
```

## Server Deployment

### Recommended: Render

Use Render for the first production backend. The included `render.yaml` creates:

- `optiflow-backend` Node web service
- `optiflow-postgres` managed PostgreSQL database
- Generated `JWT_SECRET`
- `DATABASE_URL` wired from the database to the API
- Health check at `/api/v1/health`

Deploy steps:

1. Push this backend repo to GitHub.
2. In Render, create a new Blueprint from that repo.
3. Select `render.yaml`.
4. Deploy.

After deploy, Render gives you an HTTPS URL like:

```txt
https://optiflow-backend.onrender.com
```

Use it in the mobile app:

```bash
EXPO_PUBLIC_API_URL=https://optiflow-backend.onrender.com
```

### VPS With Docker

The backend can run on a VPS with Docker Compose. These commands assume Ubuntu/Debian and that Docker is already installed.

From the server:

```bash
git clone <your-repo-url> optiflow
cd optiflow/backend
cp .env.production.example .env.production
```

Edit `.env.production` and replace `DATABASE_URL` and `JWT_SECRET`. The database password in `DATABASE_URL` must match `POSTGRES_PASSWORD` in `docker-compose.yml`.

Build the backend image:

```bash
docker compose build backend
```

Create/update the database schema:

```bash
docker compose --profile setup run --rm db-init
```

Start the API:

```bash
docker compose up -d postgres backend
```

Check the deployment:

```bash
docker compose ps
curl http://localhost:3000/api/v1/health
```

Public URLs after pointing a domain or reverse proxy at port `3000`:

```txt
https://your-domain.com/api/v1
https://your-domain.com/api/docs
```

For the mobile app, set the API host before building/running Expo:

```bash
EXPO_PUBLIC_API_URL=https://your-domain.com
```

Useful maintenance commands:

```bash
docker compose logs -f backend
docker compose restart backend
docker compose pull
docker compose build backend
docker compose up -d backend
```
