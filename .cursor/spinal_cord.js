#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BRAIN_ROOT = "_brain_v1";
const HOMEOSTASIS_REL = toPosix(path.join(BRAIN_ROOT, "homeostasis.yaml"));
const VITALS_REL = toPosix(path.join(BRAIN_ROOT, "4_evolution", "vitals.yaml"));
const VITALS_STALE_DAYS = 7;

const CORE_REL_PATHS = [
  HOMEOSTASIS_REL,
  VITALS_REL,
  toPosix(path.join(BRAIN_ROOT, "1_directives", "synapses", "0-9", "_syn_1_surgical_triage_rubric.md")),
  toPosix(path.join(BRAIN_ROOT, "1_directives", "synapses", "0-9", "_syn_2_phase_lock_protocol.md")),
  toPosix(path.join(BRAIN_ROOT, "1_directives", "synapses", "10-99", "_syn_10_director_chain_ingestion_order.md")),
  toPosix(path.join(BRAIN_ROOT, "2_identity", "synapses", "0-9", "_syn_7_core_values_pillars.md")),
  toPosix(path.join(BRAIN_ROOT, "3_context", "synapses", "0-9", "_syn_8_tech_stack_map_drift_protocol.md")),
];

const FAIL_OPEN_BY_EVENT = {
  sessionStart: { continue: true },
  beforeSubmitPrompt: { continue: true },
  beforeReadFile: { permission: "allow" },
  beforeTabFileRead: { permission: "allow" },
  preToolUse: { decision: "allow" },
  beforeShellExecution: { permission: "allow" },
  beforeMCPExecution: { permission: "allow" },
};

const HANDLERS = {
  sessionStart: handleSessionStart,
  beforeSubmitPrompt: handleBeforeSubmitPrompt,
  preCompact: handlePreCompact,
  beforeReadFile: handleBeforeReadFile,
  beforeTabFileRead: handleBeforeReadFile,
  preToolUse: handlePreToolUse,
  afterFileEdit: handleAfterFileEdit,
  afterTabFileEdit: handleAfterFileEdit,
  beforeShellExecution: handleBeforeShellExecution,
  beforeMCPExecution: handleBeforeMcpExecution,
};

main();

async function main() {
  const raw = await readStdin();
  const input = safeJsonParse(raw, {});
  const event = String(input.hook_event_name || "");
  const workspaceRoot = resolveWorkspaceRoot(input.workspace_roots);

  try {
    const handler = HANDLERS[event];
    writeStdoutJson(handler ? handler(input, workspaceRoot) : {});
  } catch {
    writeStdoutJson(FAIL_OPEN_BY_EVENT[event] ?? {});
  }
}

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

function writeStdoutJson(obj) {
  process.stdout.write(JSON.stringify(obj ?? {}));
}

