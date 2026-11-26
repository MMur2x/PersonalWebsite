// copies the KTX2 (Basis Universal) transcoder that three's KTX2Loader loads at runtime
import fs from "fs";
const src = "node_modules/three/examples/jsm/libs/basis/", dst = "../../assets/vendor/basis/";
fs.mkdirSync(dst, { recursive: true });
for (const f of ["basis_transcoder.js", "basis_transcoder.wasm"]) fs.copyFileSync(src + f, dst + f);
console.log("basis transcoder ->", dst);
