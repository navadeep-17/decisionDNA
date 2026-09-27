import { getHindsightClient } from "./client";
import {
  DECISIONDNA_BANK_ID,
  OBSERVATIONS_MISSION,
  REFLECT_MISSION,
  RETAIN_MISSION,
} from "./config";

export async function setupDecisionDnaBank() {
  const client = getHindsightClient();

  const bank = await client.createBank(DECISIONDNA_BANK_ID, {
    name: "DecisionDNA — NovaPay",
    background:
      "Persistent organizational memory for NovaPay engineering decisions, incidents, constraints, and outcomes.",
    disposition: {
      skepticism: 4,
      literalism: 4,
      empathy: 1,
    },
  });

  await client.updateBankConfig(DECISIONDNA_BANK_ID, {
    retainMission: RETAIN_MISSION,
    retainExtractionMode: "verbose",
    observationsMission: OBSERVATIONS_MISSION,
    reflectMission: REFLECT_MISSION,
    enableObservations: true,
    enableTemporalRetrieval: true,
    enableTextSearch: true,
  });

  return bank;
}
