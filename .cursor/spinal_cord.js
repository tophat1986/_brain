#!/usr/bin/env node
/**
 * Cursor "Spinal Cord" hook handler (EXAMPLE).
 *
 * This repo is the _brain itself (building v1). Hooks are intentionally NOT enabled here.
 * To enable in a host repo, copy `.cursor/hooks.example.json` → `.cursor/hooks.json`.
 *
 * Receives hook input JSON via stdin and responds via stdout JSON.
 * Must be deterministic, fast, and dependency-free.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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
    if (!raw || !raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text ?? "", "utf8").digest("hex");
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

function normalizePathSep(p) {
  return String(p ?? "").replace(/\\/g, "/");
}

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

function toRelPath(filePath, workspaceRoot) {
  if (!filePath || typeof filePath !== "string") return "";

  const abs = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
  const rel = normalizePathSep(path.relative(workspaceRoot, abs));
  // If it's outside workspaceRoot, fall back to normalized input.
  if (rel.startsWith("../") || rel.startsWith("..\\")) return normalizePathSep(filePath);
  return rel;
}

function stripWrappingQuotes(s) {
  const v = String(s ?? "").trim();
  if (!v) return v;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

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
      const valueRaw = String(m[2] ?? "").trim();
      const valueNoComment = valueRaw.split(/\s+#/)[0].trim();
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
        const itemRaw = String(itemMatch[1] ?? "").trim();
        const itemNoComment = itemRaw.split(/\s+#/)[0].trim();
        const item = stripWrappingQuotes(itemNoComment);
        if (item) result.reflexes[reflexKey].push(item);
      }
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

function buildCortexYaml({ mindset, reflexes, hash }) {
  const m = mindset ?? {};
  const r = reflexes ?? {};

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
    `MINDSET: { ${mindsetLine} }`,
    "REFLEXES:",
    `  motor:${listBlock(r.motor)}`,
    `  sensory:${listBlock(r.sensory)}`,
    `  inhibition:${listBlock(r.inhibition)}`,
    'INSTINCT: "Motor reflex denies writes. Sensory reflex denies reads. Inhibition denies shell/MCP."',
    `HASH: ${JSON.stringify(hash)}`,
    "",
  ].join("\n");
}

function buildAdditionalContext({ mindset, reflexes, hash }) {
  const m = mindset ?? {};
  const r = reflexes ?? {};

  const compactList = (items) => {
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0) return "[]";
    return `[${arr.map((x) => JSON.stringify(String(x))).join(", ")}]`;
  };

  return [
    "_brain cortex (auto-injected by Cursor hooks)",
    `source: _brain_v1/homeostasis.yaml`,
    `hash: ${hash}`,
    `MINDSET: { mode: ${JSON.stringify(m.mode ?? "")}, caution: ${JSON.stringify(m.caution ?? "")}, focus: ${JSON.stringify(m.focus ?? "")} }`,
    `REFLEXES: { sensory: ${compactList(r.sensory)}, motor: ${compactList(r.motor)}, inhibition: ${compactList(r.inhibition)} }`,
    "INSTINCT: sensory=blindness (deny read), motor=withdrawal (deny write), inhibition=deny shell/MCP",
  ].join("\n");
}

function loadHomeostasis(workspaceRoot) {
  const homeostasisPath = path.join(workspaceRoot, "_brain_v1", "homeostasis.yaml");
  const raw = readUtf8IfExists(homeostasisPath) ?? "";
  const hash = sha256Hex(raw);
  const parsed = parseHomeostasisYaml(raw);
  return { homeostasisPath, raw, hash, parsed };
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

function updateCortexAndState({ workspaceRoot, sessionId }) {
  const { parsed, hash } = loadHomeostasis(workspaceRoot);

  const cortexPath = path.join(workspaceRoot, ".cursor", "cortex.yaml");
  const syn = loadSynapticState(workspaceRoot);
  const prev = syn.value;

  const nowEpochSec = Math.floor(Date.now() / 1000);
  const nextState = {
    session_id: sessionId ?? null,
    last_injected_hash: hash,
    last_check_timestamp: nowEpochSec,
  };

  const needsUpdate =
    !prev ||
    prev.session_id !== nextState.session_id ||
    prev.last_injected_hash !== nextState.last_injected_hash;

  if (needsUpdate) {
    writeUtf8(cortexPath, buildCortexYaml({ mindset: parsed.mindset, reflexes: parsed.reflexes, hash }));
    saveSynapticState(syn.path, nextState);
  } else {
    // Still update timestamp to prove liveness, but don't churn cortex.
    saveSynapticState(syn.path, { ...prev, last_check_timestamp: nowEpochSec });
  }

  return { hash, parsed, needsUpdate };
}

function getReflexes(workspaceRoot) {
  return loadHomeostasis(workspaceRoot).parsed.reflexes;
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
  const { hash, parsed, needsUpdate } = updateCortexAndState({ workspaceRoot, sessionId });

  const out = {
    continue: true,
    env: {
      BRAIN_HOMEOSTASIS_HASH: hash,
      BRAIN_HOMEOSTASIS_PATH: path.join(workspaceRoot, "_brain_v1", "homeostasis.yaml"),
      BRAIN_CORTEX_PATH: path.join(workspaceRoot, ".cursor", "cortex.yaml"),
    },
  };

  if (needsUpdate) {
    out.additional_context = buildAdditionalContext({ mindset: parsed.mindset, reflexes: parsed.reflexes, hash });
  }

  return out;
}

function handleBeforeSubmitPrompt(input, workspaceRoot) {
  const sessionId = input.conversation_id || null;
  updateCortexAndState({ workspaceRoot, sessionId });
  return { continue: true };
}

function handlePreCompact(_input, workspaceRoot) {
  const cortexPath = path.join(workspaceRoot, ".cursor", "cortex.yaml");
  const cortex = readUtf8IfExists(cortexPath);
  if (!cortex) return {};
  return {
    user_message: "Context compaction: _brain cortex exists. If you changed `_brain_v1/homeostasis.yaml`, start a new chat to re-inject cortex.",
  };
}

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

