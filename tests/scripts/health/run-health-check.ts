import "dotenv/config";
import { startTestServer } from "../_helpers/server";
import { assertStatus, jsonRequest } from "../_helpers/http";

interface HealthResponse {
  status: string;
  timestamp: string;
}

async function main() {
  const server = await startTestServer();

  try {
    const response = await jsonRequest<HealthResponse>(`${server.baseUrl}/health`);
    assertStatus(response.status, 200, "health");

    if (response.body.status !== "ok") {
      throw new Error(`health: expected body.status to be "ok", received "${response.body.status}"`);
    }

    if (!response.body.timestamp) {
      throw new Error("health: expected timestamp in response body");
    }

    console.log(JSON.stringify(response, null, 2));
    console.log("Health check passed.");
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error("Health check failed.");
  console.error(error);
  process.exitCode = 1;
});
