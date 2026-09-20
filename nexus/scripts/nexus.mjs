#!/usr/bin/env node
import { disconnectDB } from "../lib/dbConnect.js";
import { cleanseInventory, parsePasses, PASSES } from "../lib/cleanse.js";

function usage(code = 0) {
   const text = `nexus cleanse -- scriptable inventory hygiene

Usage:
  node scripts/nexus.mjs cleanse [flags]

Flags:
  --dry-run          scan only (default)
  --apply            write fixes
  --json             single JSON object on stdout
  --strict           exit 1 if findings exist
  --org <id>         restrict to organization
  --pass <list>      orphans,qty,expiry,drift,zero or all
  --limit <n>        cap findings per pass

Exit:
  0  clean, or findings without --strict
  1  findings with --strict, or bad flags
  2  runtime failure
`;
   process.stdout.write(text);
   process.exit(code);
}

function parseArgs(argv) {
   const args = { cmd: null, dryRun: true, apply: false, json: false, strict: false, org: null, pass: "all", limit: 0 };
   const rest = [...argv];
   args.cmd = rest.shift() || null;
   while (rest.length) {
      const tok = rest.shift();
      if (tok === "-h" || tok === "--help") usage(0);
      else if (tok === "--dry-run") args.dryRun = true;
      else if (tok === "--apply") {
         args.apply = true;
         args.dryRun = false;
      } else if (tok === "--json") args.json = true;
      else if (tok === "--strict") args.strict = true;
      else if (tok === "--org") args.org = rest.shift();
      else if (tok === "--pass") args.pass = rest.shift();
      else if (tok === "--limit") args.limit = Number(rest.shift());
      else if (tok.startsWith("--org=")) args.org = tok.slice(6);
      else if (tok.startsWith("--pass=")) args.pass = tok.slice(7);
      else if (tok.startsWith("--limit=")) args.limit = Number(tok.slice(8));
      else {
         process.stderr.write(`unknown flag: ${tok}\n`);
         usage(1);
      }
   }
   return args;
}

function printText(report) {
   const mode = report.apply ? "APPLY" : "DRY-RUN";
   process.stdout.write(`cleanse ${mode} total=${report.total}\n`);
   for (const pass of report.passes) {
      process.stdout.write(`  ${pass} findings=${report.counts[pass] || 0} applied=${report.applied[pass] || 0}\n`);
   }
   for (const f of report.findings) {
      const extra = Object.entries(f)
         .filter(([k]) => !["pass", "id", "reason"].includes(k))
         .map(([k, v]) => `${k}=${v}`)
         .join(" ");
      process.stdout.write(`  ${f.pass} ${f.id} ${f.reason}${extra ? " " + extra : ""}\n`);
   }
}

async function main() {
   const argv = process.argv.slice(2);
   if (!argv.length || argv[0] === "help" || argv[0] === "-h" || argv[0] === "--help") usage(0);
   const args = parseArgs(argv);
   if (args.cmd !== "cleanse") {
      process.stderr.write(`unknown command: ${args.cmd}\n`);
      usage(1);
   }
   const passes = parsePasses(args.pass);
   const report = await cleanseInventory({
      org: args.org,
      passes,
      apply: args.apply,
      limit: Number.isFinite(args.limit) ? args.limit : 0,
   });
   if (args.json) process.stdout.write(`${JSON.stringify(report)}\n`);
   else printText(report);
   await disconnectDB().catch(() => {});
   if (args.strict && report.total > 0) process.exit(1);
   process.exit(0);
}

main().catch((err) => {
   process.stderr.write(`${err.stack || err.message || err}\n`);
   process.exit(2);
});
