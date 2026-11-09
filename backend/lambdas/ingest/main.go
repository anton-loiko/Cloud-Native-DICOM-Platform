package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"dicom-backend/internal/parser"
	"dicom-backend/internal/repository"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type IngestionHandler struct {
	s3Client *s3.Client
	repo     repository.DicomRepository
}

func NewIngestionHandler(ctx context.Context) (*IngestionHandler, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	tableName := os.Getenv("DYNAMODB_TABLE_NAME")
	if tableName == "" {
		return nil, fmt.Errorf("missing required environment variable: DYNAMODB_TABLE_NAME")
	}
	var dynamoOptFns []func(*dynamodb.Options)
	if endpoint := os.Getenv("DYNAMODB_ENDPOINT"); endpoint != "" {
		dynamoOptFns = append(dynamoOptFns, func(o *dynamodb.Options) {
			o.BaseEndpoint = aws.String(endpoint)
		})
	}
	dynamoClient := dynamodb.NewFromConfig(cfg, dynamoOptFns...)

	return &IngestionHandler{
		s3Client: s3.NewFromConfig(cfg),
		repo:     repository.NewDynamoDBRepository(dynamoClient, tableName),
	}, nil
}

func (h *IngestionHandler) Handle(ctx context.Context, s3Event events.S3Event) error {
	for _, record := range s3Event.Records {
		bucket := record.S3.Bucket.Name
		key := record.S3.Object.Key

		log.Printf("📥 Processing S3 record: s3://%s/%s", bucket, key)

		obj, err := h.s3Client.GetObject(ctx, &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			log.Printf("❌ Failed to fetch s3://%s/%s: %v", bucket, key, err)
			continue
		}
		defer obj.Body.Close()

		contentLength := int64(0)
		if obj.ContentLength != nil {
			contentLength = *obj.ContentLength
		}

		metadata, err := parser.ParseStream(obj.Body, contentLength, bucket, key)
		if err != nil {
			log.Printf("❌ Failed to parse DICOM s3://%s/%s: %v", bucket, key, err)
			continue
		}

		if err := h.repo.SaveIngestedMetadata(ctx, metadata); err != nil {
			log.Printf("❌ Failed to save metadata for %s: %v", metadata.Instance.SOPInstanceUID, err)
			continue
		}

		log.Printf("✅ Indexed DICOM SOPInstanceUID=%s StudyUID=%s SeriesUID=%s",
			metadata.Instance.SOPInstanceUID, metadata.Study.StudyInstanceUID, metadata.Series.SeriesInstanceUID)
	}
	return nil
}

func main() {
	ctx := context.Background()
	handler, err := NewIngestionHandler(ctx)
	if err != nil {
		log.Fatalf("Fatal: unable to initialize ingestion handler: %v", err)
	}
	lambda.Start(handler.Handle)
}

