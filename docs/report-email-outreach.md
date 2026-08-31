# Two-email visibility-report outreach

## Rep workflow

1. Use **Email report** on the lead's visibility snapshot. Review the recipient and copy.
2. Once the sending provider accepts the email, a New Lead moves to **Report Emailed**. The list and snapshot show **1 of 2 sent**. A task to send the second email is due seven business days later.
3. Check the inbox before sending again. If unanswered, use **Email report** again; the preview supplies a shorter follow-up draft. A successful second send completes the follow-up task and creates a final review task five business days later. The stage stays Report Emailed.
4. On the final task, check the inbox and select **No response** if unanswered. This pauses outreach without marking the opportunity lost. A third email is blocked.
5. Record an actual reply through the report task or the snapshot's **Record reply / outreach outcome** button. Interested/Uncertain moves to Contacted and creates a Schedule demo task; Appointment set moves to Demo Scheduled and creates a demo-outcome task. Not interested moves to Closed Lost. Opted out and Email bounced stop this email sequence without equating either to a sales rejection.
6. A late reply after No Response can be recorded using the same snapshot button. Advancing an opportunity through other stage-change paths closes pending report tasks, too.

No emails are sent automatically on task deadlines. Replies, opt-outs, and bounces must be recorded by a rep; this change does not add an inbound mailbox or delivery-webhook integration. Business days mean Monday–Friday using the Eastern calendar, without holiday exclusions. No Response is available only after the full five-business-day wait from email two, regardless of task rescheduling.

The leads list includes server-side Report outreach filters, so results cover the full lead population rather than only the visible page. **Needs attention** prioritizes real report viewers/clickers, followed by overdue second emails. Separate views are available for 1 of 2 sent, 2 of 2 sent, engaged, awaiting response, no engagement, and stopped outreach. A report view means the tracked hosted report was loaded; it is not an inferred email open.

## Persistence and deployment

- No schema migration or new columns. Existing `scan_report_deliveries.sent_at` records supply the count and last-send date, including historical sends. Delivery status is provider acceptance, not proof of inbox delivery.
- Existing lead activity metadata stores outreach dispositions and an idempotent per-delivery processing marker. Lead row locks serialize concurrent sends and outcome changes. The outbox job, delivery, and queued note are inserted together in one transaction.
- Provider requests use a stable per-job idempotency key. Accepted deliveries skip the provider on bookkeeping retries. Failed/queued sends do not advance the stage or create a next task.
- Startup seeding inserts Report Emailed immediately before Contacted, shifting subsequent sort positions once. Existing customized stages are preserved. The same operation can run safely on successful delivery if needed.
- Historical sends count toward the limit, but historical leads are not bulk-moved and no historical task backlog is generated merely by deploying. Existing advanced/closed opportunities are never moved backward by a report send.
- Custom unrelated tasks are preserved. The standard Contact lead task and prior report-sequence tasks are retired on successful report sending.

## Verification

Targeted tests cover business-day scheduling, send limits, stopped dispositions, idempotent processing, stage progression, no regression of advanced deals, two-step task replacement, reply outcomes, No Response timing, historical counts, and email-specific completion controls. The complete suite also contains tests requiring a running PostgreSQL database and server; those cannot pass in an unconfigured local environment.
