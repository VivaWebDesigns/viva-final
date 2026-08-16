import fs from "node:fs";
import path from "node:path";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const routesSource = fs.readFileSync(
  path.join(projectRoot, "server/routes.ts"),
  "utf8",
);

function readLeadScript(page: "thanks.html" | "contact-thanks.html") {
  const html = fs.readFileSync(
    path.join(projectRoot, "client/public", page),
    "utf8",
  );
  const match = html.match(
    /<script>\s*\(function\(w\) \{[\s\S]*?viva_lead_success[\s\S]*?<\/script>/,
  );

  if (!match) throw new Error(`Lead tracking script missing from ${page}`);
  return match[0].replace(/^<script>|<\/script>$/g, "");
}

function runLeadScript(page: "thanks.html" | "contact-thanks.html", url: string) {
  const testWindow = new Window({ url });
  testWindow.eval(readLeadScript(page));
  return testWindow;
}

describe("confirmed lead tracking", () => {
  it("adds a unique tracking token only after each successful server submission", () => {
    expect(routesSource).toContain(
      "`/thanks?lead_type=scan&lead_event_id=${leadEventId}`",
    );
    expect(routesSource).toContain(
      "`/contact-thanks?lead_type=contact&lead_event_id=${leadEventId}`",
    );
    expect(routesSource.match(/const leadEventId = randomUUID\(\);/g)).toHaveLength(2);
  });

  it.each([
    {
      page: "thanks.html" as const,
      path: "/thanks",
      leadType: "scan",
      formName: "free_visibility_scan",
    },
    {
      page: "contact-thanks.html" as const,
      path: "/contact-thanks",
      leadType: "contact",
      formName: "contact_form",
    },
  ])("pushes one $leadType success event and cleans its URL", ({ page, path: urlPath, leadType, formName }) => {
    const testWindow = runLeadScript(
      page,
      `https://vivawebdesigns.com${urlPath}?lead_type=${leadType}&lead_event_id=test-event-123`,
    );
    const events = (testWindow as unknown as { dataLayer: Array<Record<string, string>> }).dataLayer;

    expect(events).toEqual([
      {
        event: "viva_lead_success",
        lead_type: leadType,
        form_name: formName,
        lead_event_id: "test-event-123",
      },
    ]);
    expect(testWindow.location.href).toBe(`https://vivawebdesigns.com${urlPath}`);

    testWindow.eval(readLeadScript(page));
    expect(events).toHaveLength(1);
  });

  it("does not count direct or mismatched thank-you page visits", () => {
    const directVisit = runLeadScript(
      "contact-thanks.html",
      "https://vivawebdesigns.com/contact-thanks",
    );
    const wrongType = runLeadScript(
      "thanks.html",
      "https://vivawebdesigns.com/thanks?lead_type=contact&lead_event_id=test-event-456",
    );

    expect((directVisit as unknown as { dataLayer?: unknown[] }).dataLayer).toBeUndefined();
    expect((wrongType as unknown as { dataLayer?: unknown[] }).dataLayer).toBeUndefined();
  });
});
