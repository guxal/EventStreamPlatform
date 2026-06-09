# AI Marketing Copilot — File Hub / Import Hub (Bronze Layer)

## Purpose

The File Hub is the **Bronze Layer control center** for raw marketing files. It changes the V1 upload behavior from:

```txt
upload CSV → process immediately
```

to:

```txt
upload CSV
→ store raw file
→ profile CSV
→ auto-classify source/report_type
→ allow manual tagging when needed
→ process only when READY_TO_PROCESS
```

This keeps raw files separated from normalized marketing entities/metrics and prevents unknown or low-confidence files from entering the worker pipeline.

## Scope

Implemented backend foundation only:

- API Writer endpoints for raw file upload, listing, detail, manual tagging, and process trigger.
- Object storage write + stream read support.
- PostgreSQL raw file metadata persistence.
- CSV profiling by stream.
- Deterministic source/report classification.
- BullMQ payload publication for AppsFlyer files that are ready to process.
- Processor-worker AppsFlyer pipeline consumption after File Hub handoff.

Not implemented in this layer:

- Google Ads processing from File Hub.
- AppsFlyer + Google Ads joins.
- AI interpretation of raw files.
- Frontend UI.

## Main components

| Layer | Component | Responsibility |
| --- | --- | --- |
| `apps/api-writer` | `AppController` | Exposes File Hub HTTP endpoints and Swagger docs. |
| `apps/api-writer` | `AppService` | Delegates File Hub operations to `FileHubService`. |
| `libs/marketing-application` | `FileHubService` | Orchestrates upload, profiling, classification, manual tagging, status transitions, and queue trigger. |
| `libs/marketing-application` | `FileProfilerService` | Streams CSV files from object storage, extracts headers/sample rows, counts rows, computes checksum. |
| `libs/marketing-application` | `ReportClassifierService` | Classifies source/report type from filename and headers. |
| `libs/marketing-infrastructure` | `ObjectStorageService` | Stores base64 upload content and exposes `getObjectStream` for profiling. |
| `libs/marketing-infrastructure` | `RawImportFileRepository` | Persists and queries File Hub metadata in `raw_import_files`. |
| `libs/marketing-infrastructure` | `DataImportRepository` | Creates the processing-side `data_imports` record when a ready file is triggered. |
| `apps/processor-worker` | `AppsFlyerImportProcessor` | Consumes `marketing-imports/process-marketing-import`, streams AppsFlyer files, persists normalized events/KPIs/facts, and marks completion/failure. |

## Raw file lifecycle

Statuses are defined by `RawFileStatus`:

| Status | Meaning |
| --- | --- |
| `UPLOADED` | File has been written to object storage and an initial DB record exists. |
| `PROFILING` | File is being read by stream for headers, samples, row count, size, checksum. |
| `PROFILED` | File profile has been saved. |
| `AUTO_CLASSIFIED` | Reserved status for future explicit classification checkpoint. |
| `NEEDS_REVIEW` | Classification confidence is low or source/report type is unknown. Manual tagging is required. |
| `READY_TO_PROCESS` | File has high-confidence auto-classification or valid manual tags. |
| `PROCESSING` | A `data_imports` record has been created/linked and a BullMQ job has been published. |
| `COMPLETED` | Reserved for the worker pipeline after successful processing. |
| `FAILED` | Reserved for profiling/processing failures. |

Current automatic status flow:

```txt
UPLOADED
→ PROFILING
→ PROFILED
→ READY_TO_PROCESS when source/report_type confidence >= 0.75
  OR NEEDS_REVIEW when source/report_type is unknown or confidence < 0.75
```

Manual tag flow:

```txt
NEEDS_REVIEW
→ PATCH /projects/:id/files/:fileId/tags
→ READY_TO_PROCESS
```

Processing flow:

```txt
READY_TO_PROCESS
→ POST /projects/:id/files/:fileId/process
→ PROCESSING
→ BullMQ marketing-imports/process-marketing-import
→ processor-worker AppsFlyer pipeline
→ COMPLETED or FAILED
```

## Source and report type classification

Supported sources:

- `APPSFLYER`
- `GOOGLE_ADS`
- `META_ADS`
- `UNKNOWN`

Supported report types include AppsFlyer reports (`installs`, `in_app_events`, `blocked_installs`, `ad_revenue`, etc.), Google Ads reports (`campaigns`, `keywords`, `search_terms`, `ads`, `geo`, `devices`), and `unknown`.

