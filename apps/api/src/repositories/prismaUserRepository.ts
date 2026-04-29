import type { PrismaClient, Session as PrismaSession, User as PrismaUser } from "@prisma/client";
import type { UserSummary } from "../../../../packages/shared/src/index.js";
import type {
  CreateUserData,
  SeedAdminData,
  StoredSession,
  StoredUser,
  UpdateUserData,
  UserRepository
} from "./userRepository.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async seedAdmin(input: SeedAdminData) {
    const activeAdmin = await this.prisma.user.findFirst({
      where: { role: "admin", isActive: true },
      orderBy: { createdAt: "asc" }
    });
    if (activeAdmin) {
      return mapUser(activeAdmin);
    }

    const existingUser = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (existingUser) {
      const promoted = await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.name,
          username: input.username,
          role: "admin",
          isActive: true
        }
      });
      return mapUser(promoted);
    }

    const inactiveAdmin = await this.prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" }
    });
    if (inactiveAdmin) {
      const reactivated = await this.prisma.user.update({
        where: { id: inactiveAdmin.id },
        data: { isActive: true }
      });
      return mapUser(reactivated);
    }

    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        email: null,
        name: input.name,
        role: "admin",
        passwordHash: input.passwordHash,
        isActive: true
      }
    });
    return mapUser(user);
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    return user ? mapStoredUser(user) : null;
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? mapStoredUser(user) : null;
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ role: "asc" }, { username: "asc" }]
    });
    return users.map(mapUser);
  }

  async listActiveUsers() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { username: "asc" }]
    });
    return users.map(mapUser);
  }

  async createUser(input: CreateUserData) {
    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        email: null,
        name: input.name,
        role: input.role,
        passwordHash: input.passwordHash,
        isActive: true
      }
    });
    return mapUser(user);
  }

  async updateUser(id: string, input: UpdateUserData) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        username: input.username,
        name: input.name,
        role: input.role,
        isActive: input.isActive,
        passwordHash: input.passwordHash
      }
    });
    return mapUser(user);
  }

  async countActiveAdmins(excludeUserId?: string) {
    return this.prisma.user.count({
      where: {
        role: "admin",
        isActive: true,
        id: excludeUserId ? { not: excludeUserId } : undefined
      }
    });
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    await this.prisma.session.create({ data: input });
  }

  async getSessionByTokenHash(tokenHash: string) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true }
    });
    return session ? mapSession(session) : null;
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async deleteSessionsForUser(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}

type PrismaSessionWithUser = PrismaSession & { user: PrismaUser };

function mapSession(session: PrismaSessionWithUser): StoredSession {
  return {
    id: session.id,
    userId: session.userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    user: mapStoredUser(session.user)
  };
}

function mapStoredUser(user: PrismaUser): StoredUser {
  return {
    ...mapUser(user),
    passwordHash: user.passwordHash
  };
}

function mapUser(user: PrismaUser): UserSummary {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role as UserSummary["role"],
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}
