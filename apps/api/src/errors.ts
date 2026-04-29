export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly error = "Application Error"
  ) {
    super(message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "Bad Request");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "Not Found");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "Unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "Forbidden");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "Conflict");
  }
}
