package repository

import (
	"context"
	"fmt"

	"dicom-backend/internal/models"
	"dicom-backend/internal/parser"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/expression"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// DicomRepository defines database operations for the DICOM catalog
type DicomRepository interface {
	SaveIngestedMetadata(ctx context.Context, meta *parser.ExtractedMetadata) error
	ListStudies(ctx context.Context, patientID string) ([]models.Study, error)
	GetSeriesForStudy(ctx context.Context, studyUID string) ([]models.Series, error)
	GetInstancesForSeries(ctx context.Context, studyUID, seriesUID string) ([]models.Instance, error)
}

type DynamoDBRepository struct {
	client    *dynamodb.Client
	tableName string
}

func NewDynamoDBRepository(client *dynamodb.Client, tableName string) *DynamoDBRepository {
	return &DynamoDBRepository{
		client:    client,
		tableName: tableName,
	}
}

// SaveIngestedMetadata writes the Instance, Series, and Study records
func (r *DynamoDBRepository) SaveIngestedMetadata(ctx context.Context, meta *parser.ExtractedMetadata) error {
	// 1. Put Instance
	avInstance, err := attributevalue.MarshalMap(meta.Instance)
	if err != nil {
		return fmt.Errorf("failed to marshal instance: %w", err)
	}
	_, err = r.client.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: aws.String(r.tableName),
		Item:      avInstance,
	})
	if err != nil {
		return fmt.Errorf("failed to put instance item: %w", err)
	}

	// 2. Put / Upsert Series
	avSeries, err := attributevalue.MarshalMap(meta.Series)
	if err == nil {
		_, _ = r.client.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(r.tableName),
			Item:      avSeries,
		})
	}

	// 3. Put / Upsert Study
	avStudy, err := attributevalue.MarshalMap(meta.Study)
	if err == nil {
		_, _ = r.client.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(r.tableName),
			Item:      avStudy,
		})
	}

	return nil
}

// ListStudies returns studies, filtered optionally by patient ID
func (r *DynamoDBRepository) ListStudies(ctx context.Context, patientID string) ([]models.Study, error) {
	if patientID != "" {
		// Fast query via GSI1
		keyCond := expression.KeyAnd(
			expression.Key("GSI1PK").Equal(expression.Value(fmt.Sprintf("PATIENT#%s", patientID))),
			expression.Key("GSI1SK").BeginsWith("DATE#"),
		)
		expr, err := expression.NewBuilder().WithKeyCondition(keyCond).Build()
		if err != nil {
			return nil, err
		}

		out, err := r.client.Query(ctx, &dynamodb.QueryInput{
			TableName:                 aws.String(r.tableName),
			IndexName:                 aws.String("GSI1"),
			KeyConditionExpression:    expr.KeyCondition(),
			ExpressionAttributeNames:  expr.Names(),
			ExpressionAttributeValues: expr.Values(),
		})
		if err != nil {
			return nil, err
		}

		var studies []models.Study
		err = attributevalue.UnmarshalListOfMaps(out.Items, &studies)
		return studies, err
	}

	// Scan with filter SK = METADATA
	filt := expression.Equal(expression.Name("SK"), expression.Value("METADATA"))
	expr, err := expression.NewBuilder().WithFilter(filt).Build()
	if err != nil {
		return nil, err
	}

	out, err := r.client.Scan(ctx, &dynamodb.ScanInput{
		TableName:                 aws.String(r.tableName),
		FilterExpression:          expr.Filter(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	})
	if err != nil {
		return nil, err
	}

	var studies []models.Study
	err = attributevalue.UnmarshalListOfMaps(out.Items, &studies)
	return studies, err
}

// GetSeriesForStudy queries all series belonging to a study
func (r *DynamoDBRepository) GetSeriesForStudy(ctx context.Context, studyUID string) ([]models.Series, error) {
	keyCond := expression.KeyAnd(
		expression.Key("PK").Equal(expression.Value(fmt.Sprintf("STUDY#%s", studyUID))),
		expression.Key("SK").BeginsWith("SERIES#"),
	)
	expr, err := expression.NewBuilder().WithKeyCondition(keyCond).Build()
	if err != nil {
		return nil, err
	}

	out, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:                 aws.String(r.tableName),
		KeyConditionExpression:    expr.KeyCondition(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	})
	if err != nil {
		return nil, err
	}

	var series []models.Series
	err = attributevalue.UnmarshalListOfMaps(out.Items, &series)
	return series, err
}

// GetInstancesForSeries queries all instances (slices) belonging to a series
func (r *DynamoDBRepository) GetInstancesForSeries(ctx context.Context, studyUID, seriesUID string) ([]models.Instance, error) {
	keyCond := expression.KeyAnd(
		expression.Key("PK").Equal(expression.Value(fmt.Sprintf("STUDY#%s", studyUID))),
		expression.Key("SK").BeginsWith(fmt.Sprintf("INSTANCE#%s#", seriesUID)),
	)
	expr, err := expression.NewBuilder().WithKeyCondition(keyCond).Build()
	if err != nil {
		return nil, err
	}

	out, err := r.client.Query(ctx, &dynamodb.QueryInput{
		TableName:                 aws.String(r.tableName),
		KeyConditionExpression:    expr.KeyCondition(),
		ExpressionAttributeNames:  expr.Names(),
		ExpressionAttributeValues: expr.Values(),
	})
	if err != nil {
		return nil, err
	}

	var instances []models.Instance
	err = attributevalue.UnmarshalListOfMaps(out.Items, &instances)
	return instances, err
}

