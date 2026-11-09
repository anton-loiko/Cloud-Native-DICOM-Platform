package parser

import (
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"dicom-backend/internal/models"

	"github.com/suyashkumar/dicom"
	"github.com/suyashkumar/dicom/pkg/tag"
)

// ExtractedMetadata contains the parsed DICOM hierarchy for a single uploaded slice
type ExtractedMetadata struct {
	Study    models.Study
	Series   models.Series
	Instance models.Instance
}

// ParseStream reads a DICOM stream and extracts the medical metadata without loading full pixel data
func ParseStream(r io.Reader, size int64, s3Bucket, s3Key string) (*ExtractedMetadata, error) {
	// Parse with SkipPixelData option for fast header extraction & minimal RAM
	dataset, err := dicom.Parse(r, size, nil, dicom.SkipPixelData())
	if err != nil {
		return nil, fmt.Errorf("failed to parse DICOM dataset: %w", err)
	}

	patientID := getString(&dataset, tag.PatientID)
	if patientID == "" {
		patientID = "ANONYMOUS"
	}
	patientName := getString(&dataset, tag.PatientName)
	if patientName == "" {
		patientName = "Anonymous Patient"
	}
	studyUID := getString(&dataset, tag.StudyInstanceUID)
	if studyUID == "" {
		return nil, fmt.Errorf("missing required tag (0020,000D) StudyInstanceUID")
	}
	studyDate := getString(&dataset, tag.StudyDate)
	if studyDate == "" {
		studyDate = time.Now().Format("20060102")
	}
	studyDesc := getString(&dataset, tag.StudyDescription)
	if studyDesc == "" {
		studyDesc = "DICOM Investigation"
	}

	seriesUID := getString(&dataset, tag.SeriesInstanceUID)
	if seriesUID == "" {
		seriesUID = fmt.Sprintf("%s.1", studyUID)
	}
	seriesDesc := getString(&dataset, tag.SeriesDescription)
	modality := getString(&dataset, tag.Modality)
	if modality == "" {
		modality = "OT"
	}
	sopInstanceUID := getString(&dataset, tag.SOPInstanceUID)
	if sopInstanceUID == "" {
		return nil, fmt.Errorf("missing required tag (0008,0018) SOPInstanceUID")
	}
	bodyPart := getString(&dataset, tag.BodyPartExamined)

	instanceNum := getInt(&dataset, tag.InstanceNumber)
	seriesNum := getInt(&dataset, tag.SeriesNumber)
	rows := getInt(&dataset, tag.Rows)
	cols := getInt(&dataset, tag.Columns)
	bitsAllocated := getInt(&dataset, tag.BitsAllocated)

	windowCenter := getFloatSlice(&dataset, tag.WindowCenter)
	windowWidth := getFloatSlice(&dataset, tag.WindowWidth)
	rescaleIntercept := getFloat(&dataset, tag.RescaleIntercept)
	rescaleSlope := getFloat(&dataset, tag.RescaleSlope)
	if rescaleSlope == 0.0 {
		rescaleSlope = 1.0
	}
	pixelSpacing := getFloatSlice(&dataset, tag.PixelSpacing)
	imagePos := getFloatSlice(&dataset, tag.ImagePositionPatient)
	imageOrient := getFloatSlice(&dataset, tag.ImageOrientationPatient)

	return &ExtractedMetadata{
		Study: models.Study{
			PK:               fmt.Sprintf("STUDY#%s", studyUID),
			SK:               "METADATA",
			GSI1PK:           fmt.Sprintf("PATIENT#%s", patientID),
			GSI1SK:           fmt.Sprintf("DATE#%s", studyDate),
			StudyInstanceUID: studyUID,
			PatientID:        patientID,
			PatientName:      patientName,
			StudyDate:        studyDate,
			StudyDescription: studyDesc,
			Modalities:       []string{modality},
			CreatedAt:        time.Now().UTC().Format(time.RFC3339),
		},
		Series: models.Series{
			PK:                fmt.Sprintf("STUDY#%s", studyUID),
			SK:                fmt.Sprintf("SERIES#%s", seriesUID),
			StudyInstanceUID:  studyUID,
			SeriesInstanceUID: seriesUID,
			SeriesNumber:      seriesNum,
			SeriesDescription: seriesDesc,
			Modality:          modality,
			BodyPartExamined:  bodyPart,
		},
		Instance: models.Instance{
			PK:                fmt.Sprintf("STUDY#%s", studyUID),
			SK:                fmt.Sprintf("INSTANCE#%s#%s", seriesUID, sopInstanceUID),
			StudyInstanceUID:  studyUID,
			SeriesInstanceUID: seriesUID,
			SOPInstanceUID:    sopInstanceUID,
			InstanceNumber:    instanceNum,
			S3Bucket:          s3Bucket,
			S3Key:             s3Key,
			Rows:              rows,
			Columns:           cols,
			BitsAllocated:     bitsAllocated,
			WindowCenter:      windowCenter,
			WindowWidth:       windowWidth,
			RescaleIntercept:  rescaleIntercept,
			RescaleSlope:      rescaleSlope,
			PixelSpacing:      pixelSpacing,
			ImagePosition:     imagePos,
			ImageOrientation:  imageOrient,
		},
	}, nil
}

