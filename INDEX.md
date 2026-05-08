# AI Platform Documentation Index

## Overview

This repository contains one deployed AI platform:

- [README.md](/c:/users/administrator/coding/ai-platform/README.md) for the top-level product summary
- [docker-compose.unified.yml](/c:/users/administrator/coding/ai-platform/docker-compose.unified.yml) for the deployed service stack
- [ARCHITECTURE.md](/c:/users/administrator/coding/ai-platform/ARCHITECTURE.md) for the platform topology and request flow
- [manage.sh](/c:/users/administrator/coding/ai-platform/manage.sh) for operational tasks

## Active Apps

- [customer-portal/](/c:/users/administrator/coding/ai-platform/customer-portal) for customer signup, billing, usage, and API key management
- [OmniRoute/](/c:/users/administrator/coding/ai-platform/OmniRoute) for the admin dashboard, API gateway, routing, and backend account management

## Platform Docs

- [ARCHITECTURE.md](/c:/users/administrator/coding/ai-platform/ARCHITECTURE.md) for the full system diagram
- [DEPLOYMENT.md](/c:/users/administrator/coding/ai-platform/DEPLOYMENT.md) for environment and rollout guidance
- [README_POOLING.md](/c:/users/administrator/coding/ai-platform/README_POOLING.md) for the pooling subsystem summary
- [QUICKSTART_POOLING.md](/c:/users/administrator/coding/ai-platform/QUICKSTART_POOLING.md) for the pooling setup steps
- [INTEGRATION_COMPLETE.md](/c:/users/administrator/coding/ai-platform/INTEGRATION_COMPLETE.md) for the pooling implementation status
- [IMPLEMENTATION_SUMMARY.md](/c:/users/administrator/coding/ai-platform/IMPLEMENTATION_SUMMARY.md) for the integration details
- [CHANGES.md](/c:/users/administrator/coding/ai-platform/CHANGES.md) for the change log

## Support Files

- [test-pooling.mjs](/c:/users/administrator/coding/ai-platform/test-pooling.mjs) for a quick pooling verification script
- [DEPENDENCIES.md](/c:/users/administrator/coding/ai-platform/DEPENDENCIES.md) for the dependency notes
- [nginx/nginx.conf](/c:/users/administrator/coding/ai-platform/nginx/nginx.conf) for edge routing and TLS

## Layout

```
ai-platform/
├── README.md
├── ARCHITECTURE.md
├── INDEX.md
├── DEPLOYMENT.md
├── README_POOLING.md
├── QUICKSTART_POOLING.md
├── INTEGRATION_COMPLETE.md
├── IMPLEMENTATION_SUMMARY.md
├── CHANGES.md
├── DEPENDENCIES.md
├── manage.sh
├── setup.sh
├── docker-compose.unified.yml
├── nginx/
├── OmniRoute/
└── customer-portal/
```

## Notes

- The old `augment2api`, `nvidia-balance`, and `plexus` subprojects are no longer part of the unified deployment.
- The root docs focus on the active stack only; subsystem-specific details live under `OmniRoute/docs/` or the pooling docs at the root.
