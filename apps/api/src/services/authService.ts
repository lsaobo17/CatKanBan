import type { LoginRequest, UserSummary } from "../../../../packages/shared/src/index.js";
import { UnauthorizedError, ValidationError } from "../errors.js";
import type { UserRepository } from "../repositories/userRepository.js";
import { normalizeUsername } from "../repositories/userRepository.js";
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./security.js";

export const SESSION_COOKIE_NAME = "catkanban_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async seedAdmin(input: { name: string; password: string; username: string }) {
    const passwordHash = await hashPassword(input.password);
    return this.users.seedAdmin({
      name: input.name.trim(),
      passwordHash,
      username: normalizeUsername(input.username)
    });
  }

  async login(body: unknown) {
    const input = parseLogin(body);
    const user = await this.users.findByUsername(input.username);
    if (!user || !user.isActive || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid username or password");
    }

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.users.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt
    });

    return {
      token,
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      expiresAt,
      user: toPublicUser(user)
    };
  }

  async getCurrentUser(cookieHeader: string | undefined) {
    const token = readSessionCookie(cookieHeader);
    if (!token) {
      throw new UnauthorizedError("Login required");
    }

    const tokenHash = hashSessionToken(token);
    const session = await this.users.getSessionByTokenHash(tokenHash);
    if (!session) {
      throw new UnauthorizedError("Login required");
    }

    if (session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
      await this.users.deleteSessionByTokenHash(tokenHash);
      throw new UnauthorizedError("Login required");
    }

    return toPublicUser(session.user);
  }

  async logout(cookieHeader: string | undefined) {
    const token = readSessionCookie(cookieHeader);
    if (token) {
      await this.users.deleteSessionByTokenHash(hashSessionToken(token));
    }
  }
}

export function readSessionCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME) {
      return rawValue.join("=");
    }
  }

  return null;
}

function parseLogin(body: unknown): LoginRequest {
  if (!isRecord(body)) {
    throw new ValidationError("Invalid request body");
  }

  return {
    username: readUsername(body.username),
    password: readPassword(body.password)
  };
}

function readUsername(value: unknown) {
  if (typeof value !== "string") {
    throw new ValidationError("Username is required");
  }

  const username = normalizeUsername(value);
  if (username.length < 2) {
    throw new ValidationError("Username must be at least 2 characters");
  }
  return username;
}

function readPassword(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ValidationError("Password is required");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPublicUser(user: UserSummary): UserSummary {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}
