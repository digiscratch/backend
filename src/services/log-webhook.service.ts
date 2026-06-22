import { env } from "../config/env";
import { logger } from "../lib/logger";

export class LogWebhookService {
  async send(event: Record<string, unknown>): Promise<void> {
    if (!env.LOG_WEBHOOK_URL) {
      return;
    }

    try {
      await fetch(env.LOG_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      logger.warn({ error }, "Failed to deliver critical log webhook");
    }
  }
}

export const logWebhookService = new LogWebhookService();
