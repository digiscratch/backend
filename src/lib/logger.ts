import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.refreshToken",
      "req.body.code",
      "response.refreshToken",
      "response.accessToken",
      "response.challengeToken",
      "error.stack"
    ],
    censor: "[REDACTED]"
  }
});
