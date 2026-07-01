 "use client";
 
 import * as THREE from "three";
 
 const COLOR_PALETTES = {
  1: {
    uColor1: [0.345, 0.176, 0.961],
    uColor2: [0.18, 0.1, 0.6],
    uColor3: [0.32, 0.2, 0.95],
    uColor4: [0.14, 0.08, 0.5],
    uColor5: [0.38, 0.22, 0.98],
    uColor6: [0.24, 0.14, 0.78],
    // 베이스(모션 제외) — 더 깊은 어둠
    uDarkNavy: [0.055, 0.0, 0.16],
  },
  2: {
    uColor1: [0.2, 0.6, 0.9],
    uColor2: [0.35, 0.25, 0.75],
    uColor3: [0.25, 0.65, 0.95],
    uColor4: [0.4, 0.2, 0.7],
    uColor5: [0.3, 0.7, 1.0],
    uColor6: [0.45, 0.35, 0.85],
    // Intro + Contact 공통 팔레트: 베이스만 더 어둡게 (uColor1–6 그대로)
    uDarkNavy: [0.028, 0.006, 0.1],
  },
   3: {
     uColor1: [0.45, 0.15, 0.85],
     uColor2: [0.25, 0.08, 0.55],
     uColor3: [0.5, 0.18, 0.9],
     uColor4: [0.2, 0.05, 0.45],
     uColor5: [0.55, 0.2, 0.95],
     uColor6: [0.35, 0.12, 0.7],
     uDarkNavy: [0.08, 0.01, 0.18],
   },
 };
 
 class TouchTexture {
   constructor() {
     this.size = 64;
     this.width = this.height = this.size;
     this.maxAge = 120;
     this.radius = 0.3 * this.size;
     this.speed = 1 / this.maxAge;
     this.trail = [];
     this.last = null;
     this.initTexture();
   }
 
   initTexture() {
     this.canvas = document.createElement("canvas");
     this.canvas.width = this.width;
     this.canvas.height = this.height;
     this.ctx = this.canvas.getContext("2d");
     this.ctx.fillStyle = "black";
     this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
     this.texture = new THREE.Texture(this.canvas);
   }
 
   update() {
     this.clear();
     const speed = this.speed;
     for (let i = this.trail.length - 1; i >= 0; i--) {
       const point = this.trail[i];
       let f = point.force * speed * (1 - point.age / this.maxAge);
       point.x += point.vx * f;
       point.y += point.vy * f;
       point.age++;
       if (point.age > this.maxAge) {
         this.trail.splice(i, 1);
       } else {
         this.drawPoint(point);
       }
     }
     this.texture.needsUpdate = true;
   }
 
   clear() {
     this.ctx.fillStyle = "black";
     this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
   }
 
   addTouch(point) {
     let force = 0;
     let vx = 0;
     let vy = 0;
     const last = this.last;
     if (last) {
       const dx = point.x - last.x;
       const dy = point.y - last.y;
       if (dx === 0 && dy === 0) return;
       const dd = dx * dx + dy * dy;
       const d = Math.sqrt(dd);
       vx = dx / d;
       vy = dy / d;
       force = Math.min(dd * 10000, 1.0);
     }
     this.last = { x: point.x, y: point.y };
     this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
   }
 
   drawPoint(point) {
     const pos = {
       x: point.x * this.width,
       y: (1 - point.y) * this.height,
     };
 
     let intensity = 1;
     if (point.age < this.maxAge * 0.3) {
       intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
     } else {
       const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
       intensity = -t * (t - 2);
     }
     intensity *= point.force;
 
     const radius = this.radius;
     const color = `${((point.vx + 1) / 2) * 255}, ${
       ((point.vy + 1) / 2) * 255
     }, ${intensity * 255}`;
     const offset = this.size * 5;
     this.ctx.shadowOffsetX = offset;
     this.ctx.shadowOffsetY = offset;
     this.ctx.shadowBlur = radius * 0.25;
     this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;
 
     this.ctx.beginPath();
     this.ctx.fillStyle = "rgba(255,0,0,1)";
     this.ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
     this.ctx.fill();
   }
 }
 
 class GradientBackground {
   constructor(app, width, height, colorPalette = 1) {
     this.app = app;
     this.mesh = null;
     const palette = COLOR_PALETTES[colorPalette] || COLOR_PALETTES[1];
 
     this.uniforms = {
       uTime: { value: 0 },
       uResolution: {
         value: new THREE.Vector2(width, height),
       },
       uColor1: { value: new THREE.Vector3(...palette.uColor1) },
       uColor2: { value: new THREE.Vector3(...palette.uColor2) },
       uColor3: { value: new THREE.Vector3(...palette.uColor3) },
       uColor4: { value: new THREE.Vector3(...palette.uColor4) },
       uColor5: { value: new THREE.Vector3(...palette.uColor5) },
       uColor6: { value: new THREE.Vector3(...palette.uColor6) },
       uSpeed: { value: 0.25 },
       uIntensity: { value: 1.1 },
       uTouchTexture: { value: null },
       uGrainIntensity: { value: 0.03 },
       uZoom: { value: 1.0 },
       uDarkNavy: { value: new THREE.Vector3(...palette.uDarkNavy) },
       uGradientSize: { value: 0.5 },
       uGradientCount: { value: 8.0 },
       uColor1Weight: { value: 0.5 },
       uColor2Weight: { value: 1.0 },
     };
   }
 
   updatePalette(colorPalette) {
     const palette = COLOR_PALETTES[colorPalette] || COLOR_PALETTES[1];
     if (this.uniforms) {
       this.uniforms.uColor1.value.set(...palette.uColor1);
       this.uniforms.uColor2.value.set(...palette.uColor2);
       this.uniforms.uColor3.value.set(...palette.uColor3);
       this.uniforms.uColor4.value.set(...palette.uColor4);
       this.uniforms.uColor5.value.set(...palette.uColor5);
       this.uniforms.uColor6.value.set(...palette.uColor6);
       this.uniforms.uDarkNavy.value.set(...palette.uDarkNavy);
     }
   }
 
   init() {
     const { width, height } = this.app.getViewSize();
     const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
 
     const material = new THREE.ShaderMaterial({
       uniforms: this.uniforms,
       vertexShader: `
         varying vec2 vUv;
         void main() {
           vec3 pos = position.xyz;
           gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
           vUv = uv;
         }
       `,
       fragmentShader: `
         uniform float uTime;
         uniform vec2 uResolution;
         uniform vec3 uColor1;
         uniform vec3 uColor2;
         uniform vec3 uColor3;
         uniform vec3 uColor4;
         uniform vec3 uColor5;
         uniform vec3 uColor6;
         uniform float uSpeed;
         uniform float uIntensity;
         uniform sampler2D uTouchTexture;
         uniform float uGrainIntensity;
         uniform float uZoom;
         uniform vec3 uDarkNavy;
         uniform float uGradientSize;
         uniform float uGradientCount;
         uniform float uColor1Weight;
         uniform float uColor2Weight;
 
         varying vec2 vUv;
 
         float grain(vec2 uv, float time) {
           vec2 gUv = uv * uResolution * 0.5;
           float g = fract(sin(dot(gUv + time, vec2(12.9898, 78.233))) * 43758.5453);
           return g * 2.0 - 1.0;
         }
 
         vec3 getGradientColor(vec2 uv, float time) {
           float gradientRadius = uGradientSize;
 
           vec2 center1 = vec2(
             0.5 + sin(time * uSpeed * 0.4) * 0.4,
             0.5 + cos(time * uSpeed * 0.5) * 0.4
           );
           vec2 center2 = vec2(
             0.5 + cos(time * uSpeed * 0.6) * 0.5,
             0.5 + sin(time * uSpeed * 0.45) * 0.5
           );
           vec2 center3 = vec2(
             0.5 + sin(time * uSpeed * 0.35) * 0.45,
             0.5 + cos(time * uSpeed * 0.55) * 0.45
           );
           vec2 center4 = vec2(
             0.5 + cos(time * uSpeed * 0.5) * 0.4,
             0.5 + sin(time * uSpeed * 0.4) * 0.4
           );
           vec2 center5 = vec2(
             0.5 + sin(time * uSpeed * 0.7) * 0.35,
             0.5 + cos(time * uSpeed * 0.6) * 0.35
           );
           vec2 center6 = vec2(
             0.5 + cos(time * uSpeed * 0.45) * 0.5,
             0.5 + sin(time * uSpeed * 0.65) * 0.5
           );
 
           float dist1 = length(uv - center1);
           float dist2 = length(uv - center2);
           float dist3 = length(uv - center3);
           float dist4 = length(uv - center4);
           float dist5 = length(uv - center5);
           float dist6 = length(uv - center6);
 
           float influence1 = 1.0 - smoothstep(0.0, gradientRadius, dist1);
           float influence2 = 1.0 - smoothstep(0.0, gradientRadius, dist2);
           float influence3 = 1.0 - smoothstep(0.0, gradientRadius, dist3);
           float influence4 = 1.0 - smoothstep(0.0, gradientRadius, dist4);
           float influence5 = 1.0 - smoothstep(0.0, gradientRadius, dist5);
           float influence6 = 1.0 - smoothstep(0.0, gradientRadius, dist6);
 
           vec2 rUv1 = uv - 0.5;
           float angle1 = time * uSpeed * 0.06;
           rUv1 = vec2(
             rUv1.x * cos(angle1) - rUv1.y * sin(angle1),
             rUv1.x * sin(angle1) + rUv1.y * cos(angle1)
           );
           rUv1 += 0.5;
 
           float radial1 = length(rUv1 - 0.5);
           float radialInfluence1 = 1.0 - smoothstep(0.0, 1.1, radial1);
 
           vec3 color = vec3(0.0);
           color += uColor1 * influence1 * uColor1Weight;
           color += uColor2 * influence2 * uColor2Weight;
           color += uColor3 * influence3 * uColor1Weight;
           color += uColor4 * influence4 * uColor2Weight;
           color += uColor5 * influence5 * uColor1Weight;
           color += uColor6 * influence6 * uColor2Weight;
 
           color += mix(uColor1, uColor3, radialInfluence1) * 0.25 * uColor1Weight;
 
           color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;
 
           float luminance = dot(color, vec3(0.299, 0.587, 0.114));
           color = mix(vec3(luminance), color, 1.1);
 
           color = pow(color, vec3(0.96));
 
           float brightness1 = length(color);
           float mixFactor1 = max(brightness1 * 1.1, 0.28);
           color = mix(uDarkNavy, color, mixFactor1);
 
           float maxBrightness = 1.0;
           float brightness = length(color);
           if (brightness > maxBrightness) {
             color = color * (maxBrightness / brightness);
           }
 
           return color;
         }
 
         void main() {
           vec2 uv = vUv;
 
           vec4 touchTex = texture2D(uTouchTexture, uv);
           float vx = -(touchTex.r * 2.0 - 1.0);
           float vy = -(touchTex.g * 2.0 - 1.0);
           float tIntensity = touchTex.b;
           uv.x += vx * 0.1 * tIntensity;
           uv.y += vy * 0.1 * tIntensity;
 
           vec2 center = vec2(0.5);
           float dist = length(uv - center);
           float ripple = sin(dist * 12.0 - uTime * 0.6) * 0.004 * tIntensity;
           float wave = sin(dist * 8.0 - uTime * 0.4) * 0.003 * tIntensity;
           uv += vec2(ripple + wave);
 
           vec3 color = getGradientColor(uv, uTime);
 
           float g = grain(uv, uTime);
           color += g * uGrainIntensity;
 
           float timeShift = uTime * 0.25;
           color.r += sin(timeShift) * 0.006;
           color.b += cos(timeShift * 1.1) * 0.006;
 
           float brightness2 = length(color);
           float mixFactor2 = max(brightness2 * 1.05, 0.28);
           color = mix(uDarkNavy, color, mixFactor2);
 
           color = clamp(color, vec3(0.0), vec3(1.0));
 
           float maxBrightness = 1.0;
           float b = length(color);
           if (b > maxBrightness) {
             color = color * (maxBrightness / b);
           }
 
           gl_FragColor = vec4(color, 0.85);
         }
       `,
     });
 
     this.mesh = new THREE.Mesh(geometry, material);
     this.mesh.position.z = 0;
     this.app.scene.add(this.mesh);
   }
 
   update(delta) {
     if (this.uniforms.uTime) {
       this.uniforms.uTime.value += delta;
     }
   }
 
   onResize(width, height) {
     const { width: viewW, height: viewH } = this.app.getViewSize();
     if (this.mesh) {
       this.mesh.geometry.dispose();
       this.mesh.geometry = new THREE.PlaneGeometry(viewW, viewH, 1, 1);
     }
     if (this.uniforms.uResolution) {
       this.uniforms.uResolution.value.set(width, height);
     }
   }
 
   dispose() {
     if (this.mesh) {
       this.app.scene.remove(this.mesh);
       this.mesh.geometry.dispose();
       this.mesh.material.dispose();
       this.mesh = null;
     }
   }
 }
 
 class App {
   constructor(container, colorPalette = 1) {
     this.container = container;
     this.colorPalette = colorPalette;
     const width = container.clientWidth || window.innerWidth;
     const height = container.clientHeight || window.innerHeight;
 
     this.renderer = new THREE.WebGLRenderer({
       antialias: true,
       powerPreference: "high-performance",
       alpha: true,
       stencil: false,
       depth: false,
     });
     this.renderer.setSize(width, height);
     this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
     this.renderer.domElement.style.width = "100%";
     this.renderer.domElement.style.height = "100%";
     this.renderer.domElement.style.display = "block";
     this.renderer.domElement.style.pointerEvents = "none";
     this.container.appendChild(this.renderer.domElement);
 
     this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
     this.camera.position.z = 50;
 
     this.scene = new THREE.Scene();
     this.renderer.setClearColor(0x000000, 0);
     this.clock = new THREE.Clock();
 
     this.touchTexture = new TouchTexture();
     this.gradientBackground = new GradientBackground(this, width, height, colorPalette);
     this.gradientBackground.uniforms.uTouchTexture.value =
       this.touchTexture.texture;
 
     this.mouse = { x: 0.5, y: 0.5 };
 
     this._onResize = this.onResize.bind(this);
     this._onMouseMove = this.onMouseMove.bind(this);
     this._onTouchMove = this.onTouchMove.bind(this);
 
     this.gradientBackground.init();
     this.start();
 
     window.addEventListener("resize", this._onResize);
     window.addEventListener("mousemove", this._onMouseMove);
     window.addEventListener("touchmove", this._onTouchMove, { passive: true });
   }
 
   getViewSize() {
     const fovInRadians = (this.camera.fov * Math.PI) / 180;
     const height = Math.abs(this.camera.position.z * Math.tan(fovInRadians / 2) * 2);
     return { width: height * this.camera.aspect, height };
   }
 
   onMouseMove(ev) {
     const rect = this.container.getBoundingClientRect();
     this.mouse = {
       x: (ev.clientX - rect.left) / rect.width,
       y: 1 - (ev.clientY - rect.top) / rect.height,
     };
     this.touchTexture.addTouch(this.mouse);
   }
 
   onTouchMove(ev) {
     const touch = ev.touches[0];
     if (!touch) return;
     this.onMouseMove(touch);
   }
 
   onResize() {
     const width = this.container.clientWidth || window.innerWidth;
     const height = this.container.clientHeight || window.innerHeight;
     this.camera.aspect = width / height;
     this.camera.updateProjectionMatrix();
     this.renderer.setSize(width, height);
     this.gradientBackground.onResize(width, height);
   }
 
   update(delta) {
     this.touchTexture.update();
     this.gradientBackground.update(delta);
   }
 
   render() {
     const delta = Math.min(this.clock.getDelta(), 0.1);
     this.update(delta);
     this.renderer.render(this.scene, this.camera);
   }
 
   start() {
     if (this._frameId) return;
     const loop = () => {
       this.render();
       this._frameId = requestAnimationFrame(loop);
     };
     this._frameId = requestAnimationFrame(loop);
   }
 
   stop() {
     if (this._frameId) {
       cancelAnimationFrame(this._frameId);
       this._frameId = null;
     }
   }
 
   updatePalette(colorPalette) {
     if (this.gradientBackground) {
       this.gradientBackground.updatePalette(colorPalette);
       this.colorPalette = colorPalette;
     }
   }
 
   dispose() {
     this.stop();
     window.removeEventListener("resize", this._onResize);
     window.removeEventListener("mousemove", this._onMouseMove);
     window.removeEventListener("touchmove", this._onTouchMove);
     this.gradientBackground.dispose();
     this.renderer.dispose();
     if (this.renderer.domElement.parentNode === this.container) {
       this.container.removeChild(this.renderer.domElement);
     }
   }
 }
 
 export function createLiquidGradient(container, colorPalette = 1) {
   if (typeof window === "undefined" || !container) {
     return () => {};
   }
   const app = new App(container, colorPalette);
   return app;
 }
