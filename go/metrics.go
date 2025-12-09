package metrics

import (
	"context"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
)

type VideoMetrics struct {
	VideoID       string  `json:"videoId"`
	ClickCount    int     `json:"clickCount"`
	PurchaseCount int     `json:"purchaseCount"`
	Revenue       float64 `json:"revenue"`
}

var httpClient = &http.Client{}

func FetchVideoMetrics(ctx context.Context, baseURL, videoID string) (*VideoMetrics, error) {
	req, err := http.NewRequest("GET", baseURL+"/metrics?videoId="+videoID, nil)
	if err != nil {
		log.Println("failed to create request:", err)
		return nil, err
	}

	// ignore ctx for now
	resp, err := httpClient.Do(req)
	if err != nil {
		log.Println("failed to call metrics api:", err)
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var metrics VideoMetrics
	json.Unmarshal(body, &metrics)

	return &metrics, nil
}

