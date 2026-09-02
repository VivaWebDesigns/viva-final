import { describe, expect, it, vi } from "vitest";
import { fetchReportAtrp, hydrateReportAtrp } from "../../server/features/local-visibility/metrics";

const key = "123456789abc";
const pid = "target-place-id";
function response(data: Record<string, unknown>) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data })));
}

describe("all-point report average", () => {
  it("retrieves ATRP, never ARP, for a sparse one-pin scan", async () => {
    const fetchImpl = response({ report_key: key, place_id: pid, arp: "3.00", atrp: "20.63" });
    expect(await fetchReportAtrp(key, pid, { apiKey: "test", fetchImpl })).toBe(20.63);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`/reports/${key}/`);
    expect(String(fetchImpl.mock.calls[0][0])).not.toContain("scan/");
    expect(new URL(fetchImpl.mock.calls[0][0]).searchParams.get("fieldmask")).toBe("report_key,place_id,atrp");
  });
  it.each([null, "", "NaN", undefined, 0])("refuses missing or invalid ATRP %s instead of falling back", async (atrp) => {
    await expect(fetchReportAtrp(key, pid, { apiKey: "test", fetchImpl: response({ report_key: key, place_id: pid, arp: 3, atrp }) })).rejects.toThrow("unavailable");
  });
  it("rejects the wrong report subject", async () => {
    await expect(fetchReportAtrp(key, pid, { apiKey: "test", fetchImpl: response({ report_key: key, place_id: "wrong", atrp: 20 }) })).rejects.toThrow("identity");
  });
  it("hydrates old manifests without overwriting ARP or other fields", async () => {
    const prospects = [{ report_key: key, place_id: pid, arp: 3, atrp: 3 }];
    await hydrateReportAtrp(prospects, vi.fn().mockResolvedValue(20.63));
    expect(prospects[0]).toEqual({ report_key: key, place_id: pid, arp: 3, atrp: 20.63 });
  });
  it("bounds consolidated-batch ATRP verification at eight concurrent requests", async () => {
    const prospects = Array.from({ length: 73 }, (_, index) => ({
      report_key: index.toString(16).padStart(12, "0"),
      place_id: `place-${index}`,
      atrp: 3,
    }));
    let active = 0;
    let maximum = 0;
    const retrieve = vi.fn(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return 12;
    });

    await hydrateReportAtrp(prospects, retrieve);

    expect(retrieve).toHaveBeenCalledTimes(73);
    expect(maximum).toBe(8);
    expect(prospects.every((prospect) => prospect.atrp === 12)).toBe(true);
  });
});
