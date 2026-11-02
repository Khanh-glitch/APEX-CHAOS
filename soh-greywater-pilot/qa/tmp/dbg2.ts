import { readFileSync } from "node:fs";
import { parseProject } from "../../src/maplab/store";
import { generateDetail, GREYWATER_POI_ID } from "../../src/maplab/detail/generate";
const p = parseProject(readFileSync("reference/04_map_studio_default_seed.sohmap.json", "utf8"));
const poi = p.pois.find((q) => q.id === GREYWATER_POI_ID)!;
const d = generateDetail(p, poi);
let sum = 0;
for (const b of d.generated.buildings) { console.log(b.id, b.x, b.y, b.w, b.h); sum += (b.w + 2) * (b.h + 2); }
console.log("sum", sum);
