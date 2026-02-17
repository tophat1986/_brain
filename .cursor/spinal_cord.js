#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Canonical relative paths used by the runtime checks.
const BRAIN_ROOT = "_brain_v1";
const HOMEOSTASIS_REL_PATH = normalizePathSep(path.join(BRAIN_ROOT, "homeostasis.yaml"));
const VITALS_REL_PATH = normalizePathSep(path.join(BRAIN_ROOT, "4_evolution", "vitals.yaml"));

// Minimal bootstrap set: if these are missing, the Brain layer is not fully wired.
const REQUIRED_BOOTSTRAP_REL_PATHS = [
  HOMEOSTASIS_REL_PATH,
  VITALS_REL_PATH,
  normalizePathSep(path.join(BRAIN_ROOT, "1_directives", "synapses", "0-9", "_syn_1_surgical_triage_rubric.md")),
  normalizePathSep(path.join(BRAIN_ROOT, "1_directives", "synapses", "0-9", "_syn_2_phase_lock_protocol.md")),
  normalizePathSep(path.join(BRAIN_ROOT, "1_directives", "synapses", "10-99", "_syn_10_director_chain_ingestion_order.md")),
  normalizePathSep(path.join(BRAIN_ROOT, "2_identity", "synapses", "0-9", "_syn_7_core_values_pillars.md")),
  normalizePathSep(path.join(BRAIN_ROOT, "3_context", "synapses", "0-9", "_syn_8_tech_stack_map_drift_protocol.md")),
];

// If vitals are older than this threshold, the runtime will warn once per session.
const VITALS_STALE_DAYS = 7;

// Prompt triage keyword sets (high-signal phrases only to keep false positives low).
const TRIAGE_SKELETAL_KEYWORDS = [
  "architecture",
  "infrastructure",
  "schema migration",
  "database migration",
  "new dependency",
  "install package",
  "upgrade dependency",
  "downgrade dependency",
  "ci pipeline",
  "deployment pipeline",
  "dockerfile",
  "kubernetes",
  "terraform",
  "monorepo",
  "build system",
  "tsconfig",
  "vite.config",
  "webpack config",
  "eslint config",
  "auth flow",
  "permissions model",
  "api contract",
  "cross-cutting",
  "global config",
];

const TRIAGE_SURFACE_KEYWORDS = [
  "typo",
  "spelling",
  "wording",
  "copy edit",
  "docs",
  "documentation",
  "readme",
  "comment",
  "formatting",
  "lint fix",
  "ui text",
  "placeholder text",
  "css color",
  "style only",
];

// Reads raw hook payload from stdin. Cursor sends hook metadata as JSON text.
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

// Hook handlers must return JSON to stdout. No logs/noise.
function writeStdoutJson(obj) {
  process.stdout.write(JSON.stringify(obj ?? {}));
}

