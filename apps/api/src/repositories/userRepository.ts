import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserRole,
  UserSummary
} from "../../../../packages/shared/src/index.js";

export interface StoredUser extends UserSummary {
  passwordHash: string;
}

export interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  user: StoredUser;
}

export interface SeedAdminData {
  name: string;
  passwordHash: string;
  username: string;
}

export type CreateUserData = Omit<CreateUserRequest, "password"> & {
  name: string;
  passwordHash: string;
  role: UserRole;
};

export type UpdateUserData = Omit<UpdateUserRequest, "password"> & {
  passwordHash?: string;
};

export interface UserRepository {
  seedAdmin(input: SeedAdminData): Promise<UserSummary>;
  findByUsername(username: string): Promise<StoredUser | null>;
  getUser(id: string): Promise<StoredUser | null>;
  listUsers(): Promise<UserSummary[]>;
  listActiveUsers(): Promise<UserSummary[]>;
  createUser(input: CreateUserData): Promise<UserSummary>;
  updateUser(id: string, input: UpdateUserData): Promise<UserSummary>;
  countActiveAdmins(excludeUserId?: string): Promise<number>;
  createSession(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<StoredSession | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "member";
}
