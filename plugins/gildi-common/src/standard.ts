// The shape of a module's standard.yaml. Owned here rather than restated by
// each consumer: a validator whose idea of the vocabulary can drift from the
// code that reads it reports green while checking the wrong thing.
//
// These are the POST-VALIDATION contract — what a consumer may assume once
// `validateStandard` returns no issues. The validator keeps its own raw shape,
// where every field is optional and untrusted, because a validator's input is
// by definition unvalidated. The two are complementary, not duplicated.

// A CLOSED vocabulary, not an expression language. Two reasons, both in design
// §4: standard.yaml has to stay readable by the humans who trust it, and it is
// read OVER THE NETWORK from volundr — a general expression language evaluated
// on a remotely fetched file is a far larger security surface than three typed
// predicates.
export const CHECK_TYPES = [
  'file-contains',
  'workflow-job-uses',
  'pages-source-branch',
] as const;

export type CheckType = (typeof CHECK_TYPES)[number];

export interface Check {
  type: CheckType;
  value: string;
}

export interface Trial {
  id: string;
  rule: string;
  artifact: string;
  factSource: string;
  // Optional: the mock security standard declares no checks, and its trials
  // resolve to unmeasured{no-resolver} rather than being rejected outright.
  check?: Check;
  remediation: string;
}

export interface Block {
  id: string;
  appliesTo: string[];
  trials: Trial[];
}

export interface Standard {
  id: string;
  aspect: string;
  owner?: string;
  filter?: { kind?: string };
  // spec.type -> default facets, overridable per component by the
  // siliconsaga.org/facets annotation.
  facetDefaults?: Record<string, string[]>;
  blocks: Block[];
}
