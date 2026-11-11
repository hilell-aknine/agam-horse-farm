// grass.js — ציצות דשא תלת-ממדיות שמתנדנדות ברוח. ציור אחד (InstancedMesh) לכל הציצות בעולם.
// בלי טקסטורה ובלי שקיפות: כל ציצה היא כמה משולשים צבועים (כהה בבסיס, בהיר בקצה), אז זה זול גם בטלפון.
import * as THREE from 'three';

const uTime = { value: 0 };

// ציצה אחת: כמה עלים שיוצאים ממרכז משותף ונוטים החוצה
function clumpGeometry(blades = 6) {
  const pos = [], col = [], nor = [];
  const base = new THREE.Color(0x3f8a2c), tip = new THREE.Color(0x8fd257);   // קרוב לצבע הקרקע: בלילה ציצה בהירה מדי 'זוהרת'
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + (i % 2) * 0.4;
    const h = 0.34 + (i % 3) * 0.1;
    const w = 0.07;
    const lean = 0.13 + (i % 2) * 0.07;
    const cx = Math.cos(a), cz = Math.sin(a);
    const px = -cz, pz = cx;                       // ניצב לכיוון העלה: רוחב הבסיס
    const bx = cx * 0.05, bz = cz * 0.05;
    pos.push(bx - px * w, 0, bz - pz * w, bx + px * w, 0, bz + pz * w, cx * (0.05 + lean), h, cz * (0.05 + lean));
    col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);           // נורמל כלפי מעלה: מואר כמו הקרקע, בלי עלים שחורים
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

// points: מערך [x, z]. מחזיר Mesh אחד שמכיל את כולן.
function buildGrass(points) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        float sway = sin(uTime * 1.6 + ip.x * 0.35 + ip.z * 0.27) * 0.5 + sin(uTime * 2.9 + ip.x * 0.9) * 0.18;
        transformed.x += sway * position.y * 0.45;
        transformed.z += sway * position.y * 0.25;
      #endif`);
  };
  const mesh = new THREE.InstancedMesh(clumpGeometry(), mat, points.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  points.forEach(([x, z], i) => {
    q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
    const k = 0.8 + Math.random() * 0.9;
    s.set(k, k * (0.8 + Math.random() * 0.6), k);
    p.set(x, 0, z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    const v = 0.82 + Math.random() * 0.3;           // גיוון קל בין ציצות
    c.setRGB(v, v * (0.96 + Math.random() * 0.08), v * 0.9);
    mesh.setColorAt(i, c);
  });
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;                        // פזור על כל העולם: תיבת הגבולות לא שימושית
  return mesh;
}

export { buildGrass, uTime as GrassTime };
