# Client Mapping Profiles

Client Mapping Profiles let AI Marketing Copilot support project-specific CSV schemas without creating one plugin per client. The architecture remains: source plugin base (`AppsFlyerPlugin`, future `GoogleAdsPlugin`, `MetaAdsPlugin`) plus project/source/report-type mapping configuration. Client custom plugins are reserved for rare transformations that cannot be represented by mappings.

## Data model

`project_source_mappings` stores one versioned mapping per project/source/report type/schema signature. It includes `column_mapping`, `event_mapping`, `identity_strategy`, `currency`, `timezone`, `kpi_rules`, `sensitive_fields`, `data_quality_rules`, signatures, AI metadata, confirmation metadata, and lifecycle status.

Raw File Hub rows also store `mapping_id`, `schema_signature`, `mapping_status`, and `mapping_validation` so the Bronze record shows whether the file can move to processing.

## Lifecycle

1. Upload CSV to File Hub.
2. Deterministic profiling/classification runs first.
3. `SchemaDetectionService` normalizes headers and computes `schemaSignature = sha256(source + reportType + normalizedSortedHeaders)` plus `headerSignature`.
4. If an active mapping exists for project/source/report type/signature, File Hub attaches it and sets the file to `READY_TO_PROCESS`.
5. If no mapping exists, File Hub sets `MAPPING_REQUIRED`.
6. Optional AI Schema Assistant can create an `AI_SUGGESTED` mapping and set the file to `MAPPING_SUGGESTED`.
7. A user confirms/corrects the mapping. Confirmation validates the mapping, archives older active versions for the same schema, and activates the new mapping.
8. Applying a valid confirmed/active mapping sets the file to `READY_TO_PROCESS`.

## Statuses

Mapping statuses: `DRAFT`, `AI_SUGGESTED`, `NEEDS_REVIEW`, `CONFIRMED`, `ACTIVE`, `ARCHIVED`.

File statuses added for mapping: `AUTO_CLASSIFIED`, `SCHEMA_DETECTED`, `MAPPING_REQUIRED`, `MAPPING_SUGGESTED`, `MAPPING_CONFIRMED`, `READY_TO_PROCESS`.

Files in `MAPPING_REQUIRED`, `MAPPING_SUGGESTED`, or `NEEDS_REVIEW` must not be processed.

## Validation rules

Validation checks known source/report type, confirmed/active status, required columns, identity strategy, duplicate canonical targets, sensitive field identification, currency/timezone warnings, and event mappings for event reports.

AppsFlyer installs require `event_name` or `install_time`, plus `appsflyer_id` or `advertising_id`. AppsFlyer event reports require `event_name`, `event_time`, one identity field, and event mapping. Google Ads campaign/keyword rules are documented in code for the V1 planned integration.

## Worker integration

The worker loads the raw file mapping by `mapping_id` or resolves the active mapping by schema signature. If no confirmed/active profile exists, the import fails with `MAPPING_PROFILE_MISSING`. AppsFlyer processing receives the mapping profile in context.

`AppsFlyerColumnMapper` prioritizes `mapping.columnMapping`; `AppsFlyerEventDictionaryPlugin` prioritizes `mapping.eventMapping`; the normalizer uses mapping currency when row currency is absent.

## Example AppsFlyer mapping

```json
{
  "source": "appsflyer",
  "reportType": "in_app_events",
  "columnMapping": {
    "Event Name": "event_name",
    "Event Time": "event_time",
    "AppsFlyer ID": "appsflyer_id",
    "Customer User ID": "customer_user_id",
    "Media Source": "media_source",
    "Campaign": "campaign_name",
    "Event Value": "event_value"
  },
  "eventMapping": { "deposit_success": "DEPOSIT" },
  "identityStrategy": ["customer_user_id", "appsflyer_id", "advertising_id"],
  "currency": "CAD",
  "timezone": "America/Toronto"
}
```

## Example Google Ads mapping

```json
{
  "source": "google_ads",
  "reportType": "campaigns",
  "columnMapping": {
    "Campaign": "campaign",
    "Campaign ID": "campaign_id",
    "Impressions": "impressions",
    "Clicks": "clicks",
    "Cost": "cost",
    "Conversions": "conversions"
  },
  "identityStrategy": ["campaign_id"],
  "currency": "USD",
  "timezone": "UTC"
}
```

## What happens when a client has not configured a mapping?

A new client/project can upload files normally. File Hub still stores the raw object, profiles the CSV, computes headers/sample rows/checksum, and runs deterministic source/report type classification first. The file is not lost and AI is not asked to analyze performance.

If no active mapping exists for the detected `project_id + source + report_type + schema_signature`, the file moves to `MAPPING_REQUIRED` (or `MAPPING_SUGGESTED` after an AI suggestion). In those states, processing intentionally does not work: the Writer process endpoint rejects the file before queueing, and the worker also protects the pipeline with `MAPPING_PROFILE_MISSING` if a job is somehow published without a confirmed/active profile.

The expected onboarding flow for an unconfigured client is:

1. Upload CSV in File Hub.
2. Confirm that profiling/classification detected the correct source and report type.
3. Open the test dashboard `Mappings` tab.
4. Run **Detectar schema** to compute `schemaSignature` and check for reusable mappings.
5. If no mapping exists, run **Detectar + sugerir AI** or create a mapping manually.
6. Review/correct `columnMapping`, `eventMapping`, `identityStrategy`, currency/timezone, sensitive fields, and data-quality rules.
7. Click **Confirmar mapping**. Confirmation validates required columns and activates the profile for the schema.
8. Click **Aplicar a rawFileId**. The file becomes `READY_TO_PROCESS` when validation passes.
9. Process the file. Future uploads with the same headers/source/report type reuse the active mapping automatically and can skip manual review.

This means the first file for a new schema is an onboarding/review step, not a broken import. Only confirmed or active mappings can unlock processing.

## Built-in defaults vs project mappings

The mapping system now has two layers. A **built-in default mapping** is a trusted source/report-type family owned by the platform, for example `APPSFLYER + installs` or `APPSFLYER + in_app_events`. It describes standard vendor headers and lets standard exports keep a low-friction upload experience.

A **project mapping** is the reusable client contract:

```text
projectId + source + reportType + schemaSignature
```

When a standard file is uploaded for the first time and no project mapping exists, the system can materialize the matching built-in default into a system-generated project mapping. That project mapping is marked `ACTIVE`, has `metadata.createdFrom = "BUILT_IN_DEFAULT_MAPPING"`, is not AI-suggested, and is not user-confirmed. The raw file stores only `mapping_id` as a reference to that reusable profile; it is not a unique mapping per file.

Resolution order is:

1. attached raw file mapping (`raw_import_files.mapping_id`),
2. active project mapping by `projectId + source + reportType + schemaSignature`,
3. built-in default mapping by `source + reportType`,
4. AI/manual review when safe resolution is not possible.

A file goes directly to `READY_TO_PROCESS` when a valid attached/project mapping is found, or when a trusted built-in default validates and creates/reuses a system project mapping. A file goes to `MAPPING_REQUIRED` when no mapping can be safely resolved, confidence is too low, required columns are missing, or the default mapping fails validation.

Processing without a valid mapping remains blocked. The low-friction path is preserved by automatically creating a reusable system mapping for standard schemas, not by bypassing mapping safety.
