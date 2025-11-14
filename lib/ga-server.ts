const GA_ENDPOINT = "https://www.google-analytics.com/mp/collect";

type GAEvent = {
  name: string;
  params?: Record<string, unknown>;
};

export async function trackServerEvent(events: GAEvent[], clientId = "server") {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) {
    if (process.env.NODE_ENV === "development") {
      console.warn("GA4_MEASUREMENT_ID ou GA4_API_SECRET não configurados");
    }
    return;
  }

  const body = {
    client_id: clientId,
    events,
  };

  await fetch(
    `${GA_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}
