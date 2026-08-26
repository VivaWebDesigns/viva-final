const DATAFORSEO_BASE = "https://api.dataforseo.com/v3";
const DATAFORSEO_TIMEOUT_MS = 60_000;

export type DataForSeoFetch = typeof fetch;

type DataForSeoTask = {
  id?: unknown;
  cost?: unknown;
  status_code?: unknown;
  status_message?: unknown;
  result?: unknown;
};

type DataForSeoResponse = {
  tasks?: unknown;
};

type DataForSeoBusiness = Record<string, unknown>;

export type SabBusinessEnrichmentResult = {
  place_id: string;
  lookup_status:
    | "matched"
    | "request_not_submitted"
    | "provider_error"
    | "not_found"
    | "identity_mismatch";
  receipt: {
    provider: "dataforseo_my_business_info_live";
    query: string;
    task_id: string | null;
    status_code: number | null;
    status_message: string | null;
    cost: number;
  };
  business: null | {
    name: string | null;
    place_id: string;
    cid: string | null;
    phone: string | null;
    website: string | null;
    rating: number | null;
    review_count: number | null;
    primary_category: string | null;
    categories: Array<{ name: string; id: string | null }>;
    service_count: number;
    service_names: string[];
    omitted_service_count: number;
    description: string | null;
    is_claimed: boolean | null;
    latitude: number | null;
    longitude: number | null;
    place_topics: string[];
  };
};

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function firstArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function categoryRows(item: DataForSeoBusiness) {
  const raw = firstArray(item.categories);
  const categories = raw.flatMap((category) => {
    if (typeof category === "string" && category.trim()) {
      return [{ name: category.trim(), id: null }];
    }
    if (!category || typeof category !== "object") return [];
    const row = category as Record<string, unknown>;
    const name = cleanString(row.name ?? row.title ?? row.category);
    return name ? [{ name, id: cleanString(row.id ?? row.category_id) }] : [];
  });

  const primary =
    cleanString(item.category ?? item.primary_category) ??
    categories[0]?.name ??
    null;
  if (primary && !categories.some(({ name }) => name === primary)) {
    categories.unshift({ name: primary, id: cleanString(item.category_id) });
  }
  return { primary, categories };
}

function serviceName(value: unknown) {
  if (typeof value === "string") return cleanString(value);
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return cleanString(row.name ?? row.title ?? row.service);
}

function topicName(value: unknown) {
  if (typeof value === "string") return cleanString(value);
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return cleanString(row.title ?? row.name ?? row.topic);
}

function normalizeBusiness(item: DataForSeoBusiness, placeId: string) {
  const { primary, categories } = categoryRows(item);
  const allServices = firstArray(item.services)
    .map(serviceName)
    .filter((value): value is string => Boolean(value));
  const serviceNames = allServices.slice(0, 20);
  const topics = firstArray(item.place_topics)
    .map(topicName)
    .filter((value): value is string => Boolean(value))
    .slice(0, 20);
  const rating =
    item.rating && typeof item.rating === "object"
      ? (item.rating as Record<string, unknown>).value
      : item.rating;

  return {
    name: cleanString(item.title ?? item.name),
    place_id: placeId,
    cid: cleanString(item.cid),
    phone: cleanString(item.phone ?? item.phone_number),
    website: cleanString(item.url ?? item.website),
    rating: cleanNumber(rating),
    review_count: cleanNumber(item.reviews_count ?? item.review_count),
    primary_category: primary,
    categories,
    service_count: allServices.length,
    service_names: serviceNames,
    omitted_service_count: Math.max(
      0,
      allServices.length - serviceNames.length,
    ),
    description: cleanString(item.description),
    is_claimed: cleanBoolean(item.is_claimed),
    latitude: cleanNumber(item.latitude),
    longitude: cleanNumber(item.longitude),
    place_topics: topics,
  };
}

function credentials(options: { login?: string; password?: string }) {
  const login =
    options.login?.trim() || process.env.DATAFORSEO_API_LOGIN?.trim();
  const password =
    options.password?.trim() || process.env.DATAFORSEO_API_PASSWORD?.trim();
  if (!login || !password) {
    throw new Error(
      "DATAFORSEO_API_LOGIN and DATAFORSEO_API_PASSWORD are not configured for the Viva SAB Workflow connector.",
    );
  }
  return { login, password };
}

