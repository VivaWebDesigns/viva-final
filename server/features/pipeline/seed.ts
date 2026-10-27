import * as pipelineStorage from "./storage";
import { CALL_PIPELINE_STAGES } from "@shared/callPipeline";

export async function seedPipelineStages() {
  for (const stage of CALL_PIPELINE_STAGES) {
    await pipelineStorage.upsertStage(stage);
  }
  return { count: CALL_PIPELINE_STAGES.length };
}
