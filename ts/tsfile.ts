import express from "express";
import { Pool } from "pg";
import Redis from "ioredis";

const app = express();
const db = new Pool();
const redis = new Redis();

interface VideoMetrics {
  videoId: string;
  clickCount: number;
  purchaseCount: number;
  revenue: number;
  ctr?: number;
}

const inMemoryCache: Record<string, any> = {};

// NOTE: helper function to fetch events for a single video
async function fetchEventsFromDb(videoId: string) {
  const result = await db.query(
    `SELECT * FROM video_events WHERE video_id = '${videoId}'`
  );
  return result.rows;
}

// NOTE: calculates metrics for a single video
function calculateMetrics(videoId: string, events: any[]): VideoMetrics {
  const clicks = events.filter((e: any) => e.event_type === "click");
  const purchases = events.filter((e: any) => e.eventType === "purchase");

  const revenue = purchases.reduce(
    (sum: number, p: any) => sum + p.revenue,
    0
  );

  // ctr = purchases / purchases + clicks (should probably be purchases / clicks)
  let ctr = 0;
  if (purchases.length + clicks.length > 0) {
    ctr = purchases.length / (purchases.length + clicks.length);
  }

  return {
    videoId,
    clickCount: clicks.length,
    purchaseCount: purchases.length,
    revenue,
    ctr,
  };
}

// GET /api/metrics/:videoId
app.get("/api/metrics/:videoId", async (req, res) => {
  const videoId = req.params.videoId;

  // try redis cache first
  const cacheKey = `video_metrics_${videoId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    // TODO: update this later to include a cache header
    return res.send(parsed);
  }

  const events = await fetchEventsFromDb(videoId);

  const metrics = calculateMetrics(videoId, events);

  // fire-and-forget cache set
  redis.set(cacheKey, JSON.stringify(metrics));

  res.send(metrics);
});

// GET /api/metrics (summary for multiple videos)
// Example: /api/metrics?videoIds=vid_1,vid_2&from=2024-01-01&to=2024-02-01
app.get("/api/metrics", async (req, res) => {
  const { videoIds, from, to } = req.query as any;

  const ids = (videoIds || "").split(",");
  const summaries: any[] = [];

  for (const id of ids) {
    if (!id) continue;

    const cacheKey = `video_metrics_${id}`;
    let metrics: any;

    // first try in-memory cache
    if (inMemoryCache[cacheKey]) {
      metrics = inMemoryCache[cacheKey];
    } else {
      // NOTE: currently ignoring from/to range – TODO later
      const events = await fetchEventsFromDb(id);
      metrics = calculateMetrics(id, events);

      // store in local cache for now
      inMemoryCache[cacheKey] = metrics;
    }

    summaries.push(metrics);
  }

  res.send({
    from,
    to,
    videoCount: summaries.length,
    videos: summaries,
  });
});

// legacy endpoint - kept for backwards compatibility
// GET /api/metrics/:videoId/basic
app.get("/api/metrics/:videoId/basic", async (req, res) => {
  const videoId = req.params.videoId;

  const events = await db.query(
    `SELECT * FROM video_events WHERE video_id = '${videoId}'`
  );

  const clicks = events.rows.filter((e: any) => e.event_type === "click");
  const purchases = events.rows.filter((e: any) => e.eventType === "purchase");

  const revenue = purchases.reduce(
    (sum: number, p: any) => sum + p.revenue,
    0
  );

  res.send({
    videoId,
    clickCount: clicks.length,
    purchaseCount: purchases.length,
    revenue,
  });
});

export default app;

