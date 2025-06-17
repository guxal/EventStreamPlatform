# EventStream Platform

A modular platform for event ingestion, storage, and analysis.  
**Built for scalability, extensibility, and real-world observability scenarios.**

> **Note:** This repository contains the open-source core only.  
> Metric plugins, advanced analytics, and enterprise modules are handled in separate packages.

---

## Features

- **Event API ingestion** – Easily send user, system, or custom events from any client.
- **Scalable architecture** – Built on NestJS, PostgreSQL, Redis, and a modular plugin system.
- **Batch & real-time processing** – Supports both real-time (queue-based) and batch (cron-based) event processing.
- **Plugin-ready** – Add your own event processors, aggregations, or integrations.
- **API for querying** – Expose simple endpoints to fetch raw or processed event data.
- **Tested and load-testable** – Scripts included to simulate high-throughput scenarios.

---

## Monorepo Structure

- `apps/api-writer` – HTTP API to ingest events into the platform.
- `apps/processor-worker` – Processes events (real-time or batch), runs plugins.
- `apps/api-reader` – Exposes an API to query processed data.
- `libs/core-shared` – DTOs, types, and utilities shared across modules.
- `libs/core-infrastructure` – PostgreSQL, Redis, and queue connection logic.
- `libs/core-application` – Core business logic and plugin system.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL & Redis, or use local installations)

### Setup

1. **Clone the repo**

   ```sh
   git clone https://github.com/your-org/eventstream-platform.git
   cd eventstream-platform
    ```

2. **Install dependencies**

    ```sh
    npm install
    ```

3. **Start dependencies (Postgres, Redis)**

    ```sh
    docker-compose up -d
    ```


4. **Start all services (in parallel)**

    ```sh
    nx run-many --target=serve --projects=api-writer,api-reader,processor-worker
    --parallel
    ```
    

5. **Send a test event**

    You can use `curl` or any HTTP client to send a test event to the API:

    ```sh
    curl -X POST http://localhost:3001/api/events \
      -H "Content-Type: application/json" \
      -d '{"eventType":"TestType","userId":"test","timestamp":"2024-01-01T00:00:00Z","properties":{"score":1}}'
    ```

## Development

**Hot reload:**

### Each app can be served individually, e.g.:

```sh
nx serve api-writer
nx serve api-reader
nx serve processor-worker
```

### Build all:

```sh
nx run-many --target=build --all
```

### Test (unit):

```sh
nx test api-writer
```

### End-to-end tests:

```sh
nx e2e api-writer-e2e
```

## Load testing:


To simulate high load and test the API's performance, you can use the included load testing scripts.


Use autocannon or the included scripts:

```sh
npx autocannon -c 100 -d 30 -p 10 http://localhost:3001/api/events \
  -m POST \
  -b '{"eventType":"TestType","userId":"test","timestamp":"2024-01-01T00:00:00Z","properties":{"score":1}}' \
  -H "Content-Type: application/json"
```

## Faker events:

```sh
npx ts-node ./faker/generate-fake-events.ts
```

## Example Use Cases

- Application analytics and behavior tracking.

- Audit trails, system activity logs, and security event pipelines.

- Custom event-driven pipelines (webhooks, triggers, alerting).

- Can be extended for product analytics or business metric calculation via plugins.

## Contribution
Contributions are welcome!

File issues or pull requests for bugs, ideas, or improvements.

See the code structure in ````libs/```` and ````apps/````.

## License
MIT
(c) 2025 Your Company or Community