// Parse JSON defensively. Bad payloads should fail open, not crash hooks.
function safeJsonParse(raw, fallback) {
  try {
    if (!raw || !raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

// Stable digest used for cortex and state dedupe.
function sha256Hex(text) {
  return crypto.createHash("sha256").update(text ?? "", "utf8").digest("hex");
}

// Tiny fs helpers kept dependency-free for fast hook execution.
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readUtf8IfExists(filePath) {
  try {
    if (!fileExists(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function writeUtf8(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content ?? "", "utf8");
}

function normalizePathSep(p) {
  return String(p ?? "").replace(/\\/g, "/");
}

// Resolve which workspace root owns _brain_v1 when multi-root workspaces are open.
function resolveWorkspaceRoot(workspaceRoots) {
  if (Array.isArray(workspaceRoots)) {
    for (const root of workspaceRoots) {
      if (!root || typeof root !== "string") continue;
      if (fileExists(path.join(root, "_brain_v1"))) return root;
    }
    if (workspaceRoots[0] && typeof workspaceRoots[0] === "string") return workspaceRoots[0];
  }
  return process.cwd();
}

// Normalize a hook path to workspace-relative for pattern matching.
function toRelPath(filePath, workspaceRoot) {
  if (!filePath || typeof filePath !== "string") return "";

  const abs = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  const rel = normalizePathSep(path.relative(workspaceRoot, abs));
  // If it's outside workspaceRoot, fall back to normalized input.
  if (rel.startsWith("../") || rel.startsWith("..\\")) return normalizePathSep(filePath);
  return rel;
}

// Accept bare strings or quoted values from minimal YAML parsing.
function stripWrappingQuotes(s) {
  const v = String(s ?? "").trim();
  if (!v) return v;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

// Remove trailing inline YAML comments in the shape: "value # comment".
function stripYamlInlineComment(value) {
  return String(value ?? "").split(/\s+#/)[0].trim();
}

function parseIntegerMaybe(value) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseBooleanMaybe(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function parseIsoToEpochMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? ms : null;
}

function computeAgeDays(isoTimestamp) {
  const tsMs = parseIsoToEpochMs(isoTimestamp);
  if (tsMs == null) return null;
  const diffMs = Date.now() - tsMs;
  if (!Number.isFinite(diffMs)) return null;
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

function normalizeForKeywordScan(text) {
  return String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function collectKeywordHits(normalizedPrompt, keywords) {
  const hits = [];
  for (const keyword of keywords) {
    if (normalizedPrompt.includes(keyword)) hits.push(keyword);
  }
  return hits;
}

function tryCoercePromptText(value) {
  if (typeof value === "string") {
    const v = value.trim();
    return v || null;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    return parts.length > 0 ? parts.join("\n") : null;
  }

  if (value && typeof value === "object") {
    const objectCandidates = ["text", "content", "prompt", "message", "input"];
    for (const key of objectCandidates) {
      const nested = tryCoercePromptText(value[key]);
      if (nested) return nested;
    }
  }

  return null;
}

function extractPromptTextFromHookInput(input) {
  const directCandidates = [
    "prompt",
    "text",
    "message",
    "user_message",
    "user_prompt",
    "submitted_prompt",
    "current_prompt",
  ];
  for (const key of directCandidates) {
    const text = tryCoercePromptText(input?.[key]);
    if (text) return text;
  }

  const nestedContainers = ["payload", "request", "data", "tool_input"];
  for (const key of nestedContainers) {
    const text = tryCoercePromptText(input?.[key]);
    if (text) return text;
  }

  return null;
}

function classifyPromptTriage(input) {
  const promptText = extractPromptTextFromHookInput(input);
  if (!promptText) {
    return {
      grade: "B",
      layer: "muscle",
      promptAvailable: false,
      reason: "prompt_unavailable",
      hits: [],
    };
  }

  const normalized = normalizeForKeywordScan(promptText);
  const skeletalHits = collectKeywordHits(normalized, TRIAGE_SKELETAL_KEYWORDS);
  if (skeletalHits.length > 0) {
    return {
      grade: "A",
      layer: "skeletal",
      promptAvailable: true,
      reason: `skeletal_signals:${skeletalHits.slice(0, 3).join("|")}`,
      hits: skeletalHits,
    };
  }

  const surfaceHits = collectKeywordHits(normalized, TRIAGE_SURFACE_KEYWORDS);
  if (surfaceHits.length > 0) {
    return {
      grade: "C",
      layer: "surface",
      promptAvailable: true,
      reason: `surface_signals:${surfaceHits.slice(0, 3).join("|")}`,
      hits: surfaceHits,
    };
  }

  return {
    grade: "B",
    layer: "muscle",
    promptAvailable: true,
    reason: "default_logic_scope",
    hits: [],
  };
}

// Lightweight, purpose-built parser for the current homeostasis schema.
function parseHomeostasisYaml(text) {
  const result = {
    mindset: { mode: null, caution: null, focus: null },
    reflexes: { motor: [], sensory: [], inhibition: [] },
  };

  const lines = String(text ?? "").split(/\r?\n/);
  let section = null; // "MINDSET" | "REFLEXES" | null
  let reflexKey = null; // "motor" | "sensory" | "inhibition" | null

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (/^MINDSET:\s*$/.test(trimmed)) {
      section = "MINDSET";
      reflexKey = null;
      continue;
    }

    if (/^REFLEXES:\s*$/.test(trimmed)) {
      section = "REFLEXES";
      reflexKey = null;
      continue;
    }

    if (section === "MINDSET") {
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)?$/);
      if (!m) continue;
      const key = m[1];
      const valueRaw = stripYamlInlineComment(String(m[2] ?? "").trim());
      const valueNoComment = valueRaw.trim();
      const value = stripWrappingQuotes(valueNoComment);
      if (key === "mode" || key === "caution" || key === "focus") {
        result.mindset[key] = value || null;
      }
      continue;
    }

    if (section === "REFLEXES") {
      const keyMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (keyMatch) {
        const key = keyMatch[1];
        const rest = (keyMatch[2] ?? "").trim();
        if (key === "motor" || key === "sensory" || key === "inhibition") {
          reflexKey = key;
          // Support inline empty list: motor: []
          if (rest === "[]") result.reflexes[reflexKey] = [];
        }
        continue;
      }

      const itemMatch = trimmed.match(/^-+\s*(.+)\s*$/);
      if (itemMatch && reflexKey) {
        const itemRaw = stripYamlInlineComment(String(itemMatch[1] ?? "").trim());
        const itemNoComment = itemRaw.trim();
        const item = stripWrappingQuotes(itemNoComment);
        if (item) result.reflexes[reflexKey].push(item);
      }
    }
  }

  return result;
}

// Lightweight parser for vitals fields needed by runtime policy decisions.
function parseVitalsYaml(text) {
  const result = {
    generatedAt: null,
    brainVitals: { lastScanAt: null, mdFiles: null, mdLines: null, mdBytes: null },
    chemicalState: { inflammation: null, cortisol: null, mode: null },
    gates: { blockNewFeatures: null, requireWbc: [] },
  };

  const lines = String(text ?? "").split(/\r?\n/);
  let section = null;
  let listKey = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = (line.match(/^ */) || [""])[0].length;

    // Top-level keys: either "section:" or scalar "key: value".
    if (indent === 0) {
      listKey = null;
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const rest = stripYamlInlineComment(String(m[2] ?? "").trim());
      if (!rest) {
        section = key;
        continue;
      }
      section = null;
      if (key === "generated_at") result.generatedAt = stripWrappingQuotes(rest);
      continue;
    }

    // Section-level keys under a top-level block.
    if (indent === 2) {
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const rest = stripYamlInlineComment(String(m[2] ?? "").trim());
      listKey = null;

      if (section === "brain_vitals") {
        if (key === "last_scan_at") result.brainVitals.lastScanAt = stripWrappingQuotes(rest);
        if (key === "md_files") result.brainVitals.mdFiles = parseIntegerMaybe(rest);
        if (key === "md_lines") result.brainVitals.mdLines = parseIntegerMaybe(rest);
        if (key === "md_bytes") result.brainVitals.mdBytes = parseIntegerMaybe(rest);
        continue;
      }

      if (section === "chemical_state") {
        if (key === "inflammation") result.chemicalState.inflammation = parseIntegerMaybe(rest);
        if (key === "cortisol") result.chemicalState.cortisol = parseIntegerMaybe(rest);
        if (key === "mode") result.chemicalState.mode = stripWrappingQuotes(rest) || null;
        continue;
      }

      if (section === "gates") {
        if (key === "block_new_features") result.gates.blockNewFeatures = parseBooleanMaybe(rest);
        if (key === "require_wbc") {
          listKey = "require_wbc";
          result.gates.requireWbc = rest === "[]" ? [] : result.gates.requireWbc;
        }
      }
      continue;
    }

    // List items under gates.require_wbc.
    if (indent >= 4 && section === "gates" && listKey === "require_wbc") {
      const itemMatch = trimmed.match(/^-+\s*(.+)\s*$/);
      if (!itemMatch) continue;
      const raw = stripYamlInlineComment(String(itemMatch[1] ?? "").trim());
      const item = stripWrappingQuotes(raw);
      if (item) result.gates.requireWbc.push(item);
    }
  }

  return result;
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob) {
  const g = normalizePathSep(String(glob ?? "").trim()).replace(/^\.\//, "");
  let re = "^";
  for (let i = 0; i < g.length; i += 1) {
    const ch = g[i];
    if (ch === "*") {
      const next = g[i + 1];
      if (next === "*") {
        re += ".*";
        i += 1;
      } else {
        re += "[^/]*";
      }
      continue;
    }
    if (ch === "?") {
      re += "[^/]";
      continue;
    }
    re += escapeRegExp(ch);
  }
  re += "$";
  return new RegExp(re);
}

function matchesPathPattern(relPath, pattern) {
  const rel = normalizePathSep(relPath);
  const pat = normalizePathSep(String(pattern ?? "").trim());
  if (!pat) return false;

  // If the pattern is a simple basename (no slashes), match basename anywhere.
  if (!pat.includes("/")) {
    const base = rel.split("/").pop() || rel;
    if (base === pat) return true;
    const anywhere = globToRegExp(`**/${pat}`);
    if (anywhere.test(rel)) return true;
  }

  return globToRegExp(pat).test(rel);
}

function wildcardToRegExp(pattern) {
  const p = String(pattern ?? "");
  // Treat '*' as "match anything", otherwise substring-match via regex.
  const re = "^" + escapeRegExp(p).replace(/\\\*/g, ".*") + "$";
  return new RegExp(re, "i");
}

function matchesCommandPattern(command, pattern) {
  const cmd = String(command ?? "");
  const pat = String(pattern ?? "").trim();
  if (!pat) return false;
  if (pat.includes("*")) return wildcardToRegExp(pat).test(cmd);
  return cmd.toLowerCase().includes(pat.toLowerCase());
}

function compactList(items) {
  const arr = Array.isArray(items) ? items : [];
  if (arr.length === 0) return "[]";
  return `[${arr.map((x) => JSON.stringify(String(x))).join(", ")}]`;
}

// Persisted cortex digest consumed as compact context in later session operations.
function buildCortexYaml({ mindset, reflexes, hash, pulse }) {
  const m = mindset ?? {};
  const r = reflexes ?? {};
  const p = pulse ?? {};
  const v = p.vitals ?? {};

  const mindsetLine = [
    `mode: ${JSON.stringify(m.mode ?? "")}`,
    `caution: ${JSON.stringify(m.caution ?? "")}`,
    `focus: ${JSON.stringify(m.focus ?? "")}`,
  ].join(", ");

  const listBlock = (items) => {
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0) return "  []";
    return ["", ...arr.map((x) => `  - ${JSON.stringify(String(x))}`)].join("\n");
  };

  return [
    "# AUTO-GENERATED - DO NOT EDIT",
    "# Source: _brain_v1/homeostasis.yaml",
    `workspace_root: ${JSON.stringify(p.workspaceRoot ?? "")}`,
    `MINDSET: { ${mindsetLine} }`,
    "REFLEXES:",
    `  motor:${listBlock(r.motor)}`,
    `  sensory:${listBlock(r.sensory)}`,
    `  inhibition:${listBlock(r.inhibition)}`,
    `VITALS: { generated_at: ${JSON.stringify(v.generatedAt ?? "")}, age_days: ${JSON.stringify(v.ageDaysLabel ?? "unknown")}, inflammation: ${JSON.stringify(v.inflammation ?? "unknown")}, cortisol: ${JSON.stringify(v.cortisol ?? "unknown")}, mode: ${JSON.stringify(v.mode ?? "unknown")} }`,
    `GATES: { block_new_features: ${JSON.stringify(v.blockNewFeatures ?? "unknown")}, require_wbc: ${compactList(v.requireWbc)} }`,
    `BOOTSTRAP: { missing_core_files: ${compactList(p.missingCoreFiles)} }`,
    `ALERTS: ${compactList(p.alerts)}`,
    'INSTINCT: "Motor reflex denies writes. Sensory reflex denies reads. Inhibition denies shell/MCP."',
    `HASH: ${JSON.stringify(hash)}`,
    "",
  ].join("\n");
}

function buildAdditionalContext({ mindset, reflexes, hash, pulse }) {
  const m = mindset ?? {};
  const r = reflexes ?? {};
  const p = pulse ?? {};
  const v = p.vitals ?? {};

  return [
    "_brain cortex (auto-injected by Cursor hooks)",
    `source: _brain_v1/homeostasis.yaml`,
    `workspace_root: ${p.workspaceRoot ?? ""}`,
    `hash: ${hash}`,
    `MINDSET: { mode: ${JSON.stringify(m.mode ?? "")}, caution: ${JSON.stringify(m.caution ?? "")}, focus: ${JSON.stringify(m.focus ?? "")} }`,
    `REFLEXES: { sensory: ${compactList(r.sensory)}, motor: ${compactList(r.motor)}, inhibition: ${compactList(r.inhibition)} }`,
    `VITALS: { generated_at: ${JSON.stringify(v.generatedAt ?? "")}, age_days: ${JSON.stringify(v.ageDaysLabel ?? "unknown")}, inflammation: ${JSON.stringify(v.inflammation ?? "unknown")}, cortisol: ${JSON.stringify(v.cortisol ?? "unknown")}, mode: ${JSON.stringify(v.mode ?? "unknown")} }`,
    `GATES: { block_new_features: ${JSON.stringify(v.blockNewFeatures ?? "unknown")}, require_wbc: ${compactList(v.requireWbc)} }`,
    `BOOTSTRAP: { missing_core_files: ${compactList(p.missingCoreFiles)} }`,
    `ALERTS: ${compactList(p.alerts)}`,
    "INSTINCT: sensory=blindness (deny read), motor=withdrawal (deny write), inhibition=deny shell/MCP",
  ].join("\n");
}

function buildTriageAdditionalContext(triage) {
  const t = triage ?? {};
  const phase = t.grade === "A" ? "ARCHITECT_LOCK" : "SURGEON_ELIGIBLE";
  return [
    "_brain triage",
    `TRIAGE: { grade: ${JSON.stringify(t.grade ?? "B")}, layer: ${JSON.stringify(t.layer ?? "muscle")}, reason: ${JSON.stringify(t.reason ?? "unknown")}, phase: ${JSON.stringify(phase)} }`,
    `TRIAGE_MATCHES: ${compactList(t.hits)}`,
  ].join("\n");
}

function appendAdditionalContext(existing, extra) {
  if (!extra) return existing ?? "";
  if (!existing) return extra;
  return `${existing}\n${extra}`;
}

function appendUserMessage(out, message) {
  if (!message) return;
  if (!out.user_message) {
    out.user_message = message;
    return;
  }
  out.user_message = `${out.user_message}\n${message}`;
}

function loadHomeostasis(workspaceRoot) {
  const homeostasisPath = path.join(workspaceRoot, HOMEOSTASIS_REL_PATH);
  const rawOrNull = readUtf8IfExists(homeostasisPath);
  const raw = rawOrNull ?? "";
  return {
    homeostasisPath,
    exists: rawOrNull != null,
    raw,
    hash: sha256Hex(raw),
    parsed: parseHomeostasisYaml(raw),
  };
}

function loadVitals(workspaceRoot) {
  const vitalsPath = path.join(workspaceRoot, VITALS_REL_PATH);
  const rawOrNull = readUtf8IfExists(vitalsPath);
  const raw = rawOrNull ?? "";
  return {
    vitalsPath,
    exists: rawOrNull != null,
    raw,
    parsed: parseVitalsYaml(raw),
  };
}

function getBootstrapStatus(workspaceRoot) {
  const missing = [];
  for (const rel of REQUIRED_BOOTSTRAP_REL_PATHS) {
    const abs = path.join(workspaceRoot, rel);
    if (!fileExists(abs)) missing.push(rel);
  }
  return { required: REQUIRED_BOOTSTRAP_REL_PATHS, missing };
}

function buildPulseSnapshot({ workspaceRoot, homeostasis, vitals }) {
  const mindset = homeostasis?.parsed?.mindset ?? {};
  const reflexes = homeostasis?.parsed?.reflexes ?? {};
  const vitalsParsed = vitals?.parsed ?? {};
  const chemical = vitalsParsed.chemicalState ?? {};
  const gates = vitalsParsed.gates ?? {};
  const bootstrap = getBootstrapStatus(workspaceRoot);

  const sensoryCount = Array.isArray(reflexes.sensory) ? reflexes.sensory.length : 0;
  const motorCount = Array.isArray(reflexes.motor) ? reflexes.motor.length : 0;
  const inhibitionCount = Array.isArray(reflexes.inhibition) ? reflexes.inhibition.length : 0;
  const vitalsAgeDays = computeAgeDays(vitalsParsed.generatedAt);

  const alerts = [];
  if (!homeostasis.exists) alerts.push("homeostasis_missing");
  if (!vitals.exists) alerts.push("vitals_missing");
  if (bootstrap.missing.length > 0) alerts.push(`missing_core_files:${bootstrap.missing.length}`);

  if (vitalsAgeDays != null && vitalsAgeDays > VITALS_STALE_DAYS) {
    alerts.push(`vitals_stale:${vitalsAgeDays.toFixed(1)}d`);
  }

  if (gates.blockNewFeatures === true) alerts.push("gate:block_new_features=true");
  if (Array.isArray(gates.requireWbc) && gates.requireWbc.length > 0) {
    alerts.push(`gate:require_wbc:${gates.requireWbc.length}`);
  }

  if (Number.isInteger(chemical.inflammation) && chemical.inflammation >= 1) {
    alerts.push(`inflammation:${chemical.inflammation}`);
  }
  if (Number.isInteger(chemical.cortisol) && chemical.cortisol >= 2) {
    alerts.push(`cortisol:${chemical.cortisol}`);
  }

  const vitalsAgeDaysLabel = vitalsAgeDays == null ? "unknown" : vitalsAgeDays.toFixed(1);
  const oneLine = [
    "_brain pulse",
    `mode=${mindset.mode ?? "unknown"}`,
    `caution=${mindset.caution ?? "unknown"}`,
    `focus=${mindset.focus ?? "unknown"}`,
    `inflammation=${chemical.inflammation ?? "unknown"}`,
    `cortisol=${chemical.cortisol ?? "unknown"}`,
    `block_new_features=${gates.blockNewFeatures ?? "unknown"}`,
    `reflexes(s/m/i)=${sensoryCount}/${motorCount}/${inhibitionCount}`,
    `vitals_age_days=${vitalsAgeDaysLabel}`,
  ].join(" | ");

  const attentionMessage = alerts.length > 0 ? `BRAIN ATTENTION: ${alerts.join(" | ")}` : null;
  const attentionHash = alerts.length > 0 ? sha256Hex(alerts.join("|")) : null;

  return {
    workspaceRoot,
    oneLine,
    attentionMessage,
    attentionHash,
    alerts,
    missingCoreFiles: bootstrap.missing,
    vitals: {
      generatedAt: vitalsParsed.generatedAt ?? null,
      ageDaysLabel: vitalsAgeDaysLabel,
      inflammation: chemical.inflammation,
      cortisol: chemical.cortisol,
      mode: chemical.mode ?? null,
      blockNewFeatures: gates.blockNewFeatures,
      requireWbc: Array.isArray(gates.requireWbc) ? gates.requireWbc : [],
    },
  };
}

function loadSynapticState(workspaceRoot) {
  const p = path.join(workspaceRoot, ".cursor", "synaptic_state.json");
  const raw = readUtf8IfExists(p);
  const obj = safeJsonParse(raw, null);
  return { path: p, value: obj };
}

function saveSynapticState(statePath, value) {
  const payload = JSON.stringify(value, null, 2) + "\n";
  writeUtf8(statePath, payload);
}

// Keeps .cursor/cortex.yaml and .cursor/synaptic_state.json in sync with homeostasis changes.
function updateCortexAndState({ workspaceRoot, sessionId }) {
  const homeostasis = loadHomeostasis(workspaceRoot);
  const vitals = loadVitals(workspaceRoot);
  const pulse = buildPulseSnapshot({ workspaceRoot, homeostasis, vitals });

  const cortexPath = path.join(workspaceRoot, ".cursor", "cortex.yaml");
  const syn = loadSynapticState(workspaceRoot);
  const prev = syn.value && typeof syn.value === "object" ? syn.value : {};

  const nowEpochSec = Math.floor(Date.now() / 1000);
  const nextState = {
    ...prev,
    session_id: sessionId ?? null,
    last_injected_hash: homeostasis.hash,
    last_check_timestamp: nowEpochSec,
  };

  const needsUpdate =
    !prev.last_injected_hash ||
    prev.session_id !== nextState.session_id ||
    prev.last_injected_hash !== nextState.last_injected_hash;

  if (needsUpdate) {
    writeUtf8(
      cortexPath,
      buildCortexYaml({
        mindset: homeostasis.parsed.mindset,
        reflexes: homeostasis.parsed.reflexes,
        hash: homeostasis.hash,
        pulse,
      }),
    );
    saveSynapticState(syn.path, nextState);
  } else {
    // Still update timestamp to prove liveness, but don't churn cortex.
    saveSynapticState(syn.path, nextState);
  }

  return { homeostasis, vitals, pulse, needsUpdate, statePath: syn.path, state: nextState };
}

function shouldEmitNoticeOncePerSession({
  workspaceRoot,
  sessionId,
  noticeHash,
  hashField,
  sessionField,
}) {
  if (!noticeHash || !hashField || !sessionField) return false;
  const syn = loadSynapticState(workspaceRoot);
  const prev = syn.value && typeof syn.value === "object" ? syn.value : {};
  const normalizedSessionId = sessionId ?? null;
  const alreadySent = prev[hashField] === noticeHash && prev[sessionField] === normalizedSessionId;

  if (alreadySent) return false;

  saveSynapticState(syn.path, {
    ...prev,
    [hashField]: noticeHash,
    [sessionField]: normalizedSessionId,
    last_check_timestamp: Math.floor(Date.now() / 1000),
  });

  return true;
}

function shouldEmitAttentionOncePerSession({ workspaceRoot, sessionId, attentionHash }) {
  return shouldEmitNoticeOncePerSession({
    workspaceRoot,
    sessionId,
    noticeHash: attentionHash,
    hashField: "last_attention_notice_hash",
    sessionField: "last_attention_notice_session_id",
  });
}

function shouldEmitTriageNoticeOncePerSession({ workspaceRoot, sessionId, triageHash }) {
  return shouldEmitNoticeOncePerSession({
    workspaceRoot,
    sessionId,
    noticeHash: triageHash,
    hashField: "last_triage_notice_hash",
    sessionField: "last_triage_notice_session_id",
  });
}

function getReflexes(workspaceRoot) {
  return loadHomeostasis(workspaceRoot).parsed.reflexes ?? { motor: [], sensory: [], inhibition: [] };
}

function extractFilePathFromToolInput(toolInput) {
  if (!toolInput || typeof toolInput !== "object") return null;
  const candidates = ["file_path", "filePath", "path", "target_file", "targetFile", "filename"];
  for (const k of candidates) {
    const v = toolInput[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

function handleSessionStart(input, workspaceRoot) {
  const sessionId = input.session_id || input.conversation_id || null;
  const { homeostasis, pulse } = updateCortexAndState({ workspaceRoot, sessionId });

  const out = {
    continue: true,
    env: {
      BRAIN_HOMEOSTASIS_HASH: homeostasis.hash,
      BRAIN_HOMEOSTASIS_PATH: path.join(workspaceRoot, HOMEOSTASIS_REL_PATH),
      BRAIN_CORTEX_PATH: path.join(workspaceRoot, ".cursor", "cortex.yaml"),
      BRAIN_VITALS_PATH: path.join(workspaceRoot, VITALS_REL_PATH),
    },
    user_message: pulse.oneLine,
  };

  out.additional_context = buildAdditionalContext({
    mindset: homeostasis.parsed.mindset,
    reflexes: homeostasis.parsed.reflexes,
    hash: homeostasis.hash,
    pulse,
  });

  return out;
}

function handleBeforeSubmitPrompt(input, workspaceRoot) {
  const sessionId = input.conversation_id || null;
  const { homeostasis, pulse, needsUpdate } = updateCortexAndState({ workspaceRoot, sessionId });
  const out = { continue: true };
  const triage = classifyPromptTriage(input);

  // If homeostasis changed mid-session, refresh context once with the new digest.
  if (needsUpdate) {
    out.additional_context = buildAdditionalContext({
      mindset: homeostasis.parsed.mindset,
      reflexes: homeostasis.parsed.reflexes,
      hash: homeostasis.hash,
      pulse,
    });
  }

  // Add a compact triage line when prompt payload is available.
  if (triage.promptAvailable) {
    out.additional_context = appendAdditionalContext(out.additional_context, buildTriageAdditionalContext(triage));
  }

  // Emit attention notices only once per session for the same alert set.
  if (
    pulse.attentionMessage &&
    shouldEmitAttentionOncePerSession({
      workspaceRoot,
      sessionId,
      attentionHash: pulse.attentionHash,
    })
  ) {
    appendUserMessage(out, pulse.attentionMessage);
  }

  // Surface skeletal triage only once per session for the same reason set.
  if (triage.grade === "A") {
    const triageHash = sha256Hex(`${triage.grade}|${triage.reason}|${(triage.hits ?? []).join("|")}`);
    if (
      shouldEmitTriageNoticeOncePerSession({
        workspaceRoot,
        sessionId,
        triageHash,
      })
    ) {
      const topSignals = (triage.hits ?? []).slice(0, 3).join(", ");
      const msg =
        topSignals.length > 0
          ? `BRAIN TRIAGE: Grade A (skeletal) -> PHASE ARCHITECT. Signals: ${topSignals}`
          : "BRAIN TRIAGE: Grade A (skeletal) -> PHASE ARCHITECT.";
      appendUserMessage(out, msg);
    }
  }

  return out;
}

function handlePreCompact(_input, workspaceRoot) {
  const cortexPath = path.join(workspaceRoot, ".cursor", "cortex.yaml");
  const cortex = readUtf8IfExists(cortexPath);
  if (!cortex) return {};
  return {
    user_message:
      "Context compaction: _brain cortex exists. If you changed `_brain_v1/homeostasis.yaml` or `_brain_v1/4_evolution/vitals.yaml`, start a new chat to re-inject cortex.",
  };
}

// Sensory reflex: deny reads that match protected paths.
function handleBeforeReadFile(input, workspaceRoot) {
  const filePath = input.file_path;
  const rel = toRelPath(filePath, workspaceRoot);
  const { sensory } = getReflexes(workspaceRoot);

  for (const pat of sensory ?? []) {
    if (matchesPathPattern(rel, pat)) {
      return { permission: "deny", user_message: "BLINDNESS: Sensory reflex prevents reading this file." };
    }
  }

  return { permission: "allow" };
}

// Motor reflex: deny write tool operations before mutation happens.
function handlePreToolUse(input, workspaceRoot) {
  const toolName = input.tool_name;
  if (toolName !== "Write") return { decision: "allow" };

  const filePath = extractFilePathFromToolInput(input.tool_input);
  if (!filePath) return { decision: "allow" };

  const rel = toRelPath(filePath, workspaceRoot);
  const { motor } = getReflexes(workspaceRoot);

  for (const pat of motor ?? []) {
    if (matchesPathPattern(rel, pat)) {
      return {
        decision: "deny",
        reason: "REFLEX TRIGGERED: Motor reflex prevents editing a protected file.",
      };
    }
  }

  return { decision: "allow" };
}

function replaceOnce(haystack, needle, replacement) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

// Motor fallback: if a protected file was edited, attempt a best-effort rollback.
function handleAfterFileEdit(input, workspaceRoot) {
  const filePath = input.file_path;
  if (!filePath) return {};

  const rel = toRelPath(filePath, workspaceRoot);
  const { motor } = getReflexes(workspaceRoot);

  let matched = false;
  for (const pat of motor ?? []) {
    if (matchesPathPattern(rel, pat)) {
      matched = true;
      break;
    }
  }
  if (!matched) return {};

  // Best-effort rollback: reverse each edit by swapping new_string -> old_string once.
  try {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
    const current = readUtf8IfExists(abs);
    if (current == null) return {};

    let reverted = current;
    const edits = Array.isArray(input.edits) ? input.edits : [];
    for (const e of edits) {
      const oldStr = typeof e?.old_string === "string" ? e.old_string : null;
      const newStr = typeof e?.new_string === "string" ? e.new_string : null;
      if (!oldStr || newStr == null) continue;
      reverted = replaceOnce(reverted, newStr, oldStr);
    }
    if (reverted !== current) writeUtf8(abs, reverted);
  } catch {
    // swallow
  }

  return {};
}

// Inhibition reflex: deny risky shell commands by pattern.
function handleBeforeShellExecution(input, workspaceRoot) {
  const cmd = input.command ?? "";
  const { inhibition } = getReflexes(workspaceRoot);

  for (const pat of inhibition ?? []) {
    if (matchesCommandPattern(cmd, pat)) {
      return {
        permission: "deny",
        user_message: "REFLEX TRIGGERED: Inhibition reflex blocked a command.",
        agent_message: "Inhibition reflex: shell execution denied by _brain reflexes.",
      };
    }
  }

  return { permission: "allow" };
}

// Inhibition reflex for MCP calls: inspect tool metadata and deny risky patterns.
function handleBeforeMcpExecution(input, workspaceRoot) {
  const haystack = [
    input.tool_name,
    input.command,
    input.url,
    input.tool_input,
  ]
    .filter(Boolean)
    .map(String)
    .join(" ");

  const { inhibition } = getReflexes(workspaceRoot);

  for (const pat of inhibition ?? []) {
    if (matchesCommandPattern(haystack, pat)) {
      return {
        permission: "deny",
        user_message: "REFLEX TRIGGERED: Inhibition reflex blocked an MCP tool call.",
        agent_message: "Inhibition reflex: MCP execution denied by _brain reflexes.",
      };
    }
  }

  return { permission: "allow" };
}

async function main() {
  const raw = await readStdin();
  const input = safeJsonParse(raw, {});
  const workspaceRoot = resolveWorkspaceRoot(input.workspace_roots);
  const event = input.hook_event_name || "";

  try {
    // Dispatch by hook event. Each handler returns the event-specific JSON contract.
    switch (event) {
      case "sessionStart":
        writeStdoutJson(handleSessionStart(input, workspaceRoot));
        return;
      case "beforeSubmitPrompt":
        writeStdoutJson(handleBeforeSubmitPrompt(input, workspaceRoot));
        return;
      case "preCompact":
        writeStdoutJson(handlePreCompact(input, workspaceRoot));
        return;
      case "beforeReadFile":
      case "beforeTabFileRead":
        writeStdoutJson(handleBeforeReadFile(input, workspaceRoot));
        return;
      case "preToolUse":
        writeStdoutJson(handlePreToolUse(input, workspaceRoot));
        return;
      case "afterFileEdit":
      case "afterTabFileEdit":
        writeStdoutJson(handleAfterFileEdit(input, workspaceRoot));
        return;
      case "beforeShellExecution":
        writeStdoutJson(handleBeforeShellExecution(input, workspaceRoot));
        return;
      case "beforeMCPExecution":
        writeStdoutJson(handleBeforeMcpExecution(input, workspaceRoot));
        return;
      default:
        writeStdoutJson({});
        return;
    }
  } catch {
    // Fail-open at the script level to avoid accidental lockouts due to bugs.
    if (event === "beforeReadFile" || event === "beforeTabFileRead") return writeStdoutJson({ permission: "allow" });
    if (event === "beforeMCPExecution") return writeStdoutJson({ permission: "allow" });
    if (event === "beforeShellExecution") return writeStdoutJson({ permission: "allow" });
    if (event === "beforeSubmitPrompt") return writeStdoutJson({ continue: true });
    if (event === "sessionStart") return writeStdoutJson({ continue: true });
    if (event === "preToolUse") return writeStdoutJson({ decision: "allow" });
    return writeStdoutJson({});
  }
}

main();

