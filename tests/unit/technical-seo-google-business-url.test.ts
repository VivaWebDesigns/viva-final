import { afterEach, describe, expect, it, vi } from "vitest";
import { extractGoogleBusinessIdentifier, runLocalSearchAudit } from "../../server/features/technical-seo/dataforseo-audit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("technical SEO Google Business Profile URL identifiers", () => {
  it("extracts a decimal CID from a maps URL", () => {
    expect(extractGoogleBusinessIdentifier("https://www.google.com/maps?cid=194604053573767737")).toBe("cid:194604053573767737");
  });

  it("extracts a Place ID from a maps URL", () => {
    expect(extractGoogleBusinessIdentifier("https://www.google.com/maps/search/?api=1&query=Acme&query_place_id=ChIJQWDl0CIeQUARxks3icF8U8A")).toBe("place_id:ChIJQWDl0CIeQUARxks3icF8U8A");
  });

  it("converts a maps feature hex CID to decimal", () => {
    expect(extractGoogleBusinessIdentifier("https://www.google.com/maps/place/Acme/data=!4m2!3m1!1s0x123:0x1a")).toBe("cid:26");
  });

  it("rejects identifiers on non-Google hosts", () => {
    expect(extractGoogleBusinessIdentifier("https://example.com/maps?cid=194604053573767737")).toBeNull();
  });

  it("accepts a CID after a g.page redirect", () => {
    expect(extractGoogleBusinessIdentifier("https://g.page/maps?cid=194604053573767737")).toBe("cid:194604053573767737");
  });

  it("accepts Google share links for safe resolution", () => {
    expect(extractGoogleBusinessIdentifier("https://share.google/example")).toBeNull();
  });

  it("retains exact local-pack profile evidence when the detail endpoint has no result", async () => {
    vi.stubEnv("DATAFORSEO_API_LOGIN", "login");
    vi.stubEnv("DATAFORSEO_API_PASSWORD", "password");
    const payload = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(payload({ tasks: [{ status_code: 20000, result: [{ items: [
        { type: "local_pack", title: "Lake Wylie Dog Boarding", cid: "4284482761803538580", url: "https://lakewylieboarding.com/", phone: "+18033153578", rating: { value: 5, votes_count: 47 } },
        { type: "organic", title: "Lake Wylie Dog Boarding", domain: "lakewylieboarding.com", rank_group: 3 },
      ] }] }] }))
      .mockResolvedValueOnce(payload({ tasks: [{ status_code: 40102, status_message: "No Search Results." }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runLocalSearchAudit("https://lakewylieboarding.com/", {
      businessName: "Lake Wylie Dog Boarding", trade: "Dog Boarding", city: "Clover", state: "SC", targetServices: [], serviceAreas: [],
    });

    expect(result.profileStatus).toBe("measured");
    expect(result.profileMatchMethod).toBe("search_result_identity");
    expect(result.profile).toMatchObject({ title: "Lake Wylie Dog Boarding", phone: "+18033153578", rating: 5, reviewCount: 47 });
    expect(result.receipt.keywords[0]).toBe("cid:4284482761803538580");
    expect(result.rankingsStatus).toBe("not_assessed");
    expect(result.mapRank).toBeNull();
    expect(result.organicRank).toBeNull();
    expect(result.receipt.paidRequests).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
