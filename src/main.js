import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ## 1. Базові налаштування
const sizes = { width: window.innerWidth, height: window.innerHeight };
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.z = 3;
const canvas = document.querySelector('canvas.webgl');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ## 2. HDRI та Освітлення
const hdrLoader = new HDRLoader();
hdrLoader.load('/textures/studio.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
});
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8); 
directionalLight.position.set(2, 3, 4);
scene.add(directionalLight);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// ## 3. Кристал
const crystalGeometry = new THREE.IcosahedronGeometry(1, 0);
const crystalMaterial = new THREE.MeshPhysicalMaterial({
    transmission: 1.0, 
    roughness: 0.05, 
    metalness: 0.0, 
    ior: 2.417,
    thickness: 2.0, 
    color: 0xffffff, 
    clearcoat: 1.0, 
    clearcoatRoughness: 0.1,
    attenuationColor: new THREE.Color(0x7700ff), 
    attenuationDistance: 1.0
});
const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
scene.add(crystal);

// ## 4. Фон з шейдером - ФІНАЛЬНА ВИПРАВЛЕНА ВЕРСІЯ
const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // Повна, самодостатня версія функції шуму Simplex Noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; } // <-- Додано
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); } // <-- Додано

    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        vec2 aspectCorrectedUv = vUv * 2.0 - 1.0;
        aspectCorrectedUv.x *= uResolution.x / uResolution.y;
        vec2 movingUv = aspectCorrectedUv + vec2(uTime * 0.05, uTime * 0.05);
        float n = snoise(movingUv);
        vec3 color1 = vec3(0.05, 0.0, 0.15);
        vec3 color2 = vec3(0.1, 0.0, 0.4);
        vec3 finalColor = mix(color1, color2, smoothstep(-1.0, 1.0, n));
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;
const backgroundGeometry = new THREE.PlaneGeometry(20, 20);
const backgroundMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader, fragmentShader: fragmentShader,
    uniforms: {
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(sizes.width, sizes.height) }
    }
});
const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
backgroundMesh.position.z = -5;
scene.add(backgroundMesh);

// ## 5. Пост-обробка
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 0.8, 0.6, 0.9);
composer.addPass(bloomPass);

// ## 6. Анімація на скрол
const tl = gsap.timeline({ scrollTrigger: { trigger: '.content', scrub: 1.5, start: 'top top', end: 'bottom bottom' } });
tl.to(crystal.rotation, { x: 1, y: 1.5, duration: 4 }, 0);
tl.to(camera.position, { z: 2.5, duration: 4 }, 0);
tl.to(crystal.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 4 }, 0);

// ## 7. Цикл рендерингу
const clock = new THREE.Clock();
const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    backgroundMaterial.uniforms.uTime.value = elapsedTime;
    
    // Відновлюємо базове обертання кристала
    crystal.rotation.x = elapsedTime * 0.15;
    crystal.rotation.y = elapsedTime * 0.15;
    
    composer.render();
    window.requestAnimationFrame(tick);
};
tick();

// ## 8. Адаптивність
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.setSize(sizes.width, sizes.height);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    backgroundMaterial.uniforms.uResolution.value.set(sizes.width, sizes.height);
});