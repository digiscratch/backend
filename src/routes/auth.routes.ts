import { Router } from "express";
import { env } from "../config/env";
import { requireAuth } from "../middlewares/auth.middleware";
import { rateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { authService } from "../services/auth.service";
import { loginSchema, mfaSetupSchema, mfaVerifySchema, refreshSchema } from "../schemas/auth.schemas";

export const authRouter = Router();

authRouter.post(
  "/login",
  rateLimitMiddleware("login", env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, env.LOGIN_RATE_LIMIT_WINDOW_SECONDS),
  validateBody(loginSchema),
  async (request, response, next) => {
    try {
      const result = await authService.login(request.body.email, request.body.password, request);
      response.json(result);
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post("/mfa/setup", validateBody(mfaSetupSchema), async (request, response, next) => {
  try {
    const result = await authService.setupMfa(request.body.challengeToken, request);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/mfa/enable", validateBody(mfaVerifySchema), async (request, response, next) => {
  try {
    const result = await authService.enableMfa(
      request.body.challengeToken,
      request.body.code,
      request
    );
    response.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/mfa/verify", validateBody(mfaVerifySchema), async (request, response, next) => {
  try {
    const result = await authService.verifyMfa(
      request.body.challengeToken,
      request.body.code,
      request
    );
    response.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", validateBody(refreshSchema), async (request, response, next) => {
  try {
    const result = await authService.refresh(request.body.refreshToken, request);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", validateBody(refreshSchema), async (request, response, next) => {
  try {
    await authService.logout(request.body.refreshToken);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (request, response, next) => {
  try {
    const result = await authService.getMe(request.auth!.userId);
    response.json(result);
  } catch (error) {
    next(error);
  }
});
