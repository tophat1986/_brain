#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const BRAIN_ROOT = "_brain_v1";
const VITALS_REL_PATH = path.join(BRAIN_ROOT, "4_evolution", "vitals.yaml");

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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
  fs.writeFileSync(filePath, content, "utf8");
}

function stripWrappingQuotes(s) {
  const v = String(s ?? "").trim();
  if (!v) return v;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function stripYamlInlineComment(value) {
  return String(value ?? "").split(/\s+#/)[0].trim();
}

function parseIntegerMaybe(value) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function uniqueStrings(values) {
  return Array.from(new Set((values ?? []).map((x) => String(x).trim()).filter(Boolean)));
}

function resolveWorkspaceRoot(startDir) {
  let current = path.resolve(startDir || process.cwd());
  while (true) {
    if (fileExists(path.join(current, BRAIN_ROOT))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(startDir || process.cwd());
    current = parent;
  }
}

function walkBrainMarkdownStats(brainRootPath) {
  let mdFiles = 0;
  let mdLines = 0;
  let mdBytes = 0;

  function visit(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        visit(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith(".md")) continue;
      if (/^inf_.*\.md$/i.test(entry.name)) continue;

      const content = fs.readFileSync(abs, "utf8");
      mdFiles += 1;
      mdBytes += Buffer.byteLength(content, "utf8");
      mdLines += content.length === 0 ? 0 : content.split(/\r?\n/).length;
    }
  }

  visit(brainRootPath);
  return { mdFiles, mdLines, mdBytes };
}

function parseExistingVitalsState(raw) {
  const result = {
    cortisol: 0,
    mode: "rest_digest",
    requireWbc: [],
  };

  const lines = String(raw ?? "").split(/\r?\n/);
  let section = null;
  let inRequireWbc = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, "    ");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = (line.match(/^ */) || [""])[0].length;

    if (indent === 0) {
      inRequireWbc = false;
      if (/^chemical_state:\s*$/.test(trimmed)) {
        section = "chemical_state";
        continue;
      }
      if (/^gates:\s*$/.test(trimmed)) {
        section = "gates";
        continue;
      }
      section = null;
      continue;
    }

    if (indent === 2 && section === "chemical_state") {
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      const value = stripYamlInlineComment(m[2] ?? "");
      if (key === "cortisol") {
        const parsed = parseIntegerMaybe(value);
        if (parsed != null) result.cortisol = parsed;
      }
      if (key === "mode") {
        const parsed = stripWrappingQuotes(value);
        if (parsed) result.mode = parsed;
      }
      continue;
    }

    if (indent === 2 && section === "gates") {
      inRequireWbc = false;
      if (/^require_wbc:\s*\[\s*\]\s*$/.test(trimmed)) {
        result.requireWbc = [];
        continue;
      }
      if (/^require_wbc:\s*$/.test(trimmed)) {
        inRequireWbc = true;
        continue;
      }
      continue;
    }

    if (section === "gates" && inRequireWbc && indent >= 4) {
      const itemMatch = trimmed.match(/^-+\s*(.+)\s*$/);
      if (!itemMatch) continue;
      const itemRaw = stripYamlInlineComment(itemMatch[1] ?? "");
      const item = stripWrappingQuotes(itemRaw);
      if (item) result.requireWbc.push(item);
    }
  }

  result.requireWbc = uniqueStrings(result.requireWbc);
  return result;
}

function computeInflammation(mdLines) {
  // Temporary simple thresholds; can be externalized later via DNA if needed.
  if (mdLines > 5000) return 2;
  if (mdLines > 2500) return 1;
  return 0;
}

function normalizeMode(mode, cortisol) {
  const normalized = String(mode ?? "").trim();
  if (normalized) return normalized;
  if (Number.isInteger(cortisol) && cortisol >= 2) return "fight_flight";
  return "rest_digest";
}

function renderRequireWbcBlock(requireWbc) {
  const items = uniqueStrings(requireWbc);
  if (items.length === 0) return ["  require_wbc: []"];
  return ["  require_wbc:", ...items.map((item) => `    - ${JSON.stringify(item)}`)];
}

function buildVitalsYaml({
  timestampIso,
  mdFiles,
  mdLines,
  mdBytes,
  inflammation,
  cortisol,
  mode,
  blockNewFeatures,
  requireWbc,
}) {
  return [
    "# VITALS",
    "# Current measured state (biomarkers / telemetry) for the Brain layer.",
    "# Machine-managed snapshot.",
    "#",
    "# Rules:",
    "# - Do not edit manually unless a protocol explicitly instructs it.",
    "# - Update only after running a WBC scan.",
    "#",
    "# Scope note:",
    "# - This file describes the state of `_brain_v1` (the Brain layer), not the host repo codebase.",
    "#",
    "",
    "schema_version: 1",
    `generated_at: ${JSON.stringify(timestampIso)}`,
    "",
    "scopes:",
    "  brain_md:",
    '    root: "_brain_v1"',
    "    include:",
    '      - "**/*.md"',
    "    exclude:",
    '      - "**/inf_*.md"',
    "  host_repo: null",
    "",
    "brain_vitals:",
    `  last_scan_at: ${JSON.stringify(timestampIso)}`,
    `  md_files: ${mdFiles}`,
    `  md_lines: ${mdLines}`,
    `  md_bytes: ${mdBytes}`,
    "",
    "chemical_state:",
    `  inflammation: ${inflammation}   # [0=clean, 1=bloated, 2=toxic]`,
    `  cortisol: ${cortisol}       # [0=calm, 1=focus, 2=stressed, 3=panic]`,
    `  mode: ${mode} # [rest_digest, fight_flight, deep_focus]`,
    "",
    "gates:",
    `  block_new_features: ${blockNewFeatures ? "true" : "false"}`,
    ...renderRequireWbcBlock(requireWbc),
    "",
  ].join("\n");
}

function main() {
  const workspaceRoot = resolveWorkspaceRoot(process.cwd());
  const brainRootPath = path.join(workspaceRoot, BRAIN_ROOT);
  if (!fileExists(brainRootPath)) {
    process.stderr.write("WBC-1 failed: could not locate _brain_v1 in current workspace or parents.\n");
    process.exit(1);
  }

  const vitalsPath = path.join(workspaceRoot, VITALS_REL_PATH);
  const existingRaw = readUtf8IfExists(vitalsPath) ?? "";
  const existing = parseExistingVitalsState(existingRaw);
  const stats = walkBrainMarkdownStats(brainRootPath);

  const timestampIso = new Date().toISOString();
  const inflammation = computeInflammation(stats.mdLines);
  const blockNewFeatures = inflammation >= 2;
  const cortisol = Number.isInteger(existing.cortisol) ? existing.cortisol : 0;
  const mode = normalizeMode(existing.mode, cortisol);

  const yaml = buildVitalsYaml({
    timestampIso,
    mdFiles: stats.mdFiles,
    mdLines: stats.mdLines,
    mdBytes: stats.mdBytes,
    inflammation,
    cortisol,
    mode,
    blockNewFeatures,
    requireWbc: existing.requireWbc,
  });

  writeUtf8(vitalsPath, yaml);

  const summary = {
    status: "ok",
    workspace_root: workspaceRoot,
    vitals_path: vitalsPath,
    generated_at: timestampIso,
    brain_vitals: {
      md_files: stats.mdFiles,
      md_lines: stats.mdLines,
      md_bytes: stats.mdBytes,
    },
    chemical_state: {
      inflammation,
      cortisol,
      mode,
    },
    gates: {
      block_new_features: blockNewFeatures,
      require_wbc: existing.requireWbc,
    },
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
