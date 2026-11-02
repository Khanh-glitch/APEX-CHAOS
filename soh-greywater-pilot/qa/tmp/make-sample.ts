import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseProject, serializeProject } from "../../src/maplab/store";
import { generateDetail, GREYWATER_POI_ID } from "../../src/maplab/detail/generate";
const raw = readFileSync("reference/04_map_studio_default_seed.sohmap.json", "utf8");
const p = parseProject(raw);
const poi = p.pois.find((q) => q.id === GREYWATER_POI_ID)!;
const d = generateDetail(p, poi);
p.details = { [GREYWATER_POI_ID]: d };
mkdirSync("qa/samples", { recursive: true });
writeFileSync("qa/samples/sohmap_with_greywater_detail.json", serializeProject(p, true));
writeFileSync("qa/samples/greywater_poi_detail.json", JSON.stringify(d, null, 1));
console.log(JSON.stringify({
  hash: d.hash, seed: d.seed, frame: [d.frame.w, d.frame.h, d.frame.rot],
  buildings: d.generated.buildings.length, props: d.generated.props.length, trees: d.generated.trees.length,
  fences: d.generated.fences.length, connections: d.generated.connections.length,
  spawn: d.generated.spawn, summary: d.generated.summary,
  pois: p.pois.length, roads: p.roads.length, rivers: p.rivers.length, bytes: serializeProject(p).length,
}, null, 1));
