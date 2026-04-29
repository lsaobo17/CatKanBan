import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserRole,
  UserSummary
} from "../../../../packages/shared/src/index.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors.js";
import type { UserRepository } from "../repositories/userRepository.js";
import { isUserRole, normalizeUsername } from "../repositories/userRepository.js";
import { hashPassword } from "./security.js";

export class UserService {
  constructor(private readonly users: UserRepository) {}

  listAssignableUsers() {
    return this.users.listActiveUsers();
  }

  async listUsers(actor: UserSummary) {
    requireAdmin(actor);
    return this.users.listUsers();
  }

  async createUser(actor: UserSummary, body: unknown) {
    requireAdmin(actor);
    const input = parseCreateUser(body);
    const existing = await this.users.findByUsername(input.username);
    if (existing) {
      throw new ConflictError("Username is already in use");
    }

    return this.users.createUser({
      username: input.username,
      name: input.username,
      role: input.role ?? "member",
      passwordHash: await hashPassword(input.password)
    });
  }

  async updateUser(actor: UserSummary, id: string, body: unknown) {
    requireAdmin(actor);
    const current = await this.users.getUser(id);
    if (!current) {
      throw new NotFoundError("User not found");
    }

    const input = parseUpdateUser(body);
    if (input.username && input.username !== current.username) {
      const existing = await this.users.findByUsername(input.username);
      if (existing && existing.id !== id) {
        throw new ConflictError("Username is already in use");
      }
    }

    const nextRole = input.role ?? current.role;
    const nextIsActive = input.isActive ?? current.isActive;
    if (current.role === "admin" && current.isActive && (nextRole !== "admin" || !nextIsActive)) {
      const remainingAdmins = await this.users.countActiveAdmins(id);
      if (remainingAdmins === 0) {
        throw new ValidationError("At least one active administrator is required");
      }
    }

    const updated = await this.users.updateUser(id, {
      username: input.username,
      name: input.name,
      role: input.role,
      isActive: input.isActive,
      passwordHash: input.password ? await hashPassword(input.password) : undefined
    });

    if (input.isActive === false) {
      await this.users.deleteSessionsForUser(id);
    }

    return updated;
  }
}

function requireAdmin(actor: UserSummary) {
  if (actor.role !== "admin") {
    throw new ForbiddenError("Administrator access required");
  }
}

function parseCreateUser(body: unknown): CreateUserRequest {
  if (!isRecord(body)) {
    throw new ValidationError("Invalid request body");
  }

  return {
    username: readUsername(body.username),
    password: readNewPassword(body.password),
    role: body.role === undefined ? undefined : readRole(body.role)
  };
}

function parseUpdateUser(body: unknown): UpdateUserRequest {
  if (!isRecord(body)) {
    throw new ValidationError("Invalid request body");
  }

  const input: UpdateUserRequest = {};
  if ("username" in body) {
    input.username = readUsername(body.username);
  }
  if ("name" in body) {
    input.name = readRequiredString(body.name, "Name");
  }
  if ("password" in body && body.password !== undefined && body.password !== null && body.password !== "") {
    input.password = readNewPassword(body.password);
  }
  if ("role" in body) {
    input.role = readRole(body.role);
  }
  if ("isActive" in body) {
    input.isActive = readBoolean(body.isActive, "Active status");
  }

  return input;
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

function readRequiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${label} is required`);
  }
  return value.trim();
}

function readNewPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }
  return value;
}

function readRole(value: unknown): UserRole {
  if (!isUserRole(value)) {
    throw new ValidationError("Role is invalid");
  }
  return value;
}

function readBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${label} is invalid`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