function taskFrom(payload: DataForSeoResponse) {
  return Array.isArray(payload.tasks)
    ? (payload.tasks[0] as DataForSeoTask | undefined)
    : undefined;
}

function taskItems(task: DataForSeoTask | undefined) {
  const results = Array.isArray(task?.result) ? task.result : [];
  const first = results[0];
  if (!first || typeof first !== "object") return [];
  const items = (first as Record<string, unknown>).items;
  return Array.isArray(items)
    ? items.filter(
        (item): item is DataForSeoBusiness =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

export async function fetchSabBusinessEnrichment(
  placeId: string,
  locationName: string,
  languageCode: string,
  options: {
    login?: string;
    password?: string;
    fetchImpl?: DataForSeoFetch;
  } = {},
): Promise<SabBusinessEnrichmentResult> {
  const { login, password } = credentials(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const query = `place_id:${placeId}`;
  const response = await fetchImpl(
    `${DATAFORSEO_BASE}/business_data/google/my_business_info/live`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword: query,
          location_name: locationName,
          language_code: languageCode,
        },
      ]),
      signal: AbortSignal.timeout(DATAFORSEO_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(
      `DataForSEO My Business Info Live failed with HTTP ${response.status}.`,
    );
  }
  const payload = (await response.json()) as DataForSeoResponse;
  const task = taskFrom(payload);
  const cost = cleanNumber(task?.cost) ?? 0;
  const statusCode = cleanNumber(task?.status_code);
  const statusMessage = cleanString(task?.status_message);
  const receipt = {
    provider: "dataforseo_my_business_info_live" as const,
    query,
    task_id: cleanString(task?.id),
    status_code: statusCode,
    status_message: statusMessage,
    cost,
  };

  const items = taskItems(task);
  if (!task || (!receipt.task_id && cost === 0 && items.length === 0)) {
    return {
      place_id: placeId,
      lookup_status: "request_not_submitted",
      receipt,
      business: null,
    };
  }
  if (statusCode !== 20000) {
    return {
      place_id: placeId,
      lookup_status: "provider_error",
      receipt,
      business: null,
    };
  }

  if (!items.length) {
    return {
      place_id: placeId,
      lookup_status: "not_found",
      receipt,
      business: null,
    };
  }
  const exact = items.find((item) => cleanString(item.place_id) === placeId);
  if (!exact) {
    return {
      place_id: placeId,
      lookup_status: "identity_mismatch",
      receipt,
      business: null,
    };
  }
  return {
    place_id: placeId,
    lookup_status: "matched",
    receipt,
    business: normalizeBusiness(exact, placeId),
  };
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        output[index] = await mapper(values[index]);
      }
    }),
  );
  return output;
}

export async function enrichSabBusinesses(
  placeIds: string[],
  locationName: string,
  languageCode: string,
  options: {
    login?: string;
    password?: string;
    fetchImpl?: DataForSeoFetch;
    concurrency?: number;
  } = {},
) {
  const cleaned = placeIds.map((value) => value.trim()).filter(Boolean);
  const unique = [...new Set(cleaned)];
  const results = await mapConcurrent(
    unique,
    options.concurrency ?? 4,
    async (placeId) => {
      try {
        return await fetchSabBusinessEnrichment(
          placeId,
          locationName,
          languageCode,
          options,
        );
      } catch (error) {
        return {
          place_id: placeId,
          lookup_status: "provider_error" as const,
          receipt: {
            provider: "dataforseo_my_business_info_live" as const,
            query: `place_id:${placeId}`,
            task_id: null,
            status_code: null,
            status_message:
              error instanceof Error
                ? error.message
                : "DataForSEO request failed.",
            cost: 0,
          },
          business: null,
        };
      }
    },
  );
  const totalCost = results.reduce(
    (sum, result) => sum + result.receipt.cost,
    0,
  );
  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.lookup_status] = (acc[result.lookup_status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    source: "dataforseo_my_business_info_live",
    provider_query_mode: "keyword_place_id_exact",
    writes_performed: false,
    requested_place_id_count: cleaned.length,
    unique_place_id_count: unique.length,
    duplicate_input_count: cleaned.length - unique.length,
    request_count: unique.length,
    total_cost: totalCost,
    status_counts: counts,
    results,
  };
}
