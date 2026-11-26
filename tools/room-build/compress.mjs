// node compress.mjs <desktop|mobile> <in.glb> <out.glb> [lm_png_dir lm_out_dir]
// Runtime-performance pass: strip live lights (lighting is baked), fix false emissives, size textures per device,
// KTX2 one texture at a time (low RAM), meshopt geometry; mobile also drops normal maps and simplifies heavy meshes.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRTextureBasisu, EXTMeshoptCompression, KHRLightsPunctual } from "@gltf-transform/extensions";
import { dedup, prune, weld, reorder, quantize, simplify } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import { encodeToKTX2 } from "ktx2-encoder";
import { fixMaterials } from "./matfix.mjs";
import sharp from "sharp"; import fs from "fs"; import path from "path";

const [PROFILE, IN, OUT, LM_IN, LM_OUT] = process.argv.slice(2);
const MOBILE = PROFILE === "mobile";
const SIZE = MOBILE
  ? { atlasColor: 1024, atlasOrm: 512, color: 512, orm: 512, normal: 0, lightmap: 512 }
  : { atlasColor: 2048, atlasOrm: 1024, color: 1024, orm: 512, normal: 0, lightmap: 1024 };
const GLOWS = /^(screen_|phone_screen|console_led|fairy_bulb|G_.*_glow|lava_|led_strip)/;
const ATLAS = /^(walls|floor|desk|deskwall|window|bed|leftwall|rightwall|frontwall|center|outdoor)_(alb|orm|nrm)/;

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

async function ktx(buf, { srgb, normal, max }) {
  let img = sharp(buf); const m = await img.metadata();
  // fit inside max, then snap both sides to a multiple of 4 (compressed GPU formats reject anything else)
  const k = Math.min(1, max / Math.max(m.width, m.height));
  const tw = Math.max(4, Math.round(m.width * k / 4) * 4), th = Math.max(4, Math.round(m.height * k / 4) * 4);
  if (tw !== m.width || th !== m.height) img = img.resize(tw, th, { fit: "fill" });
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data);
  const opts = normal
    ? { isUASTC: true, isNormalMap: true, enableRDO: true, rdoQualityLevel: 3, needSupercompression: true, generateMipmap: true, isSetKTX2SRGBTransferFunc: false }
    : { isUASTC: false, qualityLevel: srgb ? 128 : 160, compressionLevel: 2, generateMipmap: true, isSetKTX2SRGBTransferFunc: srgb };
  const out = await encodeToKTX2(px, { ...opts, imageDecoder: async () => ({ data: px, width: info.width, height: info.height }) });
  return { out, w: info.width, h: info.height };
}

const doc = await io.read(IN); const root = doc.getRoot();
// 1. lights are baked into the lightmaps -> no live lights
let lights = 0;
for (const n of root.listNodes()) if (n.getExtension("KHR_lights_punctual")) { n.setExtension("KHR_lights_punctual", null); lights++; }
root.listExtensionsUsed().filter(e => e instanceof KHRLightsPunctual).forEach(e => e.dispose());
// 2. only real light sources glow
const fixed = [];
for (const m of root.listMaterials()) if (!GLOWS.test(m.getName()) && (m.getEmissiveTexture() || m.getEmissiveFactor().some(v => v > 0))) {
  m.setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]); fixed.push(m.getName());
}
console.log("materials", JSON.stringify(fixMaterials(doc)));
// 3. no normal maps (lighting is baked; they cost a texture fetch + memory per pixel)
if (!SIZE.normal) for (const m of root.listMaterials()) m.setNormalTexture(null);
await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), weld());
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MOBILE ? 0.5 : 0.75, error: MOBILE ? 0.0005 : 0.0002, lockBorder: true }));

