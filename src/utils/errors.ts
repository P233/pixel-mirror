/**
 * Error handling utilities for pixel-mirror
 */

export interface AppError {
  message: string;
  details?: string;
}

// Simple error class for validation/file errors
export class ValidationError extends Error {
  readonly details?: string;
  constructor(message: string, details?: string) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

/** A tab still running a version before 2.1 holds the database open, so it can't be upgraded */
export class DatabaseBlockedError extends Error {
  constructor() {
    super("Pixel Mirror was updated: close other tabs that use the old version, then reload this page");
    this.name = "DatabaseBlockedError";
  }
}

// Database errors keep the IndexedDB error as `cause`, so the console shows the root cause
export class DatabaseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "DatabaseError";
  }
}

/**
 * Normalize any error to an AppError structure
 */
export function normalizeError(error: unknown, context?: string): AppError {
  // Says what to do, which the wrapping "Failed to ..." message doesn't
  if (error instanceof Error && error.cause instanceof DatabaseBlockedError) {
    return { message: error.cause.message };
  }

  const prefix = context ? `${context}: ` : "";

  if (error instanceof ValidationError) {
    return {
      message: prefix + error.message,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return {
      message: prefix + error.message
    };
  }

  return {
    message: prefix + "An unknown error occurred"
  };
}
