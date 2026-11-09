# Cloud-Native DICOM Platform — Serverless Backend

Cloud-native DICOM ingestion pipeline and metadata catalog service built on **AWS Serverless** with **Go (Golang)** on **AWS Lambda**, **DynamoDB Single-Table Design**, **Amazon S3 Pre-signed URLs**, and **HTTP API Gateway v2**.

## Documentation & API

- **[OpenAPI 3.1 Specification](file:///Users/admin/tech/code/for_works/dicom_viewer/backend/docs/openapi.yaml)**: Complete API contract and data schemas.
- **[Bruno API Collection](file:///Users/admin/tech/code/for_works/dicom_viewer/backend/docs/api/bruno)**: Ready-to-use HTTP requests with Local and AWS environments.
- **[Architecture & Design Guide](file:///Users/admin/tech/code/for_works/dicom_viewer/backend/README.md)**: Mermaid architecture flow, Single-Table design schema, and engineering decisions.

## Quick Start (Terminal Only, Local DynamoDB & SAM API)

```bash
cd backend

# 1. Start local DynamoDB container
make local-db

# 2. Create the Single-Table schema (PK, SK, GSI1) via AWS CLI
make local-db-init

# 3. Seed test DICOM Study and Series items
make local-db-seed

# 4. Run SAM Local API (port 8080)
make local-api

# 5. Run Go unit tests
make test
```
