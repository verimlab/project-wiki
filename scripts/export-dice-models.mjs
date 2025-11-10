#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, NodeIO } from '@gltf-transform/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceJsonPath = path.resolve(projectRoot, 'public/assets/dice-box/assets/themes/default/default.json');
const texturePath = path.resolve(projectRoot, 'public/assets/dice-box/themes/default/diffuse-light.png');
const outputModelDir = path.resolve(projectRoot, 'public/models');
const faceDataPath = path.resolve(projectRoot, 'src/components/dice-roller/generatedFaceNormals.ts');

const diceNames = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

const textureBytes = fs.readFileSync(texturePath);
const diceSource = JSON.parse(fs.readFileSync(sourceJsonPath, 'utf-8'));
const meshByName = new Map(diceSource.meshes.map((mesh) => [mesh.name, mesh]));
const faceMaps = diceSource.colliderFaceMap ?? {};

fs.mkdirSync(outputModelDir, { recursive: true });

const io = new NodeIO();

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy(other) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  sub(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }

  add(other) {
    this.x += other.x;
    this.y += other.y;
    this.z += other.z;
    return this;
  }

  cross(a, b) {
    const ax = a.x;
    const ay = a.y;
    const az = a.z;
    const bx = b.x;
    const by = b.y;
    const bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }

  normalize() {
    const length = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= length;
    this.y /= length;
    this.z /= length;
    return this;
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}

const tempV0 = new Vec3();
const tempV1 = new Vec3();
const edge1 = new Vec3();
const edge2 = new Vec3();

const faceNormalData = {};

async function exportDie(name) {
  const mesh = meshByName.get(name);
  if (!mesh) {
    throw new Error(`Mesh "${name}" not found in dice source`);
  }

  const doc = new Document();
  const scene = doc.createScene(name);
  const buffer = doc.createBuffer(`${name}_buffer`);

  const positions = new Float32Array(mesh.positions);
  const normals = new Float32Array(mesh.normals);
  const uvs = new Float32Array(mesh.uvs);
  const tangents = mesh.tangents ? new Float32Array(mesh.tangents) : null;
  const maxIndex = Math.max(...mesh.indices);
  const indexArray =
    maxIndex > 65535 ? new Uint32Array(mesh.indices) : new Uint16Array(mesh.indices);

  const positionAccessor = doc
    .createAccessor(`${name}_positions`)
    .setType('VEC3')
    .setArray(positions)
    .setBuffer(buffer);
  const normalAccessor = doc
    .createAccessor(`${name}_normals`)
    .setType('VEC3')
    .setArray(normals)
    .setBuffer(buffer);
  const uvAccessor = doc
    .createAccessor(`${name}_uvs`)
    .setType('VEC2')
    .setArray(uvs)
    .setBuffer(buffer);
  const indexAccessor = doc
    .createAccessor(`${name}_indices`)
    .setType('SCALAR')
    .setArray(indexArray)
    .setBuffer(buffer);

  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', positionAccessor)
    .setAttribute('NORMAL', normalAccessor)
    .setAttribute('TEXCOORD_0', uvAccessor)
    .setIndices(indexAccessor);

  if (tangents) {
    const tangentAccessor = doc
      .createAccessor(`${name}_tangents`)
      .setType('VEC4')
      .setArray(tangents)
      .setBuffer(buffer);
    primitive.setAttribute('TANGENT', tangentAccessor);
  }

  const texture = doc
    .createTexture(`${name}_texture`)
    .setMimeType('image/png')
    .setImage(textureBytes);
  const material = doc
    .createMaterial(`${name}_material`)
    .setBaseColorTexture(texture)
    .setMetallicFactor(0.05)
    .setRoughnessFactor(0.45);

  primitive.setMaterial(material);

  const meshNode = doc.createMesh(name).addPrimitive(primitive);
  const node = doc.createNode(name).setMesh(meshNode);
  scene.addChild(node);

  const arrayBuffer = await io.writeBinary(doc);
  const outputPath = path.join(outputModelDir, `${name}.glb`);
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
  console.log(`Exported ${outputPath}`);

  faceNormalData[name] = computeFaceNormals(mesh, faceMaps[name] ?? {});
}

function computeFaceNormals(mesh, faceMap) {
  const indices = mesh.indices;
  const positions = mesh.positions;
  const triangles = indices.length / 3;
  const normalsByValue = new Map();

  for (let tri = 0; tri < triangles; tri += 1) {
    const value = faceMap[String(tri)];
    if (typeof value === 'undefined') continue;
    const i0 = indices[tri * 3];
    const i1 = indices[tri * 3 + 1];
    const i2 = indices[tri * 3 + 2];
    tempV0.x = positions[i0 * 3];
    tempV0.y = positions[i0 * 3 + 1];
    tempV0.z = positions[i0 * 3 + 2];
    tempV1.x = positions[i1 * 3];
    tempV1.y = positions[i1 * 3 + 1];
    tempV1.z = positions[i1 * 3 + 2];
    const v2x = positions[i2 * 3];
    const v2y = positions[i2 * 3 + 1];
    const v2z = positions[i2 * 3 + 2];
    edge1.sub(tempV1, tempV0);
    edge2.x = v2x - tempV0.x;
    edge2.y = v2y - tempV0.y;
    edge2.z = v2z - tempV0.z;
    const normal = new Vec3().cross(edge1, edge2).normalize();
    if (!normalsByValue.has(value)) {
      normalsByValue.set(value, []);
    }
    normalsByValue.get(value).push(normal);
  }

  const faces = [];
  for (const [value, normals] of normalsByValue.entries()) {
    const aggregate = normals.reduce((acc, current) => acc.add(current), new Vec3());
    aggregate.normalize();
    faces.push({
      value: Number(value),
      normal: aggregate.toArray().map((component) => Number(component.toFixed(6))),
    });
  }
  faces.sort((a, b) => a.value - b.value);
  return faces;
}

(async function run() {
  try {
    for (const name of diceNames) {
      await exportDie(name);
    }
    const faceDataContent = `// AUTO-GENERATED BY scripts/export-dice-models.mjs\n` +
      `export const GENERATED_DICE_FACE_NORMALS = ${JSON.stringify(faceNormalData, null, 2)} as const;\n`;
    fs.writeFileSync(faceDataPath, faceDataContent);
    console.log(`Wrote face normal data to ${faceDataPath}`);
    console.log('Done.');
  } catch (error) {
    console.error('Failed to export dice models:', error);
    process.exit(1);
  }
})();
