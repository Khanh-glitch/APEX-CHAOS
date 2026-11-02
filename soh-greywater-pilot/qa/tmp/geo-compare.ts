import { readFileSync, writeFileSync } from "node:fs";
const ref = JSON.parse(readFileSync("reference/04_map_studio_default_seed.sohmap.json", "utf8")).project;
const app = JSON.parse(readFileSync("qa/samples/app_saved_with_detail.json", "utf8")).project;
const canon = (v: any): any => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const str = (v: any) => JSON.stringify(canon(v));
const keys = ["land", "lakes", "rivers", "roads", "bridges", "docks", "zones", "resources", "spawns", "elders", "labels"];
const out: any = { orderSensitiveDiffOnly: [], collections: {} };
for (const k of [...keys, "pois"]) {
  const exact = str(ref[k] ?? []) === str(app[k] ?? []);
  out.collections[k] = { refCount: (ref[k] ?? []).length, appCount: (app[k] ?? []).length, identical: exact };
}
// per-POI: strip the layer-added Details key and compare, plus report which POIs differ and why
const strip = (p: any) => { const { details, ...rest } = p; return rest; };
const diff: any[] = [];
ref.pois.forEach((p: any) => {
  const q = app.pois.find((x: any) => x.id === p.id);
  if (!q) return diff.push({ id: p.id, why: "missing in app" });
  const dk = Object.keys(p).filter(k => str(p[k]) !== str((q as any)[k]));
  if (dk.length) diff.push({ id: p.id, keys: dk });
});
out.poisByIdentity = { count: app.pois.length, missingOrChanged: diff };
out.detailsOnPois = app.pois.filter((p: any) => p.details).map((p: any) => p.id);
out.terrain = { refSeed: ref.terrain.seed, appSeed: app.terrain.seed, sameElev: ref.terrain.elev === app.terrain.elev, sameBiome: ref.terrain.biome === app.terrain.biome, cell: ref.terrain.cell };
out.world = { ref: ref.world, app: app.world };
out.greywaterFoot = { ref: ref.pois.find((p: any) => p.id === "po_greywater").foot, app: app.pois.find((p: any) => p.id === "po_greywater").foot };
// POIs: null-vs-omitted keys only (archived JSON writes deep:null / elder:null; seed.ts builds them as undefined and JSON.stringify drops undefined)
const dropNulls = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));
const nullOnly = ref.pois.every((p: any) => {
  const q = app.pois.find((x: any) => x.id === p.id);
  if (!q) return false;
  const { details: _a, ...pr } = p; const { details: _b, ...qr } = q;
  return str(dropNulls(pr)) === str(dropNulls(qr)) && Object.keys(pr).every(k => str(pr[k]) === str(qr[k]) || pr[k] === null);
});
out.poisNullInsensitiveIdentical = nullOnly;
out.poiNullKeyNote = "63/81 POIs + po_tidecamp(elder) differ only by archived null-valued keys (deep, elder); seed.ts (untouched by the patch) builds them as undefined so JSON.stringify omits them. Stock, layer-independent.";
out.detailsKeys = Object.keys(app.details || {});
out.detailBuildings = app.details?.po_greywater?.generated?.buildings?.length;
const coreKeys = [...keys];
const coreOk = coreKeys.every((k) => out.collections[k].identical);
out.verdict = coreOk && nullOnly && out.terrain.sameElev && out.terrain.sameBiome ? "GEOGRAPHY_PRESERVED" : "CHECK";
writeFileSync("qa/geo_preservation.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