function safeJsonParse(raw, fallback) {
  try {
    if (!raw || !String(raw).trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text ?? "", "utf8").digest("hex");
}

function nowEpochSec() {
  return Math.floor(Date.now() / 1000);
}

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

function toPosix(p) {
  return String(p ?? "").replace(/\\/g, "/");
}

function resolveWorkspaceRoot(workspaceRoots) {
  if (Array.isArray(workspaceRoots)) {
    for (const root of workspaceRoots) {
      if (typeof root === "string" && root && fileExists(path.join(root, BRAIN_ROOT))) return root;
    }
    if (typeof workspaceRoots[0] === "string" && workspaceRoots[0]) return workspaceRoots[0];
  }
  return process.cwd();
}

function toWorkspaceRelPath(filePath, workspaceRoot) {
  if (typeof filePath !== "string" || !filePath.trim()) return "";
  const abs = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  const rel = toPosix(path.relative(workspaceRoot, abs));
  if (rel.startsWith("../") || rel.startsWith("..\\")) return toPosix(filePath);
  return rel;
}

function stripYamlComment(value) {
  return String(value ?? "").replace(/\s+#.*$/, "");
}

function stripWrappingQuotes(value) {
  const v = String(value ?? "").trim();
  if (!v) return v;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function coerceYamlScalar(value) {
  const v = stripWrappingQuotes(stripYamlComment(value).trim());
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return v;
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

// Minimal parser for _brain homeostasis/vitals sections used by runtime hooks.
function parseYamlSections(text) {
  const root = {};
  const lines = String(text ?? "").split(/\r?\n/);
  let section = null;
  let listKey = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");
    const noComment = stripYamlComment(line);
    const trimmed = noComment.trim();
    if (!trimmed) continue;

    const indent = (line.match(/^ */) || [""])[0].length;

    if (indent === 0) {
      section = null;
      listKey = null;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      const rest = (match[2] ?? "").trim();
      if (!rest) {
        section = key;
        if (!isObject(root[section])) root[section] = {};
      } else {
        root[key] = coerceYamlScalar(rest);
      }
      continue;
    }

    if (indent === 2 && section) {
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      const rest = (match[2] ?? "").trim();
      listKey = null;

      if (!isObject(root[section])) root[section] = {};
      if (!rest) {
        root[section][key] = Array.isArray(root[section][key]) ? root[section][key] : [];
        listKey = key;
      } else if (rest === "[]") {
        root[section][key] = [];
      } else {
        root[section][key] = coerceYamlScalar(rest);
      }
      continue;
    }

    if (indent >= 4 && section && listKey) {
      const item = trimmed.match(/^-+\s*(.+)\s*$/);
      if (!item) continue;
      if (!Array.isArray(root[section][listKey])) root[section][listKey] = [];
      root[section][listKey].push(coerceYamlScalar(item[1]));
    }
  }

  return root;
}

function asString(value) {
  if (typeof value === "string") return value;
  if (value == null) return null;
  return String(value);
}

function asArrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter((x) => x.length > 0);
}

function asInteger(value) {
  if (Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }
  return null;
}

function parseIsoToEpochMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? ms : null;
}

function computeAgeDays(iso) {
  const ts = parseIsoToEpochMs(iso);
  if (ts == null) return null;
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}
function loadHomeostasis(workspaceRoot) {
  const filePath = path.join(workspaceRoot, HOMEOSTASIS_REL);
  const rawOrNull = readUtf8IfExists(filePath);
  const raw = rawOrNull ?? "";
  const parsed = parseYamlSections(raw);
  const mindset = isObject(parsed.MINDSET) ? parsed.MINDSET : {};
  const reflexes = isObject(parsed.REFLEXES) ? parsed.REFLEXES : {};

  return {
    exists: rawOrNull != null,
    path: filePath,
    hash: sha256Hex(raw),
    mindset: {
      mode: asString(mindset.mode),
      caution: asString(mindset.caution),
      focus: asString(mindset.focus),
    },
    reflexes: {
      motor: asArrayOfStrings(reflexes.motor),
      sensory: asArrayOfStrings(reflexes.sensory),
      inhibition: asArrayOfStrings(reflexes.inhibition),
    },
  };
}

function loadVitals(workspaceRoot) {
  const filePath = path.join(workspaceRoot, VITALS_REL);
  const rawOrNull = readUtf8IfExists(filePath);
  const raw = rawOrNull ?? "";
  const parsed = parseYamlSections(raw);
  const chemical = isObject(parsed.chemical_state) ? parsed.chemical_state : {};
  const gates = isObject(parsed.gates) ? parsed.gates : {};

  return {
    exists: rawOrNull != null,
    path: filePath,
    generatedAt: asString(parsed.generated_at),
    inflammation: asInteger(chemical.inflammation),
    cortisol: asInteger(chemical.cortisol),
    mode: asString(chemical.mode),
    blockNewFeatures: asBoolean(gates.block_new_features),
    requireWbc: asArrayOfStrings(gates.require_wbc),
  };
}

function getMissingCoreFiles(workspaceRoot) {
  const missing = [];
  for (const relPath of CORE_REL_PATHS) {
    if (!fileExists(path.join(workspaceRoot, relPath))) missing.push(relPath);
  }
  return missing;
}

function buildPulse({ workspaceRoot, homeostasis, vitals }) {
  const missingCoreFiles = getMissingCoreFiles(workspaceRoot);
  const ageDays = computeAgeDays(vitals.generatedAt);
  const ageDaysLabel = ageDays == null ? "unknown" : ageDays.toFixed(1);
  const reflexes = homeostasis.reflexes;
  const alerts = [];

  if (!homeostasis.exists) alerts.push("homeostasis_missing");
  if (!vitals.exists) alerts.push("vitals_missing");
  if (missingCoreFiles.length > 0) alerts.push(`missing_core_files:${missingCoreFiles.length}`);
  if (ageDays != null && ageDays > VITALS_STALE_DAYS) alerts.push(`vitals_stale:${ageDays.toFixed(1)}d`);
  if (vitals.blockNewFeatures === true) alerts.push("gate:block_new_features=true");
  if (vitals.requireWbc.length > 0) alerts.push(`gate:require_wbc:${vitals.requireWbc.length}`);
  if (Number.isInteger(vitals.inflammation) && vitals.inflammation >= 1) alerts.push(`inflammation:${vitals.inflammation}`);
  if (Number.isInteger(vitals.cortisol) && vitals.cortisol >= 2) alerts.push(`cortisol:${vitals.cortisol}`);

  const oneLine = [
    "_brain pulse",
    `mode=${homeostasis.mindset.mode ?? "unknown"}`,
    `caution=${homeostasis.mindset.caution ?? "unknown"}`,
    `focus=${homeostasis.mindset.focus ?? "unknown"}`,
    `inflammation=${vitals.inflammation ?? "unknown"}`,
    `cortisol=${vitals.cortisol ?? "unknown"}`,
    `block_new_features=${vitals.blockNewFeatures ?? "unknown"}`,
    `reflexes(s/m/i)=${reflexes.sensory.length}/${reflexes.motor.length}/${reflexes.inhibition.length}`,
    `vitals_age_days=${ageDaysLabel}`,
  ].join(" | ");

  return {
    workspaceRoot,
    mindset: homeostasis.mindset,
    reflexes,
    vitals: {
      generatedAt: vitals.generatedAt,
      ageDaysLabel,
      inflammation: vitals.inflammation,
      cortisol: vitals.cortisol,
      mode: vitals.mode,
      blockNewFeatures: vitals.blockNewFeatures,
      requireWbc: vitals.requireWbc,
    },
    missingCoreFiles,
    alerts,
    oneLine,
    attentionMessage: alerts.length > 0 ? `BRAIN ATTENTION: ${alerts.join(" | ")}` : null,
    attentionHash: alerts.length > 0 ? sha256Hex(alerts.join("|")) : null,
  };
}

function listInline(items) {
  const arr = Array.isArray(items) ? items : [];
  if (arr.length === 0) return "[]";
  return `[${arr.map((x) => JSON.stringify(String(x))).join(", ")}]`;
}

function renderCortexYaml({ hash, pulse }) {
  const m = pulse.mindset;
  const r = pulse.reflexes;
  const v = pulse.vitals;

  return [
    "# AUTO-GENERATED - DO NOT EDIT",
    "# Source: _brain_v1/homeostasis.yaml",
    `workspace_root: ${JSON.stringify(pulse.workspaceRoot)}`,
    `MINDSET: { mode: ${JSON.stringify(m.mode ?? "")}, caution: ${JSON.stringify(m.caution ?? "")}, focus: ${JSON.stringify(m.focus ?? "")} }`,
    `REFLEXES: { motor: ${listInline(r.motor)}, sensory: ${listInline(r.sensory)}, inhibition: ${listInline(r.inhibition)} }`,
    `VITALS: { generated_at: ${JSON.stringify(v.generatedAt ?? "")}, age_days: ${JSON.stringify(v.ageDaysLabel)}, inflammation: ${JSON.stringify(v.inflammation ?? "unknown")}, cortisol: ${JSON.stringify(v.cortisol ?? "unknown")}, mode: ${JSON.stringify(v.mode ?? "unknown")} }`,
    `GATES: { block_new_features: ${JSON.stringify(v.blockNewFeatures ?? "unknown")}, require_wbc: ${listInline(v.requireWbc)} }`,
    `BOOTSTRAP: { missing_core_files: ${listInline(pulse.missingCoreFiles)} }`,
    `ALERTS: ${listInline(pulse.alerts)}`,
    'INSTINCT: "sensory=deny read, motor=deny write, inhibition=deny shell/MCP"',
    `HASH: ${JSON.stringify(hash)}`,
    "",
  ].join("\n");
}

function renderAdditionalContext({ hash, pulse }) {
  const m = pulse.mindset;
  const r = pulse.reflexes;
  const v = pulse.vitals;

  return [
    "_brain cortex (auto-injected by Cursor hooks)",
    `source: ${HOMEOSTASIS_REL}`,
    `workspace_root: ${pulse.workspaceRoot}`,
    `hash: ${hash}`,
    `MINDSET: { mode: ${JSON.stringify(m.mode ?? "")}, caution: ${JSON.stringify(m.caution ?? "")}, focus: ${JSON.stringify(m.focus ?? "")} }`,
    `REFLEXES: { sensory: ${listInline(r.sensory)}, motor: ${listInline(r.motor)}, inhibition: ${listInline(r.inhibition)} }`,
    `VITALS: { generated_at: ${JSON.stringify(v.generatedAt ?? "")}, age_days: ${JSON.stringify(v.ageDaysLabel)}, inflammation: ${JSON.stringify(v.inflammation ?? "unknown")}, cortisol: ${JSON.stringify(v.cortisol ?? "unknown")}, mode: ${JSON.stringify(v.mode ?? "unknown")} }`,
    `GATES: { block_new_features: ${JSON.stringify(v.blockNewFeatures ?? "unknown")}, require_wbc: ${listInline(v.requireWbc)} }`,
    `BOOTSTRAP: { missing_core_files: ${listInline(pulse.missingCoreFiles)} }`,
    `ALERTS: ${listInline(pulse.alerts)}`,
  ].join("\n");
}

function appendUserMessage(out, message) {
  if (!message) return;
  if (!out.user_message) {
    out.user_message = message;
    return;
  }
  out.user_message = `${out.user_message}\n${message}`;
}

function loadSynapticState(workspaceRoot) {
  const statePath = path.join(workspaceRoot, ".cursor", "synaptic_state.json");
  const raw = readUtf8IfExists(statePath);
  const value = safeJsonParse(raw, {});
  return { path: statePath, value: isObject(value) ? value : {} };
}

function saveSynapticState(statePath, value) {
  writeUtf8(statePath, `${JSON.stringify(value ?? {}, null, 2)}\n`);
}

function refreshCortex({ workspaceRoot, sessionId }) {
  const homeostasis = loadHomeostasis(workspaceRoot);
  const vitals = loadVitals(workspaceRoot);
  const pulse = buildPulse({ workspaceRoot, homeostasis, vitals });

  const cortexPath = path.join(workspaceRoot, ".cursor", "cortex.yaml");
  const syn = loadSynapticState(workspaceRoot);
  const prev = syn.value;
  const next = {
    ...prev,
    session_id: sessionId ?? null,
    last_injected_hash: homeostasis.hash,
    last_check_timestamp: nowEpochSec(),
  };

  const needsContextRefresh = prev.session_id !== next.session_id || prev.last_injected_hash !== homeostasis.hash;
  if (needsContextRefresh) {
    writeUtf8(cortexPath, renderCortexYaml({ hash: homeostasis.hash, pulse }));
  }
  saveSynapticState(syn.path, next);

  return { homeostasis, pulse, needsContextRefresh };
}

function shouldEmitOncePerSession({ workspaceRoot, sessionId, noticeHash, hashField, sessionField }) {
  if (!noticeHash) return false;

  const syn = loadSynapticState(workspaceRoot);
  const prev = syn.value;
  const normalizedSession = sessionId ?? null;
  const alreadySent = prev[hashField] === noticeHash && prev[sessionField] === normalizedSession;

  if (alreadySent) return false;

  saveSynapticState(syn.path, {
    ...prev,
    [hashField]: noticeHash,
    [sessionField]: normalizedSession,
    last_check_timestamp: nowEpochSec(),
  });
  return true;
}

function shouldEmitAttentionOncePerSession({ workspaceRoot, sessionId, attentionHash }) {
  return shouldEmitOncePerSession({
    workspaceRoot,
    sessionId,
    noticeHash: attentionHash,
    hashField: "last_attention_notice_hash",
    sessionField: "last_attention_notice_session_id",
  });
}

function getReflexes(workspaceRoot) {
  return loadHomeostasis(workspaceRoot).reflexes;
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob) {
  const g = toPosix(String(glob ?? "").trim()).replace(/^\.\//, "");
  let re = "^";

  for (let i = 0; i < g.length; i += 1) {
    const ch = g[i];
    if (ch === "*") {
      if (g[i + 1] === "*") {
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
  const rel = toPosix(relPath);
  const pat = toPosix(String(pattern ?? "").trim());
  if (!pat) return false;

  if (!pat.includes("/")) {
    const basename = rel.split("/").pop() || rel;
    if (basename === pat) return true;
    if (globToRegExp(`**/${pat}`).test(rel)) return true;
  }

  return globToRegExp(pat).test(rel);
}

function matchesCommandPattern(command, pattern) {
  const cmd = String(command ?? "");
  const pat = String(pattern ?? "").trim();
  if (!pat) return false;

  if (pat.includes("*")) {
    const wildcard = new RegExp(`^${escapeRegExp(pat).replace(/\\\*/g, ".*")}$`, "i");
    return wildcard.test(cmd);
  }

  return cmd.toLowerCase().includes(pat.toLowerCase());
}

function extractFilePathFromToolInput(toolInput) {
  if (!isObject(toolInput)) return null;
  const candidates = ["file_path", "filePath", "path", "target_file", "targetFile", "filename"];

  for (const key of candidates) {
    if (typeof toolInput[key] === "string" && toolInput[key].trim()) return toolInput[key];
  }

  return null;
}

function handleSessionStart(input, workspaceRoot) {
  const sessionId = input.session_id || input.conversation_id || null;
  const { homeostasis, pulse } = refreshCortex({ workspaceRoot, sessionId });

  return {
    continue: true,
    env: {
      BRAIN_HOMEOSTASIS_HASH: homeostasis.hash,
      BRAIN_HOMEOSTASIS_PATH: path.join(workspaceRoot, HOMEOSTASIS_REL),
      BRAIN_CORTEX_PATH: path.join(workspaceRoot, ".cursor", "cortex.yaml"),
      BRAIN_VITALS_PATH: path.join(workspaceRoot, VITALS_REL),
    },
    user_message: pulse.oneLine,
    additional_context: renderAdditionalContext({ hash: homeostasis.hash, pulse }),
  };
}

function handleBeforeSubmitPrompt(input, workspaceRoot) {
  const sessionId = input.conversation_id || null;
  const { homeostasis, pulse, needsContextRefresh } = refreshCortex({ workspaceRoot, sessionId });
  const out = { continue: true };

  if (needsContextRefresh) {
    out.additional_context = renderAdditionalContext({ hash: homeostasis.hash, pulse });
  }

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

  return out;
}

function handlePreCompact(_input, workspaceRoot) {
  const cortexPath = path.join(workspaceRoot, ".cursor", "cortex.yaml");
  if (!readUtf8IfExists(cortexPath)) return {};

  return {
    user_message:
      "Context compaction: _brain cortex exists. If `_brain_v1/homeostasis.yaml` or `_brain_v1/4_evolution/vitals.yaml` changed, start a new chat to refresh context.",
  };
}

function handleBeforeReadFile(input, workspaceRoot) {
  const relPath = toWorkspaceRelPath(input.file_path, workspaceRoot);
  const sensory = getReflexes(workspaceRoot).sensory;

  for (const pattern of sensory) {
    if (matchesPathPattern(relPath, pattern)) {
      return { permission: "deny", user_message: "BLINDNESS: Sensory reflex prevents reading this file." };
    }
  }

  return { permission: "allow" };
}

function handlePreToolUse(input, workspaceRoot) {
  if (input.tool_name !== "Write") return { decision: "allow" };

  const filePath = extractFilePathFromToolInput(input.tool_input);
  if (!filePath) return { decision: "allow" };

  const relPath = toWorkspaceRelPath(filePath, workspaceRoot);
  const motor = getReflexes(workspaceRoot).motor;

  for (const pattern of motor) {
    if (matchesPathPattern(relPath, pattern)) {
      return { decision: "deny", reason: "REFLEX TRIGGERED: Motor reflex prevents editing a protected file." };
    }
  }

  return { decision: "allow" };
}

// Compatibility no-op: keep harmless behavior if legacy hook config still includes it.
function handleAfterFileEdit() {
  return {};
}

function handleBeforeShellExecution(input, workspaceRoot) {
  const command = input.command ?? "";
  const inhibition = getReflexes(workspaceRoot).inhibition;

  for (const pattern of inhibition) {
    if (matchesCommandPattern(command, pattern)) {
      return {
        permission: "deny",
        user_message: "REFLEX TRIGGERED: Inhibition reflex blocked a command.",
        agent_message: "Inhibition reflex: shell execution denied by _brain reflexes.",
      };
    }
  }

  return { permission: "allow" };
}

function handleBeforeMcpExecution(input, workspaceRoot) {
  const haystack = [input.tool_name, input.command, input.url, input.tool_input]
    .filter((x) => x != null)
    .map((x) => String(x))
    .join(" ");
  const inhibition = getReflexes(workspaceRoot).inhibition;

  for (const pattern of inhibition) {
    if (matchesCommandPattern(haystack, pattern)) {
      return {
        permission: "deny",
        user_message: "REFLEX TRIGGERED: Inhibition reflex blocked an MCP tool call.",
        agent_message: "Inhibition reflex: MCP execution denied by _brain reflexes.",
      };
    }
  }

  return { permission: "allow" };
}
