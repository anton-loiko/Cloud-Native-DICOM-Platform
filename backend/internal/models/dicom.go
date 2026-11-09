package models

// Study represents a top-level DICOM study in DynamoDB
type Study struct {
	PK               string   `json:"pk" dynamodbav:"PK"`                             // STUDY#<StudyInstanceUID>
	SK               string   `json:"sk" dynamodbav:"SK"`                             // METADATA
	GSI1PK           string   `json:"gsi1pk" dynamodbav:"GSI1PK"`                     // PATIENT#<PatientID>
	GSI1SK           string   `json:"gsi1sk" dynamodbav:"GSI1SK"`                     // DATE#<StudyDate>
	StudyInstanceUID string   `json:"studyInstanceUid" dynamodbav:"studyInstanceUid"`
	PatientID        string   `json:"patientId" dynamodbav:"patientId"`
	PatientName      string   `json:"patientName" dynamodbav:"patientName"`
	StudyDate        string   `json:"studyDate" dynamodbav:"studyDate"`
	StudyDescription string   `json:"studyDescription" dynamodbav:"studyDescription"`
	Modalities       []string `json:"modalities" dynamodbav:"modalities"`             // e.g. ["CT", "MR"]
	SeriesCount      int      `json:"seriesCount" dynamodbav:"seriesCount"`
	TotalInstances   int      `json:"totalInstances" dynamodbav:"totalInstances"`
	CreatedAt        string   `json:"createdAt" dynamodbav:"createdAt"`
}

// Series represents a series of images/slices inside a study
type Series struct {
	PK                string `json:"pk" dynamodbav:"PK"`                               // STUDY#<StudyInstanceUID>
	SK                string `json:"sk" dynamodbav:"SK"`                               // SERIES#<SeriesInstanceUID>
	StudyInstanceUID  string `json:"studyInstanceUid" dynamodbav:"studyInstanceUid"`
	SeriesInstanceUID string `json:"seriesInstanceUid" dynamodbav:"seriesInstanceUid"`
	SeriesNumber      int    `json:"seriesNumber" dynamodbav:"seriesNumber"`
	SeriesDescription string `json:"seriesDescription" dynamodbav:"seriesDescription"`
	Modality          string `json:"modality" dynamodbav:"modality"`
	NumberOfInstances int    `json:"numberOfInstances" dynamodbav:"numberOfInstances"`
	BodyPartExamined  string `json:"bodyPartExamined,omitempty" dynamodbav:"bodyPartExamined,omitempty"`
}

// Instance represents an individual 2D slice (SOP Instance)
type Instance struct {
	PK                string    `json:"pk" dynamodbav:"PK"`                               // STUDY#<StudyInstanceUID>
	SK                string    `json:"sk" dynamodbav:"SK"`                               // INSTANCE#<SeriesInstanceUID>#<SOPInstanceUID>
	StudyInstanceUID  string    `json:"studyInstanceUid" dynamodbav:"studyInstanceUid"`
	SeriesInstanceUID string    `json:"seriesInstanceUid" dynamodbav:"seriesInstanceUid"`
	SOPInstanceUID    string    `json:"sopInstanceUid" dynamodbav:"sopInstanceUid"`
	InstanceNumber    int       `json:"instanceNumber" dynamodbav:"instanceNumber"`
	S3Bucket          string    `json:"s3Bucket" dynamodbav:"s3Bucket"`
	S3Key             string    `json:"s3Key" dynamodbav:"s3Key"`
	DownloadURL       string    `json:"downloadUrl,omitempty" dynamodbav:"-"`             // Ephemeral pre-signed S3 URL
	Rows              int       `json:"rows" dynamodbav:"rows"`
	Columns           int       `json:"columns" dynamodbav:"columns"`
	BitsAllocated     int       `json:"bitsAllocated" dynamodbav:"bitsAllocated"`
	WindowCenter      []float64 `json:"windowCenter,omitempty" dynamodbav:"windowCenter,omitempty"`
	WindowWidth       []float64 `json:"windowWidth,omitempty" dynamodbav:"windowWidth,omitempty"`
	RescaleIntercept  float64   `json:"rescaleIntercept" dynamodbav:"rescaleIntercept"`
	RescaleSlope      float64   `json:"rescaleSlope" dynamodbav:"rescaleSlope"`
	PixelSpacing      []float64 `json:"pixelSpacing,omitempty" dynamodbav:"pixelSpacing,omitempty"`
	ImagePosition     []float64 `json:"imagePosition,omitempty" dynamodbav:"imagePosition,omitempty"`
	ImageOrientation  []float64 `json:"imageOrientation,omitempty" dynamodbav:"imageOrientation,omitempty"`
}

// PresignedUploadRequest holds input params for requesting an S3 PUT upload URL
type PresignedUploadRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"contentType,omitempty"`
}

// PresignedUploadResponse returns the pre-signed S3 URL and S3 key
type PresignedUploadResponse struct {
	UploadURL string `json:"uploadUrl"`
	S3Key     string `json:"s3Key"`
	ExpiresIn int    `json:"expiresIn"` // In seconds (e.g. 900 for 15 min)
}
