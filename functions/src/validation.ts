import { ValidationResult } from "./types";

/**
 * Validate request parameters
 */
export function validate(
  userId: string | undefined,
  referenceDate: string | undefined
): ValidationResult {
  const errors: string[] = [];

  // Validate userId
  if (!userId) {
    errors.push("userId is required");
  } else if (typeof userId !== "string" || userId.trim().length === 0) {
    errors.push("userId must be a non-empty string");
  }

  // Validate referenceDate
  let parsedDate: Date | undefined;
  if (referenceDate) {
    parsedDate = new Date(referenceDate);
    if (isNaN(parsedDate.getTime())) {
      errors.push("referenceDate must be a valid ISO 8601 date string");
    } else {
      // Check if date is not more than 7 D in the future
      const maxFutureDate = new Date();
      maxFutureDate.setDate(maxFutureDate.getDate() + 7);
      if (parsedDate > maxFutureDate) {
        errors.push("referenceDate cannot be more than 7 days in the future");
      }

      // Check if date is not too far in the past
      const minPastDate = new Date();
      minPastDate.setFullYear(minPastDate.getFullYear() - 1);
      if (parsedDate < minPastDate) {
        errors.push("referenceDate cannot be more than 1 year in the past");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    userId: userId?.trim(),
    referenceDate: parsedDate,
  };
}
