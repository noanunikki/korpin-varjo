'use strict';
// =====================================================================
//  EFEKTIT: hiukkaset (pöly, kipinät, heinä), yhden piirtokutsun Points-järjestelmä
// =====================================================================
const FX = {
  N: 800, i: 0,
  init(scene) {
    const N = this.N;
    this.pos = new Float32Array(N * 3); this.size = new Float32Array(N); this.alpha = new Float32Array(N); this.col = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N);
    this.grav = new Float32Array(N); this.s0 = new Float32Array(N); this.grow = new Float32Array(N); this.a0 = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC;' +
        'void main(){ vA=aAlpha; vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*(420.0/max(0.5,-mv.z)); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(vC, vA*smoothstep(0.5,0.12,d)); }',
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 5; scene.add(this.points);
    this.geo = g;
  },
  emit(x, y, z, vx, vy, vz, c, size, life, grav, grow, alpha) {
    const k = this.i++ % this.N, p = k * 3;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
    this.col[p] = c[0]; this.col[p + 1] = c[1]; this.col[p + 2] = c[2];
    this.life[k] = life; this.max[k] = life; this.grav[k] = grav; this.s0[k] = size; this.grow[k] = grow || 0; this.a0[k] = alpha === undefined ? 0.8 : alpha;
    this.size[k] = size; this.alpha[k] = this.a0[k];
  },
  // säteittäinen purske
  burst(x, y, z, n, speed, c, size, life, grav, up, grow) {
    for (let j = 0; j < n; j++) {
      const a = Math.random() * 6.283, e = (Math.random() - 0.3) * 1.2, s = speed * (0.4 + Math.random() * 0.8);
      this.emit(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + (up || 0), Math.sin(a) * Math.cos(e) * s, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav, grow);
    }
  },
  // maanpinnan rengas (laskeutumispöly)
  ring(x, y, z, n, speed, c, size, life) {
    for (let j = 0; j < n; j++) {
      const a = (j / n) * 6.283 + Math.random() * 0.3, s = speed * (0.7 + Math.random() * 0.5);
      this.emit(x + Math.cos(a) * 0.3, y + 0.1, z + Math.sin(a) * 0.3, Math.cos(a) * s, 0.4 + Math.random() * 0.8, Math.sin(a) * s, c, size * (0.7 + Math.random() * 0.6), life, -1.2, 1.8, 0.55);
    }
  },
  dust(x, y, z, c, size) { this.emit(x + (Math.random() - 0.5) * 0.3, y + 0.05, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8, c || [0.72, 0.66, 0.56], size || 0.35, 0.55, -0.6, 1.6, 0.5); },
  sparks(x, y, z, n) { for (let j = 0; j < n; j++) { const a = Math.random() * 6.283, s = 2.5 + Math.random() * 4; this.emit(x, y, z, Math.cos(a) * s, 1 + Math.random() * 3, Math.sin(a) * s, [1, 0.85, 0.45], 0.12 + Math.random() * 0.08, 0.3 + Math.random() * 0.25, 14, -0.3, 1); } },
  update(dt) {
    const N = this.N;
    for (let k = 0; k < N; k++) {
      if (this.life[k] <= 0) { if (this.alpha[k] !== 0) { this.alpha[k] = 0; this.size[k] = 0; } continue; }
      this.life[k] -= dt; const p = k * 3, t = 1 - Math.max(0, this.life[k]) / this.max[k];
      this.vel[p + 1] -= this.grav[k] * dt;
      const drag = Math.max(0, 1 - 1.8 * dt);
      this.vel[p] *= drag; this.vel[p + 2] *= drag;
      this.pos[p] += this.vel[p] * dt; this.pos[p + 1] += this.vel[p + 1] * dt; this.pos[p + 2] += this.vel[p + 2] * dt;
      if (this.pos[p + 1] < 0.02 && this.grav[k] > 5) { this.pos[p + 1] = 0.02; this.vel[p + 1] *= -0.3; }
      this.alpha[k] = this.a0[k] * (1 - t) * Math.min(1, (1 - t) * 3);
      this.size[k] = this.s0[k] * (1 + this.grow[k] * t);
    }
    const g = this.geo.attributes;
    g.position.needsUpdate = true; g.aSize.needsUpdate = true; g.aAlpha.needsUpdate = true; g.aColor.needsUpdate = true;
  },
};
