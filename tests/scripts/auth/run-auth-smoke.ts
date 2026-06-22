import "dotenv/config";
import { generateSync } from "otplib";
import { InternalUserRole, PrismaClient } from "@prisma/client";
import { authService } from "../../../src/services/auth.service";
import { startTestServer } from "../_helpers/server";
import { assert, assertStatus, jsonRequest } from "../_helpers/http";

interface LoginResponse {
  requiresMfa: boolean;
  mfaEnabled: boolean;
  challengeToken: string;
}

interface SetupResponse {
  otpauthUrl: string;
  secret: string;
}

interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresInMinutes: number;
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

const prisma = new PrismaClient();

async function prepareAuthUser() {
  const password = process.env.AUTH_TEST_PASSWORD ?? "AuthSmoke1.";
  const email =
    process.env.AUTH_TEST_EMAIL ??
    `juan.auth.smoke+${Date.now()}@example.com`;
  const name = process.env.AUTH_TEST_NAME ?? "Juan Auth Smoke";

  const user = await authService.seedSuperAdmin(name, email, password);

  await prisma.refreshToken.deleteMany({
    where: { userId: user.id }
  });

  await prisma.mfaSetting.deleteMany({
    where: { userId: user.id }
  });

  await prisma.internalUser.update({
    where: { id: user.id },
    data: {
      role: InternalUserRole.SUPER_ADMIN,
      mfaEnabled: false,
      isActive: true
    }
  });

  return { email, password, name };
}

async function main() {
  const credentials = await prepareAuthUser();
  const server = await startTestServer();

  try {
    console.log(`Running auth smoke tests against ${server.baseUrl}`);
    console.log(`Test user: ${credentials.email}`);

    const loginBeforeMfa = await jsonRequest<LoginResponse | ErrorResponse>(
      `${server.baseUrl}/auth/login`,
      {
        method: "POST",
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        })
      }
    );

    assertStatus(loginBeforeMfa.status, 200, "login before MFA");
    assert("challengeToken" in loginBeforeMfa.body, "login before MFA should return challengeToken");
    assert(loginBeforeMfa.body.requiresMfa === true, "login before MFA should require MFA");
    assert(loginBeforeMfa.body.mfaEnabled === false, "login before MFA should report mfaEnabled=false");

    const setup = await jsonRequest<SetupResponse | ErrorResponse>(
      `${server.baseUrl}/auth/mfa/setup`,
      {
        method: "POST",
        body: JSON.stringify({
          challengeToken: loginBeforeMfa.body.challengeToken
        })
      }
    );

    assertStatus(setup.status, 200, "mfa setup");
    assert("secret" in setup.body, "mfa setup should return secret");
    assert(setup.body.otpauthUrl.startsWith("otpauth://"), "mfa setup should return otpauth URL");

    const enableCode = generateSync({
      secret: setup.body.secret,
      period: 30
    });

    const enable = await jsonRequest<SessionResponse | ErrorResponse>(
      `${server.baseUrl}/auth/mfa/enable`,
      {
        method: "POST",
        body: JSON.stringify({
          challengeToken: loginBeforeMfa.body.challengeToken,
          code: enableCode
        })
      }
    );

    assertStatus(enable.status, 200, "mfa enable");
    assert("accessToken" in enable.body, "mfa enable should return access token");

    const me = await fetch(`${server.baseUrl}/auth/me`, {
      headers: {
        authorization: `Bearer ${enable.body.accessToken}`
      }
    });

    assertStatus(me.status, 200, "auth me after enable");
    const meBody = (await me.json()) as {
      email: string;
      role: string;
      mfaEnabled: boolean;
    };
    assert(meBody.email === credentials.email, "auth me should return the created user");
    assert(meBody.mfaEnabled === true, "auth me should return mfaEnabled=true");

    const loginAfterMfa = await jsonRequest<LoginResponse | ErrorResponse>(
      `${server.baseUrl}/auth/login`,
      {
        method: "POST",
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        })
      }
    );

    assertStatus(loginAfterMfa.status, 200, "login after MFA");
    assert("challengeToken" in loginAfterMfa.body, "login after MFA should return challengeToken");
    assert(loginAfterMfa.body.mfaEnabled === true, "login after MFA should report mfaEnabled=true");

    const verifyCode = generateSync({
      secret: setup.body.secret,
      period: 30
    });

    const verify = await jsonRequest<SessionResponse | ErrorResponse>(
      `${server.baseUrl}/auth/mfa/verify`,
      {
        method: "POST",
        body: JSON.stringify({
          challengeToken: loginAfterMfa.body.challengeToken,
          code: verifyCode
        })
      }
    );

    assertStatus(verify.status, 200, "mfa verify");
    assert("refreshToken" in verify.body, "mfa verify should return refresh token");

    const refresh = await jsonRequest<SessionResponse | ErrorResponse>(
      `${server.baseUrl}/auth/refresh`,
      {
        method: "POST",
        body: JSON.stringify({
          refreshToken: verify.body.refreshToken
        })
      }
    );

    assertStatus(refresh.status, 200, "refresh token");
    assert("accessToken" in refresh.body, "refresh should return a new access token");

    const logout = await fetch(`${server.baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        refreshToken: refresh.body.refreshToken
      })
    });

    assertStatus(logout.status, 204, "logout");

    const refreshAfterLogout = await jsonRequest<SessionResponse | ErrorResponse>(
      `${server.baseUrl}/auth/refresh`,
      {
        method: "POST",
        body: JSON.stringify({
          refreshToken: refresh.body.refreshToken
        })
      }
    );

    assertStatus(refreshAfterLogout.status, 401, "refresh after logout should fail");
    assert(
      "error" in refreshAfterLogout.body && refreshAfterLogout.body.error.code === "INVALID_REFRESH_TOKEN",
      "refresh after logout should return INVALID_REFRESH_TOKEN"
    );

    console.log("Auth smoke tests passed.");
  } finally {
    await server.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Auth smoke tests failed.");
  console.error(error);
  process.exitCode = 1;
});
