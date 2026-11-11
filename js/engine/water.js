// water.js — מים מצוירים בשיידר קטן: עמוק במרכז ובהיר בשוליים, אדוות נעות, פס קצף בקו החוף ונצנוצי שמש.
// בלי השתקפות אמיתית (יקר מדי לטלפון). שני ערכים משותפים לכל המים בעולם: זמן, וגוון לפי שעת היום.
import * as THREE from 'three';

const shared = {
  time: { value: 0 },
  tint: { value: new THREE.Color(1, 1, 1) },   // World._applyTime מחשיך את המים בלילה
  day: { value: 1 }                            // 0..1: כמה נצנוצי שמש
};

const VERT = `
  varying vec2 vP;
  #include <fog_pars_vertex>
  void main() {
    vP = position.xy;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = `
  uniform float time; uniform float day; uniform float anim;
  uniform vec3 tint; uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam;
  uniform vec2 size;
  varying vec2 vP;
  #include <fog_pars_fragment>
  void main() {
    float r = length(vP);
    float ang = atan(vP.y, vP.x);
    float t = time * anim;
    // קו החוף לא עיגול מושלם: מתנדנד מעט, כמו גלים קטנים שנוגעים בחול
    float edge = 0.92 + 0.022 * sin(ang * 7.0 + t * 0.8) + 0.014 * sin(ang * 13.0 - t * 1.3);
    vec2 w = vP * size * 0.5;                       // מיקום ביחידות עולם
    vec3 col = mix(deep, shallow, smoothstep(0.5, edge, r));
    float wave = sin(w.x * 1.3 + t * 1.1) * sin(w.y * 1.6 - t * 0.9) + 0.5 * sin((w.x + w.y) * 0.7 + t * 0.6);
    col += 0.035 * wave;
    // נצנוצים: שלושה גלים בכיוונים שונים, כך שהם לא מסתדרים ברשת
    float s3 = sin(dot(w, vec2(1.7, 2.9)) + t * 1.9) + sin(dot(w, vec2(-2.6, 1.3)) - t * 1.4) + sin(dot(w, vec2(3.3, -0.9)) + t * 1.1);
    float sp = pow(max(0.0, s3 / 3.0), 10.0);
    col += sp * 0.6 * day;                          // נצנוצי שמש
    float f = smoothstep(edge - 0.045, edge - 0.012, r) * (1.0 - smoothstep(edge, edge + 0.03, r));
    f *= 0.75 + 0.25 * sin(ang * 23.0 + t * 2.0);    // הקצף שבור, לא פס אחיד
    col = mix(col, foam, clamp(f, 0.0, 1.0) * 0.9);
    float alpha = 1.0 - smoothstep(edge + 0.01, edge + 0.045, r);
    gl_FragColor = vec4(col * tint, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

// משטח מים אליפטי ברוחב w ובעומק d (יחידות עולם), שוכב על הקרקע. animated=false למכשיר חלש.
function makeWater(w, d, opts = {}) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    deep: { value: new THREE.Color(opts.deep ?? 0x1c7fc9) },
    shallow: { value: new THREE.Color(opts.shallow ?? 0x49b9e6) },
    foam: { value: new THREE.Color(0xffffff) },
    size: { value: new THREE.Vector2(w, d) },
    anim: { value: opts.animated === false ? 0 : 1 }
  }]);
  uniforms.time = shared.time; uniforms.tint = shared.tint; uniforms.day = shared.day;
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, fog: true,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat);
  m.rotation.x = -Math.PI / 2;
  m.scale.set(w / 2, d / 2, 1);
  m.userData.flat = true;
  return m;
}

export { makeWater, shared as WaterShared };
