import { describe, it, expect } from "vitest";
import {
  extractPhoneFromText,
  normalizePhone,
} from "../../server/features/marketplace/captureReplyHelpers";

describe("extractPhoneFromText", () => {
  it("extracts (704) 555-1234 format", () => {
    expect(extractPhoneFromText("Call me at (704) 555-1234")).toBe("(704) 555-1234");
  });

  it("extracts 704-555-1234 format", () => {
    expect(extractPhoneFromText("My number is 704-555-1234")).toBe("704-555-1234");
  });

  it("extracts 704.555.1234 format", () => {
    expect(extractPhoneFromText("Reach me at 704.555.1234 anytime")).toBe("704.555.1234");
  });

  it("extracts +1 prefix format", () => {
    expect(extractPhoneFromText("+1 980 949 0548")).not.toBeNull();
  });

  it("returns null when no phone present", () => {
    expect(extractPhoneFromText("Yes I am available tomorrow")).toBeNull();
  });

  it("returns first phone when multiple present", () => {
    const result = extractPhoneFromText("Call 704-555-0001 or 980-555-0002");
    expect(result).toBe("704-555-0001");
  });
});

describe("normalizePhone", () => {
  it("normalizes 10-digit number to E.164", () => {
    expect(normalizePhone("7045551234")).toBe("+17045551234");
  });

  it("normalizes 11-digit number starting with 1 to E.164", () => {
    expect(normalizePhone("17045551234")).toBe("+17045551234");
  });

  it("strips formatting before normalizing", () => {
    expect(normalizePhone("(704) 555-1234")).toBe("+17045551234");
  });

  it("returns null for non-parseable input", () => {
    expect(normalizePhone("12345")).toBeNull();
  });

  it("returns null for 11-digit number not starting with 1", () => {
    expect(normalizePhone("27045551234")).toBeNull();
  });
});
