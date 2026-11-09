.PHONY: build test clean sam-build local-db local-db-init local-db-seed local-db-down local-api

ARCH ?= amd64
TABLE_NAME ?= hold-my-coffee-metadata
REGION ?= us-east-2
LOCAL_ENDPOINT ?= http://localhost:8000
DOCKER_NETWORK ?= sam-network

test:
	go test -v ./...

build-IngestFunction:
	GOOS=linux GOARCH=$(ARCH) CGO_ENABLED=0 go build -tags lambda.norpc -ldflags="-s -w" -o $(ARTIFACTS_DIR)/bootstrap ./lambdas/ingest

build-ApiFunction:
	GOOS=linux GOARCH=$(ARCH) CGO_ENABLED=0 go build -tags lambda.norpc -ldflags="-s -w" -o $(ARTIFACTS_DIR)/bootstrap ./lambdas/api

sam-build:
	sam build

clean:
	rm -rf .aws-sam

# -------------------------------------------------------------
# Local DynamoDB Automation (Docker-based, terminal only)
# -------------------------------------------------------------
local-db:
	@docker network inspect $(DOCKER_NETWORK) >/dev/null 2>&1 || docker network create $(DOCKER_NETWORK)
	@docker run -d --name dynamodb-local --network $(DOCKER_NETWORK) -p 8000:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -inMemory || true
	@echo " DynamoDB Local is running on $(LOCAL_ENDPOINT) in network $(DOCKER_NETWORK)"

local-db-init:
	@echo "Creating table $(TABLE_NAME) with Single Table Schema (PK, SK, GSI1)..."
	aws dynamodb create-table \
		--table-name $(TABLE_NAME) \
		--attribute-definitions \
			AttributeName=PK,AttributeType=S \
			AttributeName=SK,AttributeType=S \
			AttributeName=GSI1PK,AttributeType=S \
			AttributeName=GSI1SK,AttributeType=S \
		--key-schema \
			AttributeName=PK,KeyType=HASH \
			AttributeName=SK,KeyType=RANGE \
		--global-secondary-indexes \
			"[{\"IndexName\":\"GSI1\",\"KeySchema\":[{\"AttributeName\":\"GSI1PK\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"GSI1SK\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}]" \
		--billing-mode PAY_PER_REQUEST \
		--endpoint-url $(LOCAL_ENDPOINT) \
		--region $(REGION)
	@echo " Table $(TABLE_NAME) created successfully in DynamoDB Local."

local-db-seed:
	@echo "Seeding sample CT study into $(TABLE_NAME)..."
	aws dynamodb put-item \
		--table-name $(TABLE_NAME) \
		--item '{"PK":{"S":"STUDY#1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463"},"SK":{"S":"METADATA"},"GSI1PK":{"S":"PATIENT#PAT-00941"},"GSI1SK":{"S":"DATE#20260312"},"studyInstanceUid":{"S":"1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463"},"patientId":{"S":"PAT-00941"},"patientName":{"S":"Kovacs^Alexander"},"studyDate":{"S":"20260312"},"studyDescription":{"S":"CT Chest with IV Contrast (High-Res Pulm)"},"modalities":{"L":[{"S":"CT"}]},"seriesCount":{"N":"1"},"totalInstances":{"N":"10"},"createdAt":{"S":"2026-11-09T00:00:00Z"}}' \
		--endpoint-url $(LOCAL_ENDPOINT) \
		--region $(REGION)
	@aws dynamodb put-item \
		--table-name $(TABLE_NAME) \
		--item '{"PK":{"S":"STUDY#1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463"},"SK":{"S":"SERIES#1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463.1"},"studyInstanceUid":{"S":"1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463"},"seriesInstanceUid":{"S":"1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463.1"},"seriesNumber":{"N":"1"},"seriesDescription":{"S":"Axial Soft Tissue 2.5mm"},"modality":{"S":"CT"},"numberOfInstances":{"N":"10"},"bodyPartExamined":{"S":"CHEST"}}' \
		--endpoint-url $(LOCAL_ENDPOINT) \
		--region $(REGION)
	@echo " Sample study seeded into DynamoDB Local."

local-db-down:
	@docker rm -f dynamodb-local 2>/dev/null || true
	@echo " DynamoDB Local stopped."

local-api:
	sam local start-api --docker-network $(DOCKER_NETWORK) --env-vars local-env.json --port 8080
