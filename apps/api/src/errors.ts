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

