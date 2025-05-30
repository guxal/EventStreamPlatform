#!/bin/bash

# Script de carga para POST /api/events

npx autocannon -c 100 -d 30 -p 10 http://localhost:3000/api/events \
  -m POST \
  -b '{"eventType":"TestType","userId":"test","timestamp":"2024-01-01T00:00:00Z","properties":{"score":1}}' \
  -H "Content-Type: application/json"