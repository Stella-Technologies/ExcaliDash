// scripts/build-default-library.mjs
// Fetches relevant Excalidraw libraries from the public registry,
// deduplicates elements by their JSON representation, and writes
// a combined default_library.json.
//
// Usage: node scripts/build-default-library.mjs
//   OR set LIBRARY_SOURCES=./my-sources.json for custom library list

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// Libraries relevant to cloud/architecture/diagramming
const TARGET_LIBRARIES = [
  // Azure
  "youritjang/azure-cloud-services.excalidrawlib",
  // AWS
  "slobodan/aws-serverless.excalidrawlib",
  "husainkhambaty/aws-simple-icons.excalidrawlib",
  // Cloud (GCP + generic)
  "clementbosc/gcp-icons.excalidrawlib",
  "cloud/cloud.excalidrawlib",
  // Technology logos
  "maeddes/technology-logos.excalidrawlib",
  "pclainchard/it-logos.excalidrawlib",
  "drwnio/drwnio.excalidrawlib",
  // Mark Sharpley DevOps
  "markopolo123/dev_ops.excalidrawlib",
  // Architecture components
  "michelcaradec/cloud-design-patterns.excalidrawlib",
  "rohanp/system-design.excalidrawlib",
  "arach/systems-design-components.excalidrawlib",
  // Network topology
  "dwelle/network-topology-icons.excalidrawlib",
  // UML
  "BjoernKW/UML-ER-library.excalidrawlib",
  // Database
  "oehrlis/db-eng.excalidrawlib",
  // Software architecture
  "youritjang/software-architecture.excalidrawlib",
  // Hexagonal architecture
  "corlaez/hexagonal-architecture.excalidrawlib",
  // Additional logos
  "esteevens/logos.excalidrawlib",
  "g-script/android.excalidrawlib",
  // Microsoft / Azure design patterns
  "niknm/systemdesignicons.excalidrawlib",
  // System design
  "aretecode/system-design-template.excalidrawlib",
  // Kubernetes ecosystem
  "zanetworker/red-hat.excalidrawlib",
  "mikhailredis/redis-grafana.excalidrawlib",
  // IT logos (extended)
  "selanas/it-logos.excalidrawlib",
];

const LIBRARIES_URL = "https://libraries.excalidraw.com";
const OUTPUT_FILE = path.resolve(REPO_ROOT, "backend", "default_library.json");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "ExcaliDash-Build" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse JSON from ${url}`));
        }
      });
    }).on("error", reject);
  });
}

function normalizeId(id) {
  // Excalidraw element IDs are like "element-abcdef01". We use a
  // hash of the JSON body to deduplicate, not the original element id.
  return null; // skip normalization — we dedup by JSON hash below
}

async function fetchLibrary(libSource) {
  // The source in the catalog is like "maeddes/technology-logos.excalidrawlib"
  // The URL uses the same path without modification
  const url = `${LIBRARIES_URL}/libraries/${libSource}`;
  console.log(`  Fetching: ${libSource}...`);
  try {
    const data = await fetchJson(url);
    if (!data) {
      console.log(`    → empty response, skipping`);
      return [];
    }
    // Response format: { type: "excalidrawlib", version: 1, library: [ [items...] ] }
    // The library array is an array of arrays, where each inner array is a group
    if (data.type === "excalidrawlib" && Array.isArray(data.library)) {
      const elements = data.library.flat();
      console.log(`    → ${elements.length} elements`);
      return elements;
    }
    // Fallback: maybe it's a flat array
    if (Array.isArray(data)) {
      console.log(`    → ${data.length} elements (flat)`);
      return data;
    }
    console.log(`    → unknown format, skipping`);
    return [];
  } catch (err) {
    console.log(`    → fetch failed: ${err.message}`);
    return [];
  }
}

function deduplicate(allElements) {
  const seen = new Set();
  const result = [];

  for (const el of allElements) {
    // Create a fingerprint that ignores element IDs and versions
    // but captures the actual shape, text, position, and styling
    const fingerprint = JSON.stringify({
      type: el.type,
      x: Math.round(el.x || 0),
      y: Math.round(el.y || 0),
      width: el.width,
      height: el.height,
      angle: el.angle,
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor,
      fillStyle: el.fillStyle,
      strokeWidth: el.strokeWidth,
      strokeStyle: el.strokeStyle,
      roundness: el.roundness,
      opacity: el.opacity,
      text: el.text,
      fontSize: el.fontSize,
      fontFamily: el.fontFamily,
      textAlign: el.textAlign,
      points: Array.isArray(el.points)
        ? el.points.map((p) =>
            Array.isArray(p) ? p.map((v) => Math.round(v * 100) / 100) : p
          )
        : undefined,
    });

    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      result.push(el);
    }
  }

  return result;
}

function buildLibraryJson(elements) {
  return {
    type: "excalidrawlib",
    version: 2,
    source: "excalidash-default",
    items: elements,
  };
}

async function main() {
  console.log("========================================");
  console.log("ExcaliDash Default Library Builder");
  console.log("========================================");
  console.log(`Target sources: ${TARGET_LIBRARIES.length} libraries`);
  console.log("");

  const allElements = [];
  for (const lib of TARGET_LIBRARIES) {
    const elements = await fetchLibrary(lib);
    allElements.push(...elements);
  }

  console.log(`\nTotal fetched: ${allElements.length} elements`);
  console.log("Deduplicating...");

  const deduped = deduplicate(allElements);
  const library = buildLibraryJson(deduped);

  console.log(`After dedup: ${deduped.length} elements`);
  console.log(`Removed: ${allElements.length - deduped.length} duplicates`);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(library, null, 2), "utf8");

  const kb = Math.round(Buffer.byteLength(JSON.stringify(library)) / 1024);
  console.log(`\nWritten: ${OUTPUT_FILE} (${kb} KB)`);
  console.log("Done.");
}

main().catch(console.error);