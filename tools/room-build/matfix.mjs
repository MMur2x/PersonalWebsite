// Material changes for runtime speed. Used by compress.mjs; runnable on its own:  node matfix.mjs <in.glb> <out.glb>
import { KHRMaterialsTransmission, KHRMaterialsVolume, KHRMaterialsIOR } from "@gltf-transform/extensions";

export function fixMaterials(doc) {
  const out = { glass: [], cutout: [] };
  for (const m of doc.getRoot().listMaterials()) {
    // transmission makes three.js render the whole scene a second time every frame -> plain blended glass
    if (m.getExtension("KHR_materials_transmission")) {
      m.setExtension("KHR_materials_transmission", null).setExtension("KHR_materials_volume", null).setExtension("KHR_materials_ior", null);
      const c = m.getBaseColorFactor();
      m.setAlphaMode("BLEND").setBaseColorFactor([c[0], c[1], c[2], 0.12]).setRoughnessFactor(0.05).setMetallicFactor(0);
      out.glass.push(m.getName());
    }
    // blended foliage needs sorting + overdraw; a cutout is one opaque pass
    if (m.getAlphaMode() === "BLEND" && m.getBaseColorTexture() && /leaves|leaf|plant/i.test(m.getName())) {
      m.setAlphaMode("MASK").setAlphaCutoff(0.5); out.cutout.push(m.getName());
    }
  }
  for (const E of [KHRMaterialsTransmission, KHRMaterialsVolume, KHRMaterialsIOR])
    doc.getRoot().listExtensionsUsed().filter(e => e instanceof E).forEach(e => e.dispose());
  return out;
}

if (process.argv[1].endsWith("matfix.mjs")) {
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const { MeshoptEncoder, MeshoptDecoder } = await import("meshoptimizer");
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(process.argv[2]);
  console.log(JSON.stringify(fixMaterials(doc)));
  await io.write(process.argv[3], doc);
}
