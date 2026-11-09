package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"dicom-backend/internal/models"
	"dicom-backend/internal/repository"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type ApiHandler struct {
	repo            repository.DicomRepository
	s3PresignClient *s3.PresignClient
	bucketName      string
}

func NewApiHandler(ctx context.Context) (*ApiHandler, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	tableName := os.Getenv("DYNAMODB_TABLE_NAME")
	if tableName == "" {
		return nil, fmt.Errorf("missing required environment variable: DYNAMODB_TABLE_NAME")
	}
	bucketName := os.Getenv("S3_BUCKET_NAME")
	if bucketName == "" {
		return nil, fmt.Errorf("missing required environment variable: S3_BUCKET_NAME")
	}
	s3Client := s3.NewFromConfig(cfg)

	endpoint := os.Getenv("DYNAMODB_ENDPOINT")
	log.Printf("DynamoDB Config: table=%s endpoint=%s", tableName, endpoint)

	var dynamoOptFns []func(*dynamodb.Options)
	if endpoint != "" {
		dynamoOptFns = append(dynamoOptFns, func(o *dynamodb.Options) {
			o.BaseEndpoint = aws.String(endpoint)
		})
	}
	dynamoClient := dynamodb.NewFromConfig(cfg, dynamoOptFns...)

	return &ApiHandler{
		repo:            repository.NewDynamoDBRepository(dynamoClient, tableName),
		s3PresignClient: s3.NewPresignClient(s3Client),
		bucketName:      bucketName,
	}, nil
}

func corsHeaders() map[string]string {
	return map[string]string{
		"Content-Type":                 "application/json",
		"Access-Control-Allow-Origin":  "*",
		"Access-Control-Allow-Headers": "Content-Type,Authorization",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	}
}

func jsonResponse(statusCode int, body interface{}) (events.APIGatewayV2HTTPResponse, error) {
	bytes, _ := json.Marshal(body)
	return events.APIGatewayV2HTTPResponse{
		StatusCode: statusCode,
		Headers:    corsHeaders(),
		Body:       string(bytes),
	}, nil
}

func (h *ApiHandler) Router(ctx context.Context, req events.APIGatewayV2HTTPRequest) (events.APIGatewayV2HTTPResponse, error) {
	path := req.RawPath
	method := req.RequestContext.HTTP.Method

	if method == "OPTIONS" {
		return events.APIGatewayV2HTTPResponse{
			StatusCode: http.StatusOK,
			Headers:    corsHeaders(),
		}, nil
	}

	log.Printf("HTTP %s %s", method, path)

	// 1. POST /api/upload-url: Generate Pre-signed PUT URL for direct S3 ingestion
	if method == "POST" && strings.HasSuffix(path, "/upload-url") {
		var uploadReq models.PresignedUploadRequest
		_ = json.Unmarshal([]byte(req.Body), &uploadReq)
		if uploadReq.Filename == "" {
			uploadReq.Filename = fmt.Sprintf("dicom_%d.dcm", time.Now().UnixNano())
		}
		key := fmt.Sprintf("raw/%d_%s", time.Now().Unix(), uploadReq.Filename)

		presignedPut, err := h.s3PresignClient.PresignPutObject(ctx, &s3.PutObjectInput{
			Bucket: aws.String(h.bucketName),
			Key:    aws.String(key),
		}, s3.WithPresignExpires(15*time.Minute))
		if err != nil {
			return jsonResponse(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return jsonResponse(http.StatusOK, models.PresignedUploadResponse{
			UploadURL: presignedPut.URL,
			S3Key:     key,
			ExpiresIn: 900,
		})
	}

	// 2. GET /api/studies: List studies (with optional ?patientId=...)
	if method == "GET" && strings.HasSuffix(path, "/studies") {
		patientID := req.QueryStringParameters["patientId"]
		studies, err := h.repo.ListStudies(ctx, patientID)
		if err != nil {
			return jsonResponse(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		if studies == nil {
			studies = []models.Study{}
		}
		return jsonResponse(http.StatusOK, studies)
	}

	// 3. GET /api/studies/{studyUid}/series/{seriesUid}/instances
	if method == "GET" && strings.Contains(path, "/instances") {
		parts := strings.Split(path, "/")
		studyUID, seriesUID := "", ""
		for i, p := range parts {
			if p == "studies" && i+1 < len(parts) {
				studyUID = parts[i+1]
			}
			if p == "series" && i+1 < len(parts) {
				seriesUID = parts[i+1]
			}
		}

		instances, err := h.repo.GetInstancesForSeries(ctx, studyUID, seriesUID)
		if err != nil {
			return jsonResponse(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		// Enrich each instance with a pre-signed GET URL for streaming into Cornerstone3D
		for i := range instances {
			presignGet, _ := h.s3PresignClient.PresignGetObject(ctx, &s3.GetObjectInput{
				Bucket: aws.String(instances[i].S3Bucket),
				Key:    aws.String(instances[i].S3Key),
			}, s3.WithPresignExpires(1*time.Hour))

			if presignGet != nil {
				instances[i].DownloadURL = presignGet.URL
			}
		}

		return jsonResponse(http.StatusOK, instances)
	}

	// 4. GET /api/studies/{studyUid}/series
	if method == "GET" && strings.Contains(path, "/studies/") && strings.HasSuffix(path, "/series") {
		parts := strings.Split(path, "/")
		studyUID := ""
		for i, p := range parts {
			if p == "studies" && i+1 < len(parts) {
				studyUID = parts[i+1]
				break
			}
		}

		series, err := h.repo.GetSeriesForStudy(ctx, studyUID)
		if err != nil {
			return jsonResponse(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		if series == nil {
			series = []models.Series{}
		}
		return jsonResponse(http.StatusOK, series)
	}

	return jsonResponse(http.StatusNotFound, map[string]string{"error": "Route not found"})
}

func main() {
	ctx := context.Background()
	handler, err := NewApiHandler(ctx)
	if err != nil {
		log.Fatalf("Fatal: unable to initialize API handler: %v", err)
	}
	lambda.Start(handler.Router)
}

