// GET /api/metrics/:videoId
app.get("/api/metrics/:videoId", async (req, res) => {
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