// 4. textures
const rep = [];
for (const tex of root.listTextures()) {
  const slots = new Set(doc.getGraph().listParentEdges(tex).map(e => e.getName()));
  const name = tex.getName() || tex.getURI();
  const normal = slots.has("normalTexture"), srgb = slots.has("baseColorTexture") || slots.has("emissiveTexture");
  const atlas = ATLAS.test(name);
  const max = normal ? (atlas ? SIZE.normal : SIZE.otherNormal) : srgb ? (atlas ? SIZE.atlasColor : SIZE.color) : (atlas ? SIZE.atlasOrm : SIZE.orm);
  const { out, w, h } = await ktx(Buffer.from(tex.getImage()), { srgb, normal, max });
  tex.setImage(out).setMimeType("image/ktx2");
  if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.(png|jpe?g|webp)$/i, ".ktx2"));
  rep.push({ name, w, h, kb: out.length / 1e3 });
}
doc.createExtension(KHRTextureBasisu).setRequired(true);
// 5a. plant vertex lighting: float RGBA -> normalized uint8 RGBA, same encoding as the lightmap files
const vlm = {};
for (const layer of ["NIGHT", "PRACTICAL", "DESKLAMP", "DAY"]) {
  const accs = new Set();
  root.listMeshes().forEach(m => m.listPrimitives().forEach(p => { const a = p.getAttribute("_LM_" + layer); if (a) accs.add(a); }));
  if (!accs.size) continue;
  const vals = [];
  for (const a of accs) { const arr = a.getArray(); for (let i = 0; i < arr.length; i += 4) vals.push(Math.max(arr[i], arr[i + 1], arr[i + 2])); }
  vals.sort((x, y) => x - y);
  const scale = Math.max(vals[Math.floor(vals.length * 0.998)] || 1, 1e-4);
  for (const a of accs) {
    const src = a.getArray(), dst = new Uint8Array(src.length);
    for (let i = 0; i < src.length; i++) dst[i] = (i % 4 === 3) ? 255 : Math.round(255 * Math.pow(Math.min(Math.max(src[i], 0) / scale, 1), 1 / 2.2));
    a.setArray(dst).setNormalized(true);
  }
  vlm[layer.toLowerCase()] = +scale.toFixed(6);
}
root.setExtras({ ...root.getExtras(), vertexLightmapScale: vlm, vertexLightmapEncoding: "irradiance = pow(attr.rgb, 2.2) * scale" });
console.log("vertex lightmap scales", JSON.stringify(vlm));
// 5. geometry
await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+)$/ }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(OUT, doc);
const texMB = rep.reduce((s, r) => s + r.kb, 0) / 1e3;
console.log(JSON.stringify({ profile: PROFILE, lightsRemoved: lights, emissiveFixed: fixed, textures: rep.length,
  textureMB: +texMB.toFixed(2), glbMB: +(fs.statSync(OUT).size / 1e6).toFixed(2) }));
rep.sort((a, b) => b.kb - a.kb).slice(0, 8).forEach(r => console.log("  big tex", r.name, r.w, Math.round(r.kb), "KB"));

// 6. lightmaps (separate files; the site streams the lamp / day layers after first paint)
if (LM_IN) {
  fs.mkdirSync(LM_OUT, { recursive: true }); let total = 0;
  const man = JSON.parse(fs.readFileSync(path.join(LM_IN, "manifest.json")));
  for (const [g, layers] of Object.entries(man.groups)) for (const [l, e] of Object.entries(layers)) {
    const dst = path.join(LM_OUT, e.file.replace(".png", ".ktx2"));
    if (!fs.existsSync(dst)) fs.writeFileSync(dst, (await ktx(fs.readFileSync(path.join(LM_IN, e.file)), { srgb: false, normal: false, max: SIZE.lightmap })).out);
    e.file = path.basename(dst); e.size = Math.min(e.size, SIZE.lightmap); total += fs.statSync(dst).size;
  }
  man.encoding = "linear KTX2 (not sRGB-flagged): irradiance = pow(texel, 2.2) * scale";
  fs.writeFileSync(path.join(LM_OUT, "manifest.json"), JSON.stringify(man, null, 1));
  console.log("LIGHTMAPS", PROFILE, (total / 1e6).toFixed(2), "MB");
}
