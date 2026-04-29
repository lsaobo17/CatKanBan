const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateDateRange(startDate: string, dueDate: string): ValidationResult {
  if (!isDateKey(startDate) || !isDateKey(dueDate)) {
    return { valid: false, message: "日期格式应为 YYYY-MM-DD" };
  }

  if (Date.parse(`${startDate}T00:00:00.000Z`) > Date.parse(`${dueDate}T00:00:00.000Z`)) {
    return { valid: false, message: "开始日期不能晚于截止日期" };
  }

  return { valid: true };
}

function isDateKey(value: string) {
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

