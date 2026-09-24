import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {dedup,prune,weld,reorder,listTextureInfoByMaterial} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {writeFile,stat,mkdir,copyFile} from 'node:fs/promises';
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
await mkdir('../work/game-source-assets',{recursive:true});
const report={};
for(const name of ['lab','sensor-kit',...(process.argv.includes('--with-solder')?['solder-bench']:[]),...(process.argv.includes('--with-print')?['print-bench']:[])]){
 const p=`public/models/${name}.glb`,backup=`../work/game-source-assets/${name}.glb`;
 if(process.argv.includes('--refresh-source'))await copyFile(p,backup);
 else{try{await stat(backup);}catch{await copyFile(p,backup);}}
 const before=(await stat(backup)).size;const document=await io.read(backup);
 // Blender's joined-mesh export can write texCoord: -1. Repair it BEFORE prune,
 // otherwise it deletes TEXCOORD_0 as unused and every image samples one pixel.
 for(const material of document.getRoot().listMaterials()){
  for(const info of listTextureInfoByMaterial(material))if(info.getTexCoord()<0)info.setTexCoord(0);
 }
 function checkUVs(doc){
  for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){
   for(const info of p.getMaterial()?listTextureInfoByMaterial(p.getMaterial()):[]){
    if(!p.getAttribute(`TEXCOORD_${info.getTexCoord()}`))throw new Error(`${name}: missing UVs for ${p.getMaterial().getName()}`);
   }
  }
 }
 checkUVs(document);
 // Keep float positions and all triangles: room-scale decimation/quantization
 // collapsed millimetre cables and made round props faceted. Only lossless packing.
 await document.transform(dedup(),weld(),prune(),reorder({encoder:MeshoptEncoder,target:'size'}));
 document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 checkUVs(document);
 await io.write(p,document);
 checkUVs(await io.read(p));const after=(await stat(p)).size;report[name]={before,after};console.log(name,report[name]);
}
await writeFile('compression-report.json',JSON.stringify(report,null,2));
