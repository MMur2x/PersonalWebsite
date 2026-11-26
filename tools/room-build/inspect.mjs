// node inspect.mjs <file.glb>  -> perf numbers that matter at runtime
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import fs from "fs";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]); const root = doc.getRoot();
let tris = 0, prims = 0, verts = 0; const meshTris = [];
for (const node of root.listNodes()) {
  const m = node.getMesh(); if (!m) continue;
  let t = 0;
  for (const p of m.listPrimitives()) {
    prims++; const idx = p.getIndices(); const pos = p.getAttribute("POSITION");
    t += (idx ? idx.getCount() : pos.getCount()) / 3; verts += pos.getCount();
  }
  tris += t; meshTris.push([node.getName(), Math.round(t), m.listPrimitives().length]);
}
const lights = root.listNodes().filter(n => n.getExtension("KHR_lights_punctual")).length;
const emis = root.listMaterials().filter(m => m.getEmissiveTexture() || m.getEmissiveFactor().some(v => v > 0)).map(m => m.getName());
let gpu = 0;
for (const t of root.listTextures()) {
  const s = t.getSize() || [1024, 1024];
  gpu += s[0] * s[1] * (t.getMimeType() === "image/ktx2" ? 1 : 4) * 4 / 3;   // compressed GPU formats ~1 B/px (BC7/ASTC4x4), +mips
}
console.log(JSON.stringify({
  fileMB: +(fs.statSync(process.argv[2]).size / 1e6).toFixed(2), nodes: root.listNodes().length, meshNodes: meshTris.length,
  drawCalls: prims, triangles: Math.round(tris), vertices: verts, materials: root.listMaterials().length,
  textures: root.listTextures().length, gpuTextureMB: +(gpu / 1e6).toFixed(0), lights, cameras: root.listCameras().length,
  emissiveMaterials: emis,
}, null, 1));
console.log("heaviest meshes:"); meshTris.sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(r => console.log(" ", ...r));
const names = new Set(root.listNodes().map(n => n.getName()));
const HOT = ["monitor","laptop","paper","lamp","calendar","qr","books","diploma","cap","frames","f0","f1","f2","f3","f4","portrait","phone","window","bag"];
console.log("missing hotspots:", HOT.filter(h => !names.has(h)).join(",") || "none");
console.log("missing spot_ empties:", HOT.filter(h => !names.has("spot_" + h)).join(",") || "none");
console.log("spot_ total:", [...names].filter(n => n.startsWith("spot_")).length, " col_ total:", [...names].filter(n => n.startsWith("col_")).length);
const lm = new Set(); root.listMeshes().forEach(m => m.listPrimitives().forEach(p => p.listSemantics().filter(s => s.startsWith("_LM")).forEach(s => lm.add(s))));
console.log("vertex lightmap attrs:", [...lm].join(","));