Classification signals:

- Filename hints, for example `blocked-installs`, `in-app-events`, `campaigns`, `keywords`, `search terms`.
- Header hints, for example AppsFlyer headers (`AppsFlyer ID`, `Event Name`, `Install Time`, `Media Source`) and Google Ads headers (`Campaign`, `Campaign ID`, `Keyword`, `Impressions`, `Clicks`, `Cost`, `Conversions`).

Confidence behavior:

| Signals | Confidence behavior |
| --- | --- |
| Strong filename + strong headers | `0.90+`; usually `READY_TO_PROCESS`. |
| Strong headers only | `0.75–0.90`; can become `READY_TO_PROCESS`. |
| Weak filename only | `0.50–0.75`; usually `NEEDS_REVIEW`. |
| Unknown/mixed signals | `< 0.50`; always `NEEDS_REVIEW`. |

## API Writer endpoints

All endpoints are under the API Writer global prefix `/api` at runtime.

### `POST /projects/:id/files`

Uploads a raw CSV file to the File Hub without immediate processing.

Swagger is configured for `multipart/form-data`, so the `file` field can be selected directly in the Swagger UI.

Multipart fields:

| Field | Required | Description |
| --- | --- | --- |
| `file` | Yes in Swagger | CSV file binary. |
| `fileName` | No | Optional filename override; defaults to uploaded file name. |
| `mimeType` | No | Optional MIME override; defaults to uploaded file MIME type or `text/csv`. |
| `tags` | No | JSON object or JSON-encoded object string with Bronze Layer tags. |

Backward-compatible JSON payload is also supported by the controller when a multipart file is not supplied:

```json
{
  "fileName": "campaigns.csv",
  "contentBase64": "Q2FtcGFpZ24sQ2xpY2tz...",
  "mimeType": "text/csv",
  "tags": { "account": "demo" }
}
```

Response includes:

- `rawFile`
- `profile`
- `classification`
- `status`

### `GET /projects/:id/files`

Lists File Hub records for a project.

Optional filters:

- `status`
- `source`
- `report_type`

### `GET /projects/:id/files/:fileId`

Returns one raw file record with profile, classification, tags, and processing status.

### `PATCH /projects/:id/files/:fileId/tags`

Manually confirms or corrects source/report type.

```json
{
  "source": "APPSFLYER",
  "report_type": "installs",
  "tags": { "account": "demo" }
}
```

If source and report type are valid known values, the file is marked:

```txt
READY_TO_PROCESS
needs_review=false
classification_confidence=1
```

### `POST /projects/:id/files/:fileId/process`

Publishes a ready file to the worker pipeline.

Validation:

- File must exist under the same project.
- File status must be `READY_TO_PROCESS`.
- Source/report type must not be unknown.
- Source must be `APPSFLYER` for the current V1 processing endpoint.

Side effects:

- Creates or reuses a `data_imports` record.
- Links `raw_import_files.data_import_id` to the import.
- Sets raw file status to `PROCESSING`.
- Publishes BullMQ job `process-marketing-import` on queue `marketing-imports`.

Job payload shape:

```json
{
  "projectId": "...",
  "rawFileId": "...",
  "dataImportId": "...",
  "storageUri": "file:///...",
  "bucket": "marketing-imports",
  "objectKey": "project/raw-files/file/report.csv",
  "source": "APPSFLYER",
  "reportType": "non_organic_in_app_events",
  "tags": {},
  "triggeredBy": "file_hub",
  "correlationId": "..."
}
```

## Swagger organization

The API Writer Swagger document defines these expected tags:

- `events` — EventStream core event ingestion.
- `projects` — AI Marketing Copilot project management.
- `imports` — legacy immediate-import endpoints.
- `file-hub` — Bronze Layer File Hub upload/profile/classify/tag/process endpoints.

The controller does **not** use a class-level `@ApiTags('events')`, so project/import/File Hub endpoints no longer appear under the `events` tag in Swagger.

## Important constraints

- Do not send raw files to AI.
- Do not process unknown files.
- Do not process files before high-confidence auto-classification or valid manual tagging.
- Keep the existing EventStream core endpoints intact.
- File Hub itself only profiles/classifies; AppsFlyer parsing starts in the processor-worker after the process endpoint.
- Google Ads parsing and AppsFlyer + Google Ads joins remain future work.
