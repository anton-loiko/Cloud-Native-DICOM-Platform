package main

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"dicom-backend/internal/models"
	"dicom-backend/internal/parser"

	"github.com/aws/aws-lambda-go/events"
)

type mockRepo struct {
	studies []models.Study
}

func (m *mockRepo) SaveIngestedMetadata(ctx context.Context, meta *parser.ExtractedMetadata) error {
	return nil
}

func (m *mockRepo) ListStudies(ctx context.Context, patientID string) ([]models.Study, error) {
	return m.studies, nil
}

func (m *mockRepo) GetSeriesForStudy(ctx context.Context, studyUID string) ([]models.Series, error) {
	return []models.Series{
		{
			StudyInstanceUID:  studyUID,
			SeriesInstanceUID: studyUID + ".1",
			SeriesNumber:      1,
			Modality:          "CT",
			NumberOfInstances: 10,
		},
	}, nil
}

func (m *mockRepo) GetInstancesForSeries(ctx context.Context, studyUID, seriesUID string) ([]models.Instance, error) {
	return []models.Instance{
		{
			StudyInstanceUID:  studyUID,
			SeriesInstanceUID: seriesUID,
			SOPInstanceUID:    seriesUID + ".1",
			InstanceNumber:    1,
			S3Bucket:          "test-bucket",
			S3Key:             "raw/slice1.dcm",
		},
	}, nil
}

func TestApiHandler_ListStudies(t *testing.T) {
	handler := &ApiHandler{
		repo: &mockRepo{
			studies: []models.Study{
				{
					StudyInstanceUID: "1.2.3.4",
					PatientID:        "PAT-001",
					PatientName:      "Smith^John",
					Modalities:       []string{"CT"},
				},
			},
		},
		bucketName: "test-bucket",
	}

	req := events.APIGatewayV2HTTPRequest{
		RawPath: "/api/studies",
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "GET",
			},
		},
	}

	resp, err := handler.Router(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}

	var studies []models.Study
	_ = json.Unmarshal([]byte(resp.Body), &studies)
	if len(studies) != 1 || studies[0].PatientID != "PAT-001" {
		t.Errorf("unexpected studies response: %v", studies)
	}
}

func TestApiHandler_RouteNotFound(t *testing.T) {
	handler := &ApiHandler{
		repo:       &mockRepo{},
		bucketName: "test-bucket",
	}

	req := events.APIGatewayV2HTTPRequest{
		RawPath: "/api/nonexistent",
		RequestContext: events.APIGatewayV2HTTPRequestContext{
			HTTP: events.APIGatewayV2HTTPRequestContextHTTPDescription{
				Method: "GET",
			},
		},
	}

	resp, err := handler.Router(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("expected 404 Not Found, got %d", resp.StatusCode)
	}
}

