import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  crmCompanies, crmLeads, crmLeadTags, crmTags, localFalconCrmOnlyProspects,
  localFalconImportBatches, localFalconProspectProfiles, scanReportDeliveries,
} from "@shared/schema";
import { db } from "../../db";

export type SabImportExpectation = {
  place_id: string;
  company_name: string;
  contact_tag: "Email Ready" | "Needs Email";
  address: "Service Area Business";
  outcome: "deliverable" | "no_visibility_core_found";
  report_key: string | null;
};

export async function reconcileSabImportBatch(batchId:string, expected:SabImportExpectation[]) {
  const placeIds=expected.map(row=>row.place_id);
  const deliverables=await db.select({
    place_id:localFalconProspectProfiles.placeId,lead_id:localFalconProspectProfiles.leadId,
    company_name:localFalconProspectProfiles.companyName,address:localFalconProspectProfiles.address,
    report_key:localFalconProspectProfiles.reportKey,batch_id:localFalconImportBatches.batchId,
  }).from(localFalconProspectProfiles)
    .innerJoin(localFalconImportBatches,eq(localFalconProspectProfiles.batchRecordId,localFalconImportBatches.id))
    .where(and(inArray(localFalconProspectProfiles.placeId,placeIds),eq(localFalconImportBatches.batchId,batchId)));
  const crmOnly=await db.select({
    place_id:localFalconCrmOnlyProspects.placeId,lead_id:localFalconCrmOnlyProspects.leadId,
    company_name:localFalconCrmOnlyProspects.companyName,address:crmCompanies.address,
    contact_tag:localFalconCrmOnlyProspects.contactTag,batch_id:localFalconImportBatches.batchId,
  }).from(localFalconCrmOnlyProspects)
    .innerJoin(localFalconImportBatches,eq(localFalconCrmOnlyProspects.batchRecordId,localFalconImportBatches.id))
    .innerJoin(crmLeads,eq(localFalconCrmOnlyProspects.leadId,crmLeads.id))
    .innerJoin(crmCompanies,eq(crmLeads.companyId,crmCompanies.id))
    .where(and(inArray(localFalconCrmOnlyProspects.placeId,placeIds),eq(localFalconImportBatches.batchId,batchId)));
  const leadIds=[...new Set([...deliverables.map(row=>row.lead_id),...crmOnly.map(row=>row.lead_id)])];
  const tags=leadIds.length ? await db.select({lead_id:crmLeadTags.leadId,tag:crmTags.name})
    .from(crmLeadTags).innerJoin(crmTags,eq(crmLeadTags.tagId,crmTags.id))
    .where(and(inArray(crmLeadTags.leadId,leadIds),inArray(crmTags.name,["Email Ready","Needs Email"]))) : [];
  const sends=leadIds.length ? await db.select({lead_id:scanReportDeliveries.leadId,count:sql<number>`count(*)::int`})
    .from(scanReportDeliveries).where(and(inArray(scanReportDeliveries.leadId,leadIds),isNotNull(scanReportDeliveries.sentAt)))
    .groupBy(scanReportDeliveries.leadId) : [];
  const tagMap=new Map<string,string[]>();
  for(const row of tags) tagMap.set(row.lead_id,[...(tagMap.get(row.lead_id)??[]),row.tag]);
  const sendMap=new Map(sends.map(row=>[row.lead_id,Number(row.count)]));
  const exceptions:Array<{place_id:string;company:string;issues:string[]}>=[];
  let priorSendCount=0;
  for(const item of expected) {
    const matches=item.outcome==="deliverable" ? deliverables.filter(row=>row.place_id===item.place_id) : crmOnly.filter(row=>row.place_id===item.place_id);
    const issues:string[]=[];
    if(matches.length!==1) issues.push(matches.length?"duplicate_exact_place_id_in_batch":"exact_place_id_not_imported");
    const match=matches[0];
    if(match) {
      if(match.company_name!==item.company_name) issues.push("company_name_mismatch");
      if(match.address!==item.address) issues.push("address_mismatch");
      if(item.outcome==="deliverable" && "report_key" in match && match.report_key!==item.report_key) issues.push("canonical_report_mismatch");
      const routing=tagMap.get(match.lead_id)??[];
      if(routing.length!==1 || routing[0]!==item.contact_tag) issues.push("contact_tag_mismatch");
      const sent=sendMap.get(match.lead_id)??0;
      priorSendCount+=sent;
      if(sent>0) issues.push("prior_report_email_send_present");
    }
    if(issues.length) exceptions.push({place_id:item.place_id,company:item.company_name,issues});
  }
  return {
    counts:{expected:expected.length,imported:expected.length-exceptions.filter(row=>row.issues.includes("exact_place_id_not_imported")).length,
      exceptions:exceptions.length,prior_report_email_sends:priorSendCount},
    exceptions,full_records_returned:false,
  };
}
