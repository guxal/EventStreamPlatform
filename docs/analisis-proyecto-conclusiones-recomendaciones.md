# Análisis del proyecto — conclusiones y recomendaciones actuales

## 1. Resumen ejecutivo

EventStream Platform ya cuenta con una capa AI Marketing Copilot avanzada para el flujo AppsFlyer CSV. La arquitectura actual incluye File Hub/Bronze, procesamiento stream-based en worker, ClickHouse para eventos/snapshots, PostgreSQL para records transaccionales/AI/semánticos/auditoría, AI providers, analysis runs explícitos, controlled questions/chat y una UI HTML de pruebas.

La principal brecha frente al milestone original sigue siendo Google Ads CSV: la base de File Hub y AI guardrails ya existe, pero el procesamiento Google Ads end-to-end aún debe implementarse.

## 2. Fortalezas actuales

1. **Extensión sin reescritura del core.** Las apps y libs existentes se mantienen, y la funcionalidad marketing vive en `libs/marketing-*`.
2. **File Hub como control center.** Los raw files se almacenan, perfilan, clasifican y revisan antes de llegar al worker.
3. **Pipeline AppsFlyer maduro.** Usa stream parsing, mapper, event-value parser, normalizer, ClickHouse writes, KPI snapshots, deterministic facts y status/error handling por etapa.
4. **AI facts-first.** Recommendations/reports y preguntas controladas usan facts y contexto procesado; raw CSV queda fuera del prompt.
5. **Capa semántica/contextual.** Entities, relationships y context objects mejoran grounding sin mover time-series fuera de ClickHouse.
6. **Auditoría operativa.** Process runs/steps y statuses de raw/import permiten diagnosticar fallos por Bronze, Silver, Gold, semantic/context y AI.
7. **Analysis runs explícitos.** La generación AI puede dispararse manualmente sobre datos procesados sin reejecutar imports.
8. **Controlled chat.** `/questions` y `/ai-chat` usan intent routing y funciones de datos acotadas, no Text-to-SQL.
9. **HTML test UI.** `/api/ui` acelera QA manual de File Hub, monitoring, analysis runs, AI outputs y preguntas.

## 3. Estado por dominio técnico

| Dominio | Estado | Comentario |
| --- | --- | --- |
| Core EventStream | Sólido | Se conserva `api-writer`, `api-reader`, `processor-worker`, Redis/BullMQ y Nx. |
| File Hub / Bronze | Implementado | Upload, profile, classify, manual tags, process, reprocess, delete, list/detail. |
| AppsFlyer processing | Implementado | Flujo principal actual de producción-like CSV. |
| ClickHouse | Implementado/parcial | AppsFlyer events + snapshots activos; `marketing_daily_metrics` sigue como schema genérico. |
| PostgreSQL marketing | Implementado | Facts, AI outputs, audit, semantic/context, analysis runs. |
| AI providers | Implementado | Mock/OpenAI/Claude/Gemini con fallback y metadata. |
| Controlled questions/chat | Implementado | Intent routing + bounded data functions + provider/fallback answer. |
| HTML test UI | Implementado | Framework-free, servido por admin en `/api/ui`. |
| Google Ads CSV | Pendiente | Es el siguiente milestone funcional importante. |
| Trusted cost source | Pendiente | Necesario para ROAS/CPA/CAC/profitability reales. |

## 4. Riesgos principales

| Riesgo | Impacto | Recomendación |
| --- | --- | --- |
| Google Ads no procesado end-to-end | El milestone original V1 no queda completo | Implementar parser/normalizer/facts Google Ads sobre File Hub. |
| ClickHouse opcional en local puede ocultar problemas | Imports podrían parecer exitosos sin Silver/Gold reales | Diferenciar modo dev no-op de staging/prod obligatorio. |
| Sin fuente de costos confiable | IA podría sobreprometer rentabilidad si no se respetan guardrails | Mantener unavailable metrics y agregar fuente de costos antes de ROI. |
| AI observability parcial | Costos/latencia/prompt drift difíciles de controlar | Persistir prompt version, token estimates, duration y provider errors. |
| E2E integrados insuficientes | Regresiones cross-service pueden pasar desapercibidas | Crear tests de upload → process → facts → analysis run → question. |
| Compose local incompleto | Onboarding/QA manual dependen de configuración externa | Agregar ClickHouse y MinIO/S3 o perfiles documentados. |

## 5. Recomendaciones priorizadas

### P0 — Completar milestone Google Ads CSV

- Agregar clasificación robusta para reportes Google Ads.
- Implementar parser stream y mapper Google Ads.
- Normalizar campaign/adgroup/keyword rows hacia schema marketing.
- Escribir métricas a ClickHouse.
- Ejecutar reglas V1, especialmente `HIGH_SPEND_ZERO_CONVERSIONS`.
- Persistir facts y exponerlos en dashboard/questions.

### P1 — Endurecer infraestructura y operaciones

- Hacer ClickHouse obligatorio en perfiles staging/prod.
- Agregar MinIO/S3 local o documentar claramente el adapter activo.
- Añadir health checks para PostgreSQL, Redis, ClickHouse y object storage.
- Añadir comandos reproducibles para migraciones PostgreSQL y ClickHouse.

### P1 — Fortalecer AI governance

- Persistir prompt version y hash de contexto.
- Registrar duración, provider status y estimados de tokens/costo.
- Añadir tests de guardrails para raw CSV, Text-to-SQL y cost metrics unavailable.

### P2 — Mejorar QA y developer experience

- Automatizar E2E del flujo AppsFlyer ya implementado.
- Agregar E2E del flujo de analysis runs y controlled questions.
- Mantener `/api/ui` como herramienta de smoke testing manual.
- Evitar que la UI de pruebas se convierta en frontend productivo sin planificación.

## 6. Conclusión

El proyecto ya superó el estado de scaffold inicial. La capa AppsFlyer + AI Marketing Copilot tiene una arquitectura coherente y varias piezas productivas: File Hub, processing, facts, semantic/context, AI outputs, analysis runs, controlled chat y test UI.

La siguiente inversión debe enfocarse en cerrar el gap de Google Ads CSV y en endurecer infraestructura/observabilidad para que el mismo patrón multi-source pueda escalar con confianza.
