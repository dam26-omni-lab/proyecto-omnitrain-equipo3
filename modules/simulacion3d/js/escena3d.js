import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export let scene, renderer, container;
export let width, height;
export const RUTA_RECURSOS = '../../recursosbastian/';

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

export function inicializarBase3D() {
    container = document.getElementById('contenedor-3d');
    width = container.clientWidth;
    height = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b2436);
    scene.fog = new THREE.Fog(0x1b2436, 25, 75);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    crearIluminacion();
    crearInfraestructura();

    window.addEventListener('resize', onWindowResize);
}

function crearIluminacion() {
    const ambient = new THREE.AmbientLight(0xfff2e0, 0.6);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x33291f, 0.4);
    scene.add(hemi);

    const direccional = new THREE.DirectionalLight(0xffe9c7, 1.0);
    direccional.position.set(-12, 20, 10);
    direccional.castShadow = true;
    direccional.shadow.mapSize.set(2048, 2048);
    direccional.shadow.camera.left = -25;
    direccional.shadow.camera.right = 25;
    direccional.shadow.camera.top = 25;
    direccional.shadow.camera.bottom = -25;
    scene.add(direccional);
}

function crearInfraestructura() {
    // Suelo con cuadrícula neutra similar al vídeo interactivo
    const sueloGeo = new THREE.PlaneGeometry(50, 50);
    const sueloMat = new THREE.MeshStandardMaterial({ 
        color: 0x2c3545, 
        roughness: 0.8 
    });
    const suelo = new THREE.Mesh(sueloGeo, sueloMat);
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    scene.add(suelo);

    // Grid visual del suelo del vídeo
    const gridHelper = new THREE.GridHelper(50, 50, 0x4f5d73, 0x3a4659);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Paredes perimetrales oscuras
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x151a24, roughness: 0.9 });
    const wallGeo = new THREE.PlaneGeometry(50, 12);

    const pTrasera = new THREE.Mesh(wallGeo, wallMat);
    pTrasera.position.set(0, 6, -25);
    scene.add(pTrasera);

    const pIzquierda = new THREE.Mesh(wallGeo, wallMat);
    pIzquierda.position.set(-25, 6, 0);
    pIzquierda.rotation.y = Math.PI / 2;
    scene.add(pIzquierda);
}

export function normalizarModelo(root, tamanoObjetivo) {
    root.traverse((hijo) => {
        if (hijo.isMesh) {
            hijo.castShadow = true;
            hijo.receiveShadow = true;
        }
    });
    const caja = new THREE.Box3().setFromObject(root);
    const tamano = new THREE.Vector3();
    caja.getSize(tamano);
    const dimensionMayor = Math.max(tamano.x, tamano.y, tamano.z) || 1;
    const escala = tamanoObjetivo / dimensionMayor;
    root.scale.setScalar(escala);

    const cajaEscalada = new THREE.Box3().setFromObject(root);
    const centro = new THREE.Vector3();
    cajaEscalada.getCenter(centro);

    root.position.x -= centro.x;
    root.position.z -= centro.z;
    root.position.y -= cajaEscalada.min.y;

    return root;
}

function onWindowResize() {
    width = container.clientWidth;
    height = container.clientHeight;
    renderer.setSize(width, height);
}