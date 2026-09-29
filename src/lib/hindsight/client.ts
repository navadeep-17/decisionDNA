import { HindsightClient } from "@vectorize-io/hindsight-client";
import { recallEvidenceSchema, reflectResultSchema } from "@/lib/validation/memory";

type RecallOptions = NonNullable<Parameters<HindsightClient["recall"]>[2]>;
type RecallResponse = Awaited<ReturnType<HindsightClient["recall"]>>;
type RecallItem = RecallResponse["results"][number];
type ReflectResponse = Awaited<ReturnType<HindsightClient["reflect"]>>;
type ReflectOptions = NonNullable<Parameters<HindsightClient["reflect"]>[2]>;

type DecisionDNARecallItem = Omit<RecallItem, "type"> & {
  type?: string;
  score?: number;
};

type DecisionDNARecallResponse = Omit<RecallResponse, "results"> & {
  results: DecisionDNARecallItem[];
};

type DecisionDNARecallOptions = RecallOptions & {
  /**
   * Backward-compatible result-count cap used by DecisionDNA routes.
   * Hindsight 0.10.x uses maxTokens instead of a result-count `limit`.
   */
  limit?: number;
};

type DecisionDNAHindsightClient = Omit<HindsightClient, "recall" | "reflect"> & {
  recall(
    bankId: string,
    query: string,
    options?: DecisionDNARecallOptions,
  ): Promise<DecisionDNARecallResponse>;
  reflect(
    bankId: string,
    query: string,
    options?: ReflectOptions,
  ): Promise<ReflectResponse>;
};

let client: DecisionDNAHindsightClient | null = null;

function createDecisionDNAHindsightClient(baseUrl: string, apiKey: string) {
  const rawClient = new HindsightClient({ baseUrl, apiKey });
  const rawRecall = rawClient.recall.bind(rawClient);
  const rawReflect = rawClient.reflect.bind(rawClient);
  const adaptedClient = rawClient as unknown as DecisionDNAHindsightClient;

  adaptedClient.recall = async (bankId, query, options = {}) => {
    const { limit, ...currentOptions } = options;
    const result = await rawRecall(bankId, query, {
      ...currentOptions,
      maxTokens: currentOptions.maxTokens ?? 4096,
    });

    const resultLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : result.results.length;

    const adaptedResult = {
      ...result,
      results: result.results.slice(0, resultLimit).map((item) => ({
        ...item,
        type: item.type ?? undefined,
        score: item.scores?.final ?? item.scores?.reranker ?? undefined,
      })),
    };

    // Fail closed if the SDK or service returns an unexpected shape. This prevents
    // downstream intelligence features from silently reasoning over malformed data.
    recallEvidenceSchema.parse(adaptedResult);
    return adaptedResult;
  };

  adaptedClient.reflect = async (bankId, query, options = {}) => {
    const result = await rawReflect(bankId, query, options);
    reflectResultSchema.parse(result);
    return result;
  };

  return adaptedClient;
}

export function getHindsightClient() {
  if (client) return client;

  const baseUrl = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";
  const apiKey = process.env.HINDSIGHT_API_KEY;

  if (!apiKey) {
    throw new Error(
      "HINDSIGHT_API_KEY is missing. Copy .env.example to .env.local and add your Hindsight Cloud API key.",
    );
  }

  client = createDecisionDNAHindsightClient(baseUrl, apiKey);
  return client;
}
