import { describe, expect, it } from "vitest";
import { validateDateRange } from "./validation";

describe("validateDateRange", () => {
  it("accepts valid date ranges", () => {
    expect(validateDateRange("2026-05-01", "2026-05-02")).toEqual({ valid: true });
  });

  it("rejects reversed date ranges", () => {
    expect(validateDateRange("2026-05-03", "2026-05-02")).toEqual({
      valid: false,
      message: "开始日期不能晚于截止日期"
    });
  });
});

