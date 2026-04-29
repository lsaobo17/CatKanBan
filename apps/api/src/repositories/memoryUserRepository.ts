import type { UserSummary } from "../../../../packages/shared/src/index.js";
import type {
  CreateUserData,
  SeedAdminData,
  StoredSession,
  StoredUser,
  UpdateUserData,
  UserRepository
} from "./userRepository.js";

const nowIso = () => new Date().toISOString();

export class MemoryUserRepository implements UserRepository {
  private userSequence = 1;
  private sessionSequence = 1;
  private users: StoredUser[];
  private sessions: StoredSession[] = [];

  constructor(users: StoredUser[] = []) {
    this.users = users;
    this.userSequence = users.length + 1;
  }

  async seedAdmin(input: SeedAdminData) {
    const activeAdmin = this.users.find((user) => user.role === "admin" && user.isActive);
    if (activeAdmin) {
      return toSummary(activeAdmin);
    }

    const existingUser = this.users.find((user) => user.username === input.username);
    if (existingUser) {
      const promoted = {
        ...existingUser,
        name: input.name,
        role: "admin" as const,
        isActive: true,
        updatedAt: nowIso()
      };
      this.replaceUser(promoted);
      return toSummary(promoted);
    }

    const inactiveAdmin = this.users.find((user) => user.role === "admin");
    if (inactiveAdmin) {
      const reactivated = {
        ...inactiveAdmin,
        isActive: true,
        updatedAt: nowIso()
      };
      this.replaceUser(reactivated);
      return toSummary(reactivated);
    }

    const timestamp = nowIso();
    const admin: StoredUser = {
      id: `user-${this.userSequence++}`,
      username: input.username,
      email: null,
      name: input.name,
      role: "admin",
      passwordHash: input.passwordHash,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.users.push(admin);
    return toSummary(admin);
  }

  async findByUsername(username: string) {
    return this.users.find((user) => user.username === username) ?? null;
  }

  async getUser(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async listUsers() {
    return [...this.users]
      .sort((left, right) => left.username.localeCompare(right.username))
      .map(toSummary);
  }

  async listActiveUsers() {
    return this.users
      .filter((user) => user.isActive)
      .sort((left, right) => left.name.localeCompare(right.name) || left.username.localeCompare(right.username))
      .map(toSummary);
  }

  async createUser(input: CreateUserData) {
    const timestamp = nowIso();
    const user: StoredUser = {
      id: `user-${this.userSequence++}`,
      username: input.username,
      email: null,
      name: input.name,
      role: input.role,
      passwordHash: input.passwordHash,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.users.push(user);
    return toSummary(user);
  }

  async updateUser(id: string, input: UpdateUserData) {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error("User not found");
    }

    const updated: StoredUser = {
      ...user,
      username: input.username ?? user.username,
      email: user.email,
      name: input.name ?? user.name,
      role: input.role ?? user.role,
      isActive: input.isActive ?? user.isActive,
      passwordHash: input.passwordHash ?? user.passwordHash,
      updatedAt: nowIso()
    };
    this.replaceUser(updated);
    return toSummary(updated);
  }

  async countActiveAdmins(excludeUserId?: string) {
    return this.users.filter((user) => user.role === "admin" && user.isActive && user.id !== excludeUserId).length;
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    const user = await this.getUser(input.userId);
    if (!user) {
      throw new Error("User not found");
    }

    this.sessions.push({
      id: `session-${this.sessionSequence++}`,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      user
    });
  }

  async getSessionByTokenHash(tokenHash: string) {
    const session = this.sessions.find((candidate) => candidate.tokenHash === tokenHash);
    if (!session) {
      return null;
    }

    const user = await this.getUser(session.userId);
    return user ? { ...session, user } : null;
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions = this.sessions.filter((session) => session.tokenHash !== tokenHash);
  }

  async deleteSessionsForUser(userId: string) {
    this.sessions = this.sessions.filter((session) => session.userId !== userId);
  }

  private replaceUser(user: StoredUser) {
    this.users = this.users.map((candidate) => (candidate.id === user.id ? user : candidate));
  }
}

function toSummary(user: StoredUser): UserSummary {
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
