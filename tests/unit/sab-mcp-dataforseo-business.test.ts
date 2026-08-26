import { describe, expect, it, vi } from "vitest";
import {
  enrichSabBusinesses,
  fetchSabBusinessEnrichment,
} from "../../server/features/sab-mcp/dataForSeoBusiness";

function response(task: Record<string, unknown>) {
  return new Response(JSON.stringify({ tasks: [task] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SAB compact DataForSEO enrichment", () => {
  it("translates an exact Place ID to the documented provider keyword form", async () => {
    const fetchImpl = vi.fn(async (_url, request) =>
      response({
        id: "task-1",
        cost: 0.0054,
        status_code: 20000,
        status_message: "Ok.",
        result: [
          {
            items: [
              {
                title: "Deck It Pro",
                place_id: "ChIJ-exact",
                cid: "123",
                phone: "+17045551212",
                url: "https://example.com",
                rating: { value: 4.9 },
                reviews_count: 17,
                category: "Deck builder",
                categories: [{ name: "Deck builder", id: "gcid:deck_builder" }],
                services: Array.from({ length: 25 }, (_, index) => ({
                  name: `Service ${index + 1}`,
                })),
                place_topics: ["deck", "porch"],
              },
            ],
          },
        ],
      }),
    );

    const result = await fetchSabBusinessEnrichment(
      "ChIJ-exact",
      "Charlotte,North Carolina,United States",
      "en",
      {
        login: "login",
        password: "password",
        fetchImpl: fetchImpl as typeof fetch,
      },
    );

    const [, request] = fetchImpl.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toEqual([
      {
        keyword: "place_id:ChIJ-exact",
        location_name: "Charlotte,North Carolina,United States",
        language_code: "en",
      },
    ]);
    expect(result).toMatchObject({
      place_id: "ChIJ-exact",
      lookup_status: "matched",
      receipt: { query: "place_id:ChIJ-exact", cost: 0.0054 },
      business: {
        name: "Deck It Pro",
        place_id: "ChIJ-exact",
        service_count: 25,
        omitted_service_count: 5,
      },
    });
    expect(result.business?.service_names).toHaveLength(20);
  });

  it("classifies a zero-cost response with no provider task result as not submitted", async () => {
    const result = await fetchSabBusinessEnrichment(
      "ChIJ-exact",
      "Charlotte,North Carolina,United States",
      "en",
      {
        login: "login",
        password: "password",
        fetchImpl: vi.fn(async () =>
          response({
            cost: 0,
            status_code: 20000,
            status_message: "Ok.",
            result: null,
          }),
        ) as typeof fetch,
      },
    );

    expect(result.lookup_status).toBe("request_not_submitted");
    expect(result.receipt.cost).toBe(0);
  });

  it("fails closed on an inexact returned Place ID", async () => {
    const result = await fetchSabBusinessEnrichment(
      "ChIJ-target",
      "Charlotte,North Carolina,United States",
      "en",
      {
        login: "login",
        password: "password",
        fetchImpl: vi.fn(async () =>
          response({
            id: "task-2",
            cost: 0.0054,
            status_code: 20000,
            result: [{ items: [{ place_id: "ChIJ-other", title: "Other" }] }],
          }),
        ) as typeof fetch,
      },
    );

    expect(result.lookup_status).toBe("identity_mismatch");
    expect(result.business).toBeNull();
  });

  it("deduplicates Place IDs before making paid requests", async () => {
    const fetchImpl = vi.fn(async (_url, request) => {
      const [{ keyword }] = JSON.parse(String(request?.body));
      const placeId = keyword.replace("place_id:", "");
      return response({
        id: `task-${placeId}`,
        cost: 0.0054,
        status_code: 20000,
        result: [{ items: [{ place_id: placeId, title: placeId }] }],
      });
    });

    const result = await enrichSabBusinesses(
      ["ChIJ-one", "ChIJ-one", "ChIJ-two"],
      "Charlotte,North Carolina,United States",
      "en",
      {
        login: "login",
        password: "password",
        fetchImpl: fetchImpl as typeof fetch,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      requested_place_id_count: 3,
      unique_place_id_count: 2,
      duplicate_input_count: 1,
      request_count: 2,
      total_cost: 0.0108,
    });
  });
});
