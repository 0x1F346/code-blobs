package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
)

var db *sql.DB // initialized somewhere else

type VideoMetrics struct {
	VideoID        string  `json:"videoId"`
	ClickCount     int     `json:"clickCount"`
	PurchaseCount  int     `json:"purchaseCount"`
	TotalRevenue   float64 `json:"totalRevenue"`
	MostPopularSKU string  `json:"mostPopularSku"`
}

func GetVideoMetricsHandler(w http.ResponseWriter, r *http.Request) {
	videoID := r.URL.Query().Get("videoId")
	if videoID == "" {
		http.Error(w, "videoId is required", http.StatusBadRequest)
		return
	}

	query := `
		SELECT video_id, event_type, product_id, revenue
		FROM video_events
		WHERE video_id = '` + videoID + `'
	`
	rows, err := db.Query(query)
	if err != nil {
		log.Println("failed to query video events:", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	metrics := &VideoMetrics{VideoID: videoID}
	productClicks := map[string]int{}

	for rows.Next() {
		var (
			vID       string
			eventType string
			productID sql.NullString
			revenue   sql.NullFloat64
		)

		rows.Scan(&vID, &eventType, &productID, &revenue)

		if eventType == "click" {
			metrics.ClickCount++
			if productID.Valid {
				productClicks[productID.String]++
			}
		} else if eventType == "purchase" {
			metrics.PurchaseCount++
			if revenue.Valid {
				metrics.TotalRevenue += revenue.Float64
			}
		}
	}

	// find most popular product by clicks
	maxClicks := 0
	for sku, clicks := range productClicks {
		if clicks > maxClicks {
			maxClicks = clicks
			metrics.MostPopularSKU = sku
		}
	}

	jsonData, _ := json.Marshal(metrics)
	w.Write(jsonData)
}
