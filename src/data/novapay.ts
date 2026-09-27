export type NovaPayEvent = {
  id: string;
  date: string;
  type: "proposal" | "decision" | "incident" | "investigation" | "outcome" | "capability-change";
  project: "checkout";
  title: string;
  content: string;
};

export const novapayRedisHistory: NovaPayEvent[] = [
  {
    id: "EVT-001",
    date: "2026-01-12T09:30:00.000Z",
    type: "proposal",
    project: "checkout",
    title: "Redis session store proposed",
    content:
      "NovaPay Platform proposed moving checkout session state from PostgreSQL to a self-managed Redis cluster. The team expected lower latency during flash-sale traffic. Priya Shah noted that the infrastructure team had only two engineers and warned that operating another stateful system could increase on-call load.",
  },
  {
    id: "EVT-002",
    date: "2026-01-18T11:00:00.000Z",
    type: "decision",
    project: "checkout",
    title: "Redis approved for trial",
    content:
      "Decision DEC-017: NovaPay approved a limited rollout of self-managed Redis for checkout sessions. The decision was conditional on Redis memory usage remaining below 65 percent under projected peak traffic and on the Platform team being able to operate the cluster without adding headcount.",
  },
  {
    id: "EVT-003",
    date: "2026-02-03T18:40:00.000Z",
    type: "incident",
    project: "checkout",
    title: "INC-142 Redis memory pressure",
    content:
      "Incident INC-142: During a promotion, checkout traffic reached roughly 4.2 times normal volume. Redis memory usage exceeded 92 percent, eviction increased sharply, and some active sessions were lost. Checkout conversion dropped for 21 minutes. The incident commander identified memory pressure and insufficient operational headroom as the immediate causes.",
  },
  {
    id: "EVT-004",
    date: "2026-02-04T10:15:00.000Z",
    type: "investigation",
    project: "checkout",
    title: "INC-142 postmortem",
    content:
      "The INC-142 postmortem concluded that NovaPay underestimated burst traffic, had weak Redis capacity alarms, and lacked enough infrastructure staff to tune and operate the cluster safely. The team could add capacity, but doing so would increase operational overhead for a workload that PostgreSQL had previously handled reliably.",
  },
  {
    id: "EVT-005",
    date: "2026-02-05T16:00:00.000Z",
    type: "decision",
    project: "checkout",
    title: "Redis rejected for checkout sessions",
    content:
      "Decision DEC-021: NovaPay stopped using self-managed Redis for checkout session storage and returned to PostgreSQL-backed sessions. Redis was rejected primarily because the small Platform team could not justify the operational burden and memory-management risk after INC-142. The decision explicitly states that Redis may be reconsidered if operational ownership becomes managed externally or the infrastructure team expands substantially.",
  },
  {
    id: "EVT-006",
    date: "2026-03-15T12:00:00.000Z",
    type: "outcome",
    project: "checkout",
    title: "PostgreSQL session outcome",
    content:
      "Six weeks after DEC-021, PostgreSQL-backed checkout sessions remained stable through two marketing campaigns. Session latency was slightly higher than the Redis trial but stayed within the product SLO. There were no session-loss incidents during this period.",
  },
  {
    id: "EVT-007",
    date: "2026-08-14T09:00:00.000Z",
    type: "capability-change",
    project: "checkout",
    title: "Managed Redis Cloud adopted",
    content:
      "NovaPay adopted a managed Redis Cloud service for rate limiting and ephemeral workloads. The provider now owns cluster patching, failover, memory scaling, backups, and most capacity operations. The Platform team no longer operates Redis infrastructure directly, removing much of the operational burden that existed during INC-142.",
  },
  {
    id: "EVT-008",
    date: "2026-09-10T14:00:00.000Z",
    type: "outcome",
    project: "checkout",
    title: "Managed Redis operating successfully",
    content:
      "After four weeks of managed Redis Cloud usage for rate limiting, NovaPay reported no Redis-related incidents and materially lower operational effort. The provider's automatic scaling handled two traffic spikes without manual intervention. No decision has yet been made to move checkout sessions back to Redis.",
  },
];
