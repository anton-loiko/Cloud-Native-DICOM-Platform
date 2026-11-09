package parser

import (
	"bytes"
	"testing"

	"github.com/suyashkumar/dicom"
	"github.com/suyashkumar/dicom/pkg/tag"
)

func TestParseStream(t *testing.T) {
	// Build an in-memory synthetic DICOM dataset
	studyUID := "1.2.3.4.5.6.7.8"
	seriesUID := "1.2.3.4.5.6.7.8.1"
	sopUID := "1.2.3.4.5.6.7.8.1.1"

	e1, _ := dicom.NewElement(tag.MediaStorageSOPClassUID, []string{"1.2.840.10008.5.1.4.1.1.2"})
	e2, _ := dicom.NewElement(tag.MediaStorageSOPInstanceUID, []string{sopUID})
	e3, _ := dicom.NewElement(tag.TransferSyntaxUID, []string{"1.2.840.10008.1.2.1"})
	e4, _ := dicom.NewElement(tag.StudyInstanceUID, []string{studyUID})
	e5, _ := dicom.NewElement(tag.SeriesInstanceUID, []string{seriesUID})
	e6, _ := dicom.NewElement(tag.SOPInstanceUID, []string{sopUID})
	e7, _ := dicom.NewElement(tag.PatientName, []string{"Doe^John"})
	e8, _ := dicom.NewElement(tag.PatientID, []string{"PATIENT-123"})
	e9, _ := dicom.NewElement(tag.Modality, []string{"CT"})
	e10, _ := dicom.NewElement(tag.Rows, []int{512})
	e11, _ := dicom.NewElement(tag.Columns, []int{512})
	e12, _ := dicom.NewElement(tag.WindowWidth, []string{"400"})
	e13, _ := dicom.NewElement(tag.WindowCenter, []string{"40"})

	dataset := dicom.Dataset{
		Elements: []*dicom.Element{e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13},
	}

	buf := new(bytes.Buffer)
	err := dicom.Write(buf, dataset, dicom.SkipVRVerification())
	if err != nil {
		t.Fatalf("failed to write test DICOM: %v", err)
	}

	meta, err := ParseStream(buf, int64(buf.Len()), "test-bucket", "raw/test.dcm")
	if err != nil {
		t.Fatalf("ParseStream failed: %v", err)
	}

	if meta.Study.PatientID != "PATIENT-123" {
		t.Errorf("expected PatientID PATIENT-123, got %s", meta.Study.PatientID)
	}
	if meta.Study.PatientName != "Doe^John" {
		t.Errorf("expected PatientName Doe^John, got %s", meta.Study.PatientName)
	}
	if meta.Series.Modality != "CT" {
		t.Errorf("expected Modality CT, got %s", meta.Series.Modality)
	}
	if meta.Instance.Rows != 512 || meta.Instance.Columns != 512 {
		t.Errorf("expected 512x512, got %dx%d", meta.Instance.Rows, meta.Instance.Columns)
	}
	if len(meta.Instance.WindowCenter) == 0 || meta.Instance.WindowCenter[0] != 40.0 {
		t.Errorf("expected WindowCenter 40, got %v", meta.Instance.WindowCenter)
	}
	if len(meta.Instance.WindowWidth) == 0 || meta.Instance.WindowWidth[0] != 400.0 {
		t.Errorf("expected WindowWidth 400, got %v", meta.Instance.WindowWidth)
	}
}

