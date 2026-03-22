(async () => {
  const { db } = await import("../server/db");
  const { crmLeads, crmCompanies, crmContacts, pipelineOpportunities } = await import("../shared/schema");
  const { eq } = await import("drizzle-orm");

  const leads = await db
    .select({
      id: crmLeads.id,
      title: crmLeads.title,
      companyId: crmLeads.companyId,
      contactId: crmLeads.contactId,
    })
    .from(crmLeads);

  let fixedLeads = 0;
  for (const lead of leads) {
    let companyName: string | null = null;
    let contactFullName: string | null = null;

    if (lead.companyId) {
      const [co] = await db
        .select({ name: crmCompanies.name })
        .from(crmCompanies)
        .where(eq(crmCompanies.id, lead.companyId));
      if (co) companyName = co.name;
    }
    if (lead.contactId) {
      const [ct] = await db
        .select({ firstName: crmContacts.firstName, lastName: crmContacts.lastName })
        .from(crmContacts)
        .where(eq(crmContacts.id, lead.contactId));
      if (ct) contactFullName = [ct.firstName, ct.lastName].filter(Boolean).join(" ");
    }

    let expectedTitle: string;
    if (companyName && contactFullName) expectedTitle = `${companyName} – ${contactFullName}`;
    else if (companyName) expectedTitle = companyName;
    else if (contactFullName) expectedTitle = contactFullName;
    else continue;

    if (lead.title !== expectedTitle) {
      console.log(`Lead ${lead.id}: ${JSON.stringify(lead.title)} -> ${JSON.stringify(expectedTitle)}`);
      await db.update(crmLeads).set({ title: expectedTitle }).where(eq(crmLeads.id, lead.id));
      fixedLeads++;
    }
  }
  console.log(`Fixed ${fixedLeads} lead titles`);

  const opps = await db
    .select({
      id: pipelineOpportunities.id,
      title: pipelineOpportunities.title,
      sourceLeadTitle: pipelineOpportunities.sourceLeadTitle,
      companyId: pipelineOpportunities.companyId,
      contactId: pipelineOpportunities.contactId,
      leadId: pipelineOpportunities.leadId,
    })
    .from(pipelineOpportunities);

  let fixedOpps = 0;
  for (const opp of opps) {
    let companyName: string | null = null;
    let contactFullName: string | null = null;

    if (opp.companyId) {
      const [co] = await db
        .select({ name: crmCompanies.name })
        .from(crmCompanies)
        .where(eq(crmCompanies.id, opp.companyId));
      if (co) companyName = co.name;
    }
    if (opp.contactId) {
      const [ct] = await db
        .select({ firstName: crmContacts.firstName, lastName: crmContacts.lastName })
        .from(crmContacts)
        .where(eq(crmContacts.id, opp.contactId));
      if (ct) contactFullName = [ct.firstName, ct.lastName].filter(Boolean).join(" ");
    }

    let expectedTitle: string;
    if (companyName && contactFullName) expectedTitle = `${companyName} – ${contactFullName}`;
    else if (companyName) expectedTitle = companyName;
    else if (contactFullName) expectedTitle = contactFullName;
    else continue;

    const updates: Record<string, string> = {};
    if (opp.title !== expectedTitle) updates.title = expectedTitle;

    if (opp.leadId) {
      const [lead] = await db
        .select({ title: crmLeads.title })
        .from(crmLeads)
        .where(eq(crmLeads.id, opp.leadId));
      if (lead && opp.sourceLeadTitle !== lead.title) {
        updates.sourceLeadTitle = lead.title;
      }
    }

    if (Object.keys(updates).length > 0) {
      console.log(`Opp ${opp.id}: ${JSON.stringify(opp.title)} -> ${JSON.stringify(updates.title || opp.title)}`);
      await db.update(pipelineOpportunities).set(updates).where(eq(pipelineOpportunities.id, opp.id));
      fixedOpps++;
    }
  }
  console.log(`Fixed ${fixedOpps} opportunity titles`);

  process.exit(0);
})();
