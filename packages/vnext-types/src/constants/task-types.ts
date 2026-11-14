export enum TaskType {
  DaprHttpEndpoint = 1,
  DaprBinding = 2,
  DaprService = 3,
  DaprPubSub = 4,
  Human = 5,
  Http = 6,
  Script = 7,
  Condition = 8,
  Timer = 9,
  Notification = 10,
  StartTrigger = 11,
  DirectTrigger = 12,
  GetInstanceData = 13,
  SubProcess = 14,
  GetInstances = 15,
  Soap = 16,
  StateStore = 17,
  CacheAside = 18,
  GetInstance = 19,
  DaprConversation = 20,
  FanOut = 21,
  /** Type-6 config contract, executed in-process by the orchestrator (no Dapr sidecar). */
  ExternalHttp = 22,
  /**
   * Calls a named handler in the domain's Python runtime container
   * (vnext-schema 0.0.59 / runtime 0.0.103). Config: `handler`, `input`,
   * `timeoutSeconds`; no inline script.
   */
  Python = 23,
  /** Calls one operation of a remote MCP server over streamable HTTP, in-process on the orchestrator. Runtime 0.0.105 (experimental). */
  Mcp = 24,
}
