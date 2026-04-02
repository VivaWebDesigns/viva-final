import { describe, it, expect } from "vitest";
import {
  scoreCaptureMatch,
  extractPhoneFromText,
  normalizePhone,
} from "../../server/features/marketplace/captureReplyHelpers";

const BASE_STORED = {
  sellerFirstName:        "carlos",
  listingTitleNormalized: "2018 ford f-150 xlt",
  facebookJoinYear:       2015,
  threadIdentifier:       "t_abc_123",
};

describe("scoreCaptureMatch — high confidence", () => {
  it("returns high via thread_id exact match", () => {
    const r = scoreCaptureMatch(BASE_STORED, { threadIdentifier: "t_abc_123" });
    expect(r.confidence).toBe("high");
    expect(r.method).toBe("thread_id");
  });

  it("returns high via exact name + exact title match", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null },
      {
        sellerFirstNameNormalized: "carlos",
        listingTitleNormalized:    "2018 ford f-150 xlt",
      }
    );
    expect(r.confidence).toBe("high");
    expect(r.method).toBe("name_title_exact");
  });
});

describe("scoreCaptureMatch — medium confidence", () => {
  it("returns medium when title is a substring of stored title", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null },
      {
        sellerFirstNameNormalized: "carlos",
        listingTitleNormalized:    "ford f-150",
      }
    );
    expect(r.confidence).toBe("medium");
    expect(r.method).toBe("name_title_fuzzy");
  });

  it("returns medium when stored title is a substring of incoming title", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null, listingTitleNormalized: "ford f-150" },
      {
        sellerFirstNameNormalized: "carlos",
        listingTitleNormalized:    "2018 ford f-150 xlt crew cab",
      }
    );
    expect(r.confidence).toBe("medium");
    expect(r.method).toBe("name_title_fuzzy");
  });

  it("returns medium when word-overlap >= 60%", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null },
      {
        sellerFirstNameNormalized: "carlos",
        listingTitleNormalized:    "2018 ford xlt",
      }
    );
    expect(r.confidence).toBe("medium");
  });
});

describe("scoreCaptureMatch — low confidence (blocked)", () => {
  it("returns low when first name only, no title", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null },
      { sellerFirstNameNormalized: "carlos" }
    );
    expect(r.confidence).toBe("low");
  });

  it("returns low when title only, no first name", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null },
      { listingTitleNormalized: "2018 ford f-150 xlt" }
    );
    expect(r.confidence).toBe("low");
  });

  it("returns low when first name does not match", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null },
      {
        sellerFirstNameNormalized: "juan",
        listingTitleNormalized:    "2018 ford f-150 xlt",
      }
    );
    expect(r.confidence).toBe("low");
  });

  it("returns low when threadIdentifier conflicts with stored thread", () => {
    const r = scoreCaptureMatch(BASE_STORED, {
      sellerFirstNameNormalized: "carlos",
      listingTitleNormalized:    "2018 ford f-150 xlt",
      threadIdentifier:          "t_WRONG_999",
    });
    expect(r.confidence).toBe("low");
    expect(r.method).toBe("none");
  });

  it("returns low when neither name nor thread provided", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null },
      {}
    );
    expect(r.confidence).toBe("low");
  });

  it("returns low when title is totally different even with name match", () => {
    const r = scoreCaptureMatch(
      { ...BASE_STORED, threadIdentifier: null },
      {
        sellerFirstNameNormalized: "carlos",
        listingTitleNormalized:    "lawn mower for sale",
      }
    );
    expect(r.confidence).toBe("low");
  });
});

describe("scoreCaptureMatch — thread conflict overrides name+title high", () => {
  it("conflict signal trumps exact name+title match → low", () => {
    const r = scoreCaptureMatch(BASE_STORED, {
      sellerFirstNameNormalized: "carlos",
      listingTitleNormalized:    "2018 ford f-150 xlt",
      threadIdentifier:          "t_WRONG_THREAD",
    });
    expect(r.confidence).toBe("low");
  });
});

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
