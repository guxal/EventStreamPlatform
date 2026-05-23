📋 Resumen detallado del proyecto Metrics Platform
🏗️ 1. Arquitectura general
Monorepo Nx para organización de múltiples apps y libs con NestJS.

Estructura alineada a prácticas de microservicios/DDD (Domain-Driven Design).

Cada app tiene una responsabilidad clara y separada.

Estructura principal
bash
Copy
Edit
metrics-platform/
├── apps/
│   ├── admin/                # App para administración y configuración
│   ├── api-writer/           # Recibe y almacena eventos (write-side)
│   ├── api-reader/           # Expone métricas procesadas (read-side)
│   └── processor-worker/     # Procesamiento batch y agregación de eventos
│   ├── ...-e2e/              # Test de extremo a extremo de cada app
│
├── libs/
│   ├── core-application/     # CQRS: comandos, queries, handlers, lógica orquestadora
│   ├── core-domain/          # Modelos, entidades y lógica de negocio
│   ├── core-infrastructure/  # Infraestructura: BD, ORM, auth, colas, etc
│   └── core-shared/          # Utilidades, DTOs, interfaces y constantes comunes
│
├── docker-compose.yml        # Infraestructura local (Postgres, Redis, etc)
├── nx.json                   # Configuración Nx principal
├── package.json              # Dependencias globales
└── ...
🧩 2. Apps y sus responsabilidades
admin
Endpoints y lógica para administración, configuración del sistema, gestión de usuarios/roles y parámetros globales.

api-writer
Recibe eventos crudos (user actions, pagos, posts, feed, etc.).

Almacena los eventos (event sourcing).

Puede disparar comandos/queues para procesamiento.

api-reader
Expone métricas agregadas y procesadas vía endpoints (REST/GraphQL).

Provee datos para dashboards, reportes, y análisis de negocio.

processor-worker
Procesa y agrega eventos periódicamente (cron jobs, workers, queues).

Calcula métricas como DAU, MAU, MRR, retención, churn, conversiones, etc.

Actualiza las tablas de métricas consultadas por api-reader.

🏷️ 3. Libs y uso compartido
core-application: Implementa CQRS, lógica de procesamiento de eventos/métricas.

core-domain: Define entidades principales (Event, Metric, User, etc).

core-infrastructure: Conexión a bases de datos, colas, integración con autenticación (BetterAuth), otros servicios externos.

core-shared: DTOs, interfaces, utilidades, constantes comunes, enums.

📊 4. Tipos de eventos y métricas
Eventos a capturar (ejemplos):
user_signup, user_login, user_logout

post_created, post_liked, comment_added

feed_viewed, feed_scrolled, post_impression

payment_made, subscription_started, donation_made

Y eventos personalizados por el usuario/sistema

Estructura de eventos de entrada:
json
Copy
Edit
{
  "eventType": "user_signup",
  "userId": "u_001",
  "timestamp": "2025-05-26T14:23:12Z",
  "properties": { "source": "ad_facebook" }
}
Estructura de métricas de entrada (manual, opcional):
json
Copy
Edit
{
  "metricName": "ARR",
  "value": 56900.10,
  "period": "2025",
  "unit": "USD",
  "metadata": { "source": "external_import" }
}
🔗 5. Procesamiento y cálculo de métricas
Eventos recibidos en api-writer se almacenan como raw events.

processor-worker ejecuta jobs periódicos para calcular:

Crecimiento: DAU, MAU

Monetización: MRR, ARR, LTV, CAC, ARPU

Engagement: Retención, churn

Conversión: Signups, pagos, upgrades

Custom: Métricas definidas por usuarios

Resultados se guardan para acceso rápido en api-reader.

🛡️ 6. Seguridad y autenticación
Autenticación centralizada con BetterAuth (OAuth/roles).

Acceso separado para administración (admin) y APIs públicas (api-writer, api-reader).

🧪 7. Testing y calidad
Cada app tiene su carpeta e2e para pruebas de extremo a extremo.

Uso de Jest para unit y integration tests.

⚙️ 8. Infraestructura local y herramientas
docker-compose.yml con Postgres y Redis.

Nx CLI para servir, construir y testear apps/libs.

Uso de nx graph para visualizar dependencias entre apps/libs.

🟢 9. Flujo de datos simplificado
Usuario/sistema envía evento → api-writer (POST)

Evento se almacena como raw event (DB)

processor-worker procesa eventos y calcula métricas (cron/queue)

api-reader expone métricas procesadas (GET)

admin gestiona configuración, usuarios, reglas, monitoreo, etc.

🚦 10. Siguiente paso sugerido
Crear documentación Markdown o Notion con este resumen.

Definir los primeros endpoints y DTOs.

Modelar los primeros jobs de procesamiento.

Definir tablas base en la base de datos para eventos y métricas.

> Implementation guide moved to AGENTS.md (canonical for future AI/code agents).
