import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DicePreview3DProps = {
  faces: number;
  value?: number; // rolled value to show
  size?: number; // px
  spinMs?: number;
};

const buildGeometry = (faces: number): THREE.BufferGeometry => {
  switch (faces) {
    case 4:
      return new THREE.TetrahedronGeometry(1);
    case 6:
      return new THREE.BoxGeometry(1, 1, 1);
    case 8:
      return new THREE.OctahedronGeometry(1);
    case 12:
      return new THREE.DodecahedronGeometry(1);
    case 20:
      return new THREE.IcosahedronGeometry(1);
    case 10:
    case 100:
    case 1000:
      // Approximate d10 with a 10-sided prism (not exact pentagonal trapezohedron).
      return new THREE.CylinderGeometry(1, 1, 1.2, 10, 1, false);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
};

type UniqueFace = { normal: THREE.Vector3; center: THREE.Vector3 };

const DicePreview3D: React.FC<DicePreview3DProps> = ({ faces, value, size = 72, spinMs = 900 }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return () => {};

    const scene = new THREE.Scene();
    scene.background = null;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(2.8, 2.2, 3.2);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xbfd8ff, 0.9);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 4, 5);
    scene.add(ambient, dir);

    const geo = buildGeometry(faces);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8eb5ff,
      metalness: 0.15,
      roughness: 0.35,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Outline for visual crispness
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x24406f, linewidth: 1 })
    );
    scene.add(line);

    // Helper: build unique face list (group coplanar triangles)
    const buildUniqueFaces = (g: THREE.BufferGeometry): UniqueFace[] => {
      const pos = g.getAttribute('position') as THREE.BufferAttribute;
      const idx = g.getIndex();
      const triCount = (idx ? idx.count : pos.count) / 3;
      const facesRaw: { n: THREE.Vector3; c: THREE.Vector3 }[] = [];
      for (let t = 0; t < triCount; t++) {
        const getV = (i: number) => {
          const ii = idx ? idx.getX(i) : i;
          return new THREE.Vector3(pos.getX(ii), pos.getY(ii), pos.getZ(ii));
        };
        const a = getV(t * 3 + 0);
        const b = getV(t * 3 + 1);
        const c = getV(t * 3 + 2);
        const ab = new THREE.Vector3().subVectors(b, a);
        const ac = new THREE.Vector3().subVectors(c, a);
        const n = new THREE.Vector3().crossVectors(ab, ac).normalize();
        const center = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
        facesRaw.push({ n, c: center });
      }
      // group by normal ~ within epsilon
      const groups: { key: string; items: { n: THREE.Vector3; c: THREE.Vector3 }[] }[] = [];
      const keyFor = (v: THREE.Vector3) => `${Math.round(v.x * 20) / 20}|${Math.round(v.y * 20) / 20}|${Math.round(v.z * 20) / 20}`;
      facesRaw.forEach(f => {
        // Group only by the outward normal; do NOT merge opposite sides
        const k1 = keyFor(f.n);
        let g = groups.find(gr => gr.key === k1);
        if (!g) {
          g = { key: k1, items: [] };
          groups.push(g);
        }
        g.items.push(f);
      });
      let uniques = groups.map(gr => {
        const avgN = gr.items.reduce((acc, it) => acc.add(it.n), new THREE.Vector3()).normalize();
        const avgC = gr.items.reduce((acc, it) => acc.add(it.c), new THREE.Vector3()).multiplyScalar(1 / gr.items.length);
        // ensure normals point outward (rough heuristic)
        return { normal: avgN, center: avgC } as UniqueFace;
      });
      // For d10 family, drop caps: keep side faces only (normals not near y-axis)
      if (faces === 10 || faces === 100 || faces === 1000) {
        uniques = uniques.filter(u => Math.abs(new THREE.Vector3(0, 1, 0).dot(u.normal)) < 0.7);
      }
      return uniques;
    };

    const uniqueFaces = buildUniqueFaces(geo);

    // Face numbers vs. single-value sprite (d100/d1000)
    let sprite: THREE.Sprite | null = null;
    const extraObjects: Array<{ geo?: THREE.BufferGeometry; mat?: THREE.Material; mesh: THREE.Object3D }> = [];
    const needsPerFaceNumbers = faces !== 100 && faces !== 1000;
    if (needsPerFaceNumbers && uniqueFaces.length > 0) {
      const makeLabelTexture = (numStr: string) => {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.clearRect(0,0,256,256);
          // circular badge with subdued night palette
          const cx = 128, cy = 128, r = 108;
          // outer soft glow (very subtle)
          const g = ctx.createRadialGradient(cx, cy, r*0.15, cx, cy, r);
          g.addColorStop(0, 'rgba(121,168,255,0.10)');
          g.addColorStop(1, 'rgba(121,168,255,0.00)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, r+10, 0, Math.PI*2); ctx.fill();
          // inner plate (dark, to reduce overall brightness)
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(20,34,62,0.96)';
          ctx.fill();
          // accent ring (muted)
          ctx.lineWidth = 8;
          ctx.strokeStyle = 'rgba(121,168,255,0.55)';
          ctx.stroke();
          // number (soft off-white)
          ctx.fillStyle = 'rgba(220,232,255,0.92)';
          ctx.font = 'bold 150px Montserrat, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // subtle outline for contrast (deep navy)
          ctx.lineWidth = 6;
          ctx.strokeStyle = 'rgba(9,18,40,0.55)';
          ctx.strokeText(numStr, cx, cy+4);
          ctx.fillText(numStr, cx, cy+4);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = 8;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        // ensure expected gamma
        // @ts-ignore - colorSpace exists on r164
        tex.colorSpace = (THREE as any).SRGBColorSpace || (THREE as any).sRGBEncoding;
        return tex;
      };
      const planeSize = faces >= 20 ? 0.5 : faces >= 12 ? 0.58 : faces >= 8 ? 0.62 : faces === 6 ? 0.7 : 0.62;
      uniqueFaces.forEach((uf, idx) => {
        const num = (idx % faces) + 1;
        const tex = makeLabelTexture(String(num));
        const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        // orient plane +Z to face normal
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), uf.normal.clone().normalize());
        plane.quaternion.copy(q);
        plane.position.copy(uf.center.clone().add(uf.normal.clone().multiplyScalar(0.08)));
        mesh.add(plane);
        extraObjects.push({ geo: planeGeo, mat: planeMat, mesh: plane });
      });
    } else if (typeof value === 'number') {
      // unified circular badge for d100/d1000 result sprite
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0,0,256,256);
        const cx = 128, cy = 128, r = 108;
        const g = ctx.createRadialGradient(cx, cy, r*0.15, cx, cy, r);
        g.addColorStop(0, 'rgba(121,168,255,0.10)');
        g.addColorStop(1, 'rgba(121,168,255,0.00)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, r+10, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(20,34,62,0.96)'; ctx.fill();
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(121,168,255,0.55)'; ctx.stroke();
        ctx.fillStyle = 'rgba(220,232,255,0.92)';
        ctx.font = 'bold 130px Montserrat, Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(9,18,40,0.55)';
        ctx.strokeText(String(value), cx, cy+4);
        ctx.fillText(String(value), cx, cy+4);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 8; tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
      // ensure expected gamma
      // @ts-ignore
      tex.colorSpace = (THREE as any).SRGBColorSpace || (THREE as any).sRGBEncoding;
      const matSprite = new THREE.SpriteMaterial({ map: tex, depthTest: true, depthWrite: false });
      sprite = new THREE.Sprite(matSprite);
      const scale = 0.9;
      sprite.scale.set(scale, scale, 1);
      sprite.position.set(0, 0, 0.8);
      sprite.visible = false;
      mesh.add(sprite);
    }

    // Initial orientation slight randomness per die type
    mesh.rotation.set(Math.PI * 0.25, Math.PI * 0.2, 0);
    line.rotation.copy(mesh.rotation);

    const start = performance.now();
    let finalQuat: THREE.Quaternion | null = null;
    let chosenFace: UniqueFace | null = null;
    const computeFinalPose = () => {
      if (typeof value !== 'number' || uniqueFaces.length === 0) return null;
      // Pick result face deterministically by value
      const idx = (value - 1) % uniqueFaces.length;
      chosenFace = uniqueFaces[idx];
      // Rotate chosen face normal toward camera direction
      const toCam = new THREE.Vector3().subVectors(camera.position, new THREE.Vector3(0, 0, 0)).normalize();
      const q = new THREE.Quaternion();
      q.setFromUnitVectors(chosenFace.normal.clone().normalize(), toCam);
      return q;
    };
    const animate = () => {
      const t = performance.now() - start;
      const k = Math.min(1, t / spinMs);
      // phases: fast spin -> slerp to final orientation (for d6)
      if (k < 0.7) {
        const ease = 1 - Math.pow(1 - k, 3);
        const base = 2.5;
        mesh.rotation.x += 0.02 * (1.2 + base * (1 - ease));
        mesh.rotation.y += 0.024 * (1.0 + base * (1 - ease));
        mesh.rotation.z += 0.017 * (0.8 + base * (1 - ease));
        line.rotation.copy(mesh.rotation);
      } else {
        if (!finalQuat) finalQuat = computeFinalPose();
        if (finalQuat) {
          mesh.quaternion.slerp(finalQuat, 0.15);
          line.quaternion.copy(mesh.quaternion);
          if (sprite && chosenFace) {
            const offset = chosenFace.center.clone().add(chosenFace.normal.clone().multiplyScalar(0.22));
            sprite.position.copy(offset);
            sprite.quaternion.copy(camera.quaternion);
          }
        }
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    // Reveal result near the end
    const revealTimer = window.setTimeout(() => {
      if (sprite) sprite.visible = true;
    }, Math.max(0, spinMs - 150));

    const cleanup = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(revealTimer);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      edges.dispose();
      extraObjects.forEach(o => {
        if (o.mesh.parent) o.mesh.parent.remove(o.mesh);
        if (o.mat) o.mat.dispose();
        if (o.geo) o.geo.dispose();
      });
    };

    return cleanup;
  }, [faces, value, size, spinMs]);

  return <div ref={mountRef} style={{ width: size, height: size }} />;
};

export default DicePreview3D;