func getString(dataset *dicom.Dataset, t tag.Tag) string {
	elem, err := dataset.FindElementByTag(t)
	if err != nil || elem == nil || elem.Value == nil {
		return ""
	}
	val := elem.Value.GetValue()
	if strSlice, ok := val.([]string); ok && len(strSlice) > 0 {
		return strings.TrimSpace(strSlice[0])
	}
	return strings.Trim(fmt.Sprintf("%v", val), "[] ")
}

func getInt(dataset *dicom.Dataset, t tag.Tag) int {
	elem, err := dataset.FindElementByTag(t)
	if err != nil || elem == nil || elem.Value == nil {
		return 0
	}
	val := elem.Value.GetValue()
	switch v := val.(type) {
	case []int:
		if len(v) > 0 {
			return v[0]
		}
	case int:
		return v
	case []string:
		if len(v) > 0 {
			n, _ := strconv.Atoi(strings.TrimSpace(v[0]))
			return n
		}
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(v))
		return n
	}
	s := strings.Trim(fmt.Sprintf("%v", val), "[] ")
	n, _ := strconv.Atoi(s)
	return n
}

func getFloat(dataset *dicom.Dataset, t tag.Tag) float64 {
	elem, err := dataset.FindElementByTag(t)
	if err != nil || elem == nil || elem.Value == nil {
		return 0.0
	}
	val := elem.Value.GetValue()
	switch v := val.(type) {
	case []float64:
		if len(v) > 0 {
			return v[0]
		}
	case float64:
		return v
	case []string:
		if len(v) > 0 {
			f, _ := strconv.ParseFloat(strings.TrimSpace(v[0]), 64)
			return f
		}
	case string:
		f, _ := strconv.ParseFloat(strings.TrimSpace(v), 64)
		return f
	}
	s := strings.Trim(fmt.Sprintf("%v", val), "[] ")
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func getFloatSlice(dataset *dicom.Dataset, t tag.Tag) []float64 {
	elem, err := dataset.FindElementByTag(t)
	if err != nil || elem == nil || elem.Value == nil {
		return nil
	}
	val := elem.Value.GetValue()
	if fSlice, ok := val.([]float64); ok {
		return fSlice
	}
	if strSlice, ok := val.([]string); ok {
		var res []float64
		for _, s := range strSlice {
			if f, err := strconv.ParseFloat(strings.TrimSpace(s), 64); err == nil {
				res = append(res, f)
			}
		}
		return res
	}
	str := strings.Trim(fmt.Sprintf("%v", val), "[] ")
	parts := strings.FieldsFunc(str, func(r rune) bool {
		return r == '\\' || r == '/' || r == ' '
	})
	var res []float64
	for _, p := range parts {
		if f, err := strconv.ParseFloat(p, 64); err == nil {
			res = append(res, f)
		}
	}
	return res
}
