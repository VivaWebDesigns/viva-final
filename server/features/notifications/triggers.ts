import { db } from "../../db";
import { user } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { createNotification } from "./service";

async function getUsersByRole(...roles: string[]) {
  return db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(or(...roles.map((r) => eq(user.role, r))));
}

async function getUserById(userId: string) {
  const [u] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, userId));
  return u || null;
}

export async function notifyNewLead(lead: { id: string; title: string; source?: string | null }) {
  try {
    const recipients = await getUsersByRole("admin", "sales_rep");
    const sourceLabel = lead.source === "demo_inquiry" ? "demo inquiry" : "contact form";

    await Promise.all(
      recipients.map((r) =>
        createNotification({
          recipientId: r.id,
          type: "new_lead",
          title: "New Lead Received",
          message: `"${lead.title}" was submitted via ${sourceLabel}.`,
          relatedEntityType: "lead",
          relatedEntityId: lead.id,
          channel: "both",
          recipientEmail: r.email,
        })
      )
    );
  } catch (error) {
    console.error("[Triggers] notifyNewLead error:", error);
  }
}

export async function notifyLeadAssignment(lead: { id: string; title: string }, assigneeId: string) {
  try {
    const assignee = await getUserById(assigneeId);
    if (!assignee) return;

    await createNotification({
      recipientId: assignee.id,
      type: "lead_assignment",
      title: "Lead Assigned to You",
      message: `You have been assigned the lead "${lead.title}".`,
      relatedEntityType: "lead",
      relatedEntityId: lead.id,
      channel: "both",
      recipientEmail: assignee.email,
    });
  } catch (error) {
    console.error("[Triggers] notifyLeadAssignment error:", error);
  }
}

export async function notifyStageChange(
  opportunity: { id: string; title: string; ownerId?: string | null },
  oldStageName: string,
  newStageName: string
) {
  try {
    const recipientIds: string[] = [];
    if (opportunity.ownerId) recipientIds.push(opportunity.ownerId);

    const admins = await getUsersByRole("admin");
    admins.forEach((a) => {
      if (!recipientIds.includes(a.id)) recipientIds.push(a.id);
    });

    await Promise.all(
      recipientIds.map(async (rid) => {
        const u = await getUserById(rid);
        if (!u) return;
        return createNotification({
          recipientId: rid,
          type: "stage_change",
          title: "Opportunity Stage Changed",
          message: `"${opportunity.title}" moved from ${oldStageName} to ${newStageName}.`,
          relatedEntityType: "opportunity",
          relatedEntityId: opportunity.id,
          channel: "in_app",
          recipientEmail: u.email,
        });
      })
    );
  } catch (error) {
    console.error("[Triggers] notifyStageChange error:", error);
  }
}

export async function notifyOpportunityAssignment(
  opportunity: { id: string; title: string },
  assigneeId: string
) {
  try {
    const assignee = await getUserById(assigneeId);
    if (!assignee) return;

    await createNotification({
      recipientId: assignee.id,
      type: "opportunity_assignment",
      title: "Opportunity Assigned to You",
      message: `You have been assigned the opportunity "${opportunity.title}".`,
      relatedEntityType: "opportunity",
      relatedEntityId: opportunity.id,
      channel: "both",
      recipientEmail: assignee.email,
    });
  } catch (error) {
    console.error("[Triggers] notifyOpportunityAssignment error:", error);
  }
}

export async function notifyOnboardingAssignment(
  onboarding: { id: string; clientName?: string },
  assigneeId: string
) {
  try {
    const assignee = await getUserById(assigneeId);
    if (!assignee) return;

    const label = onboarding.clientName || "a client";
    await createNotification({
      recipientId: assignee.id,
      type: "onboarding_assignment",
      title: "Onboarding Assigned to You",
      message: `You have been assigned the onboarding for ${label}.`,
      relatedEntityType: "onboarding",
      relatedEntityId: onboarding.id,
      channel: "both",
      recipientEmail: assignee.email,
    });
  } catch (error) {
    console.error("[Triggers] notifyOnboardingAssignment error:", error);
  }
}

export async function notifyOnboardingStatusChange(
  onboarding: { id: string; clientName?: string; ownerId?: string | null },
  oldStatus: string,
  newStatus: string
) {
  try {
    const recipientIds: string[] = [];
    if (onboarding.ownerId) recipientIds.push(onboarding.ownerId);

    const admins = await getUsersByRole("admin");
    admins.forEach((a) => {
      if (!recipientIds.includes(a.id)) recipientIds.push(a.id);
    });

    const label = onboarding.clientName || "a client";
    await Promise.all(
      recipientIds.map(async (rid) => {
        const u = await getUserById(rid);
        if (!u) return;
        return createNotification({
          recipientId: rid,
          type: "onboarding_status",
          title: "Onboarding Status Updated",
          message: `Onboarding for ${label} changed from ${oldStatus} to ${newStatus}.`,
          relatedEntityType: "onboarding",
          relatedEntityId: onboarding.id,
          channel: "in_app",
          recipientEmail: u.email,
        });
      })
    );
  } catch (error) {
    console.error("[Triggers] notifyOnboardingStatusChange error:", error);
  }
}

export async function notifySystemAlert(title: string, message: string) {
  try {
    const admins = await getUsersByRole("admin", "developer");

    await Promise.all(
      admins.map((a) =>
        createNotification({
          recipientId: a.id,
          type: "system_alert",
          title,
          message,
          channel: "both",
          recipientEmail: a.email,
        })
      )
    );
  } catch (error) {
    console.error("[Triggers] notifySystemAlert error:", error);
  }
}
