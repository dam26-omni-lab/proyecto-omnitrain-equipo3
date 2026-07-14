import * as THREE from 'three';
import { GLTFLoader } from './gltfloader.js';

const RUTA_RECURSOS = new URL('../texturas/', import.meta.url).href;

// ==========================================
// Variables globales — escena base (sin cambios)
// ==========================================
let scene, renderer, container;
let perspectiveCamera, activeCamera;
let vistas = []; // { nombre, camera }
let indiceVista = 0;
let width, height;
let clock;

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// Plantillas de modelos cargados (se llenan en construirAlmacen)
let plantillasCajas = [];
let contadorCajaPlantilla = 0;

// ==========================================
// Variables globales — modo práctica en primera persona
// ==========================================
const FP_CONFIG = {
    alturaOjos: 1.7,
    velocidadCaminar: 3.6,
    velocidadCorrer: 5.6,
    sensibilidadMouse: 0.0022,
    radioJugador: 0.4,
    alcanceInteraccion: 2.6,
};

let fpCamera = null;
let pointerLocked = false;
let yaw = 0;
let pitch = 0;
const jugadorPos = new THREE.Vector3(0, FP_CONFIG.alturaOjos, 14);
const teclas = {};
const raycasterInteraccion = new THREE.Raycaster();
const colisionadores = []; // { min: {x,z}, max: {x,z} } — solo plano XZ

const interactuables = []; // { mesh, tipo, data }
let objetivoInteractuable = null;
let itemEnMano = null;      // { tipo: 'producto'|'caja', data, mesh }
let cajaEnProceso = null;   // referencia al registro (interactuable) de la caja abierta en la mesa

const tweensActivos = [];
const emisivosOriginales = new WeakMap();
const coloresLineaOriginales = new WeakMap();

const metrics = {
    inicio: null,
    correctas: 0,
    incorrectas: 0,
};

// Catálogo de productos y cajas de práctica
const TIPOS_PRODUCTO = [
    { id: 'electronica', nombre: 'Electrónica', color: 0x3b82f6, tamano: 'pequeña', forma: 'caja', dims: [0.32, 0.28, 0.32] },
    { id: 'fragil', nombre: 'Vajilla frágil', color: 0x38bdf8, tamano: 'mediana', forma: 'cilindro', dims: [0.2, 0.38, 0.2] },
    { id: 'ropa', nombre: 'Ropa', color: 0xf472b6, tamano: 'grande', forma: 'caja', dims: [0.46, 0.3, 0.4] },
    { id: 'libros', nombre: 'Libros', color: 0xa16207, tamano: 'pequeña', forma: 'caja', dims: [0.38, 0.24, 0.3] },
];

const TIPOS_CAJA = [
    { id: 'chica', nombre: 'Caja chica', tamano: 'pequeña', dims: [0.5, 0.4, 0.5] },
    { id: 'mediana', nombre: 'Caja mediana', tamano: 'mediana', dims: [0.65, 0.5, 0.65] },
    { id: 'grande', nombre: 'Caja grande', tamano: 'grande', dims: [0.85, 0.6, 0.85] },
];

const ZONA_RECEPCION = new THREE.Vector3(-9, 0, 6);
const ESTACION_PRACTICA = new THREE.Vector3(1.5, 0, 6);
const ESTANTE_PRACTICA = new THREE.Vector3(1.5, 0, -3);

const slotsEstantePractica = []; // { posicion: Vector3, ocupado, mesh, index }

init();

async function init() {
    container = document.getElementById('contenedor-3d');
    width = container.clientWidth;
    height = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b2436);
    scene.fog = new THREE.Fog(0x1b2436, 30, 65);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    crearCamaras();
    crearLuces();
    crearSueloYParedes();
    actualizarHUDVista();

    crearZonaRecepcion();
    crearEstacionPractica();
    crearEstantePractica();

    configurarControlesPrimeraPersona();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    renderer.setAnimationLoop(animate);

    await construirAlmacen();
    crearEstacionEmbalaje();
    iniciarCicloEmbalaje();
}

// ==========================================
// Cámaras: 1 perspectiva libre + varias ortográficas + primera persona
// ==========================================
function crearCamaras() {
    const aspect = width / height;

    perspectiveCamera = new THREE.PerspectiveCamera(55, aspect, 0.1, 200);
    perspectiveCamera.position.set(-16, 12, 16);
    perspectiveCamera.lookAt(0, 3, 0);

    vistas.push({ nombre: 'Perspectiva libre', camera: perspectiveCamera });

    crearVistaOrtografica('Frontal (ortográfica)', [0, 7, 24], [0, 4, 0], 20);
    crearVistaOrtografica('Lateral (ortográfica)', [28, 18, 0], [0, 3, 0], 22);
    crearVistaOrtografica('Superior (ortográfica)', [0, 30, 0.01], [0, 0, 0], 26, [0, 0, -1]);
    crearVistaOrtografica('Isométrica (ortográfica)', [17, 15, 17], [0, 3, 0], 22);
    // Vista fija sobre la estación de empaquetado, útil para ver el proceso de cerca
    crearVistaOrtografica('Estación de embalaje', [-3, 9, 18], [-3, 1, 10], 10);

    // Vista en primera persona: cámara libre controlada por el jugador (WASD + mouse)
    fpCamera = new THREE.PerspectiveCamera(70, aspect, 0.05, 200);
    fpCamera.position.copy(jugadorPos);
    fpCamera.rotation.order = 'YXZ';
    vistas.push({ nombre: 'Primera persona (práctica)', camera: fpCamera });

    activeCamera = vistas[indiceVista].camera;
}

function crearVistaOrtografica(nombre, posicion, objetivo, frustumSize, up = [0, 1, 0]) {
    const aspect = width / height;
    const halfH = frustumSize / 2;
    const halfW = halfH * aspect;

    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 200);
    camera.up.set(up[0], up[1], up[2]);
    camera.position.set(posicion[0], posicion[1], posicion[2]);
    camera.lookAt(objetivo[0], objetivo[1], objetivo[2]);
    camera.userData.frustumSize = frustumSize;

    vistas.push({ nombre, camera });
}

function onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (key === 'c') {
        if (event.repeat) return;
        const saliaDeFP = activeCamera === fpCamera;
        indiceVista = (indiceVista + 1) % vistas.length;
        activeCamera = vistas[indiceVista].camera;
        actualizarHUDVista();
        if (saliaDeFP && pointerLocked) document.exitPointerLock();
        sincronizarHUDPrimeraPersona();
        return;
    }

    if (activeCamera !== fpCamera) return; // el resto de teclas solo aplican en modo práctica

    if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'shift') {
        teclas[key] = true;
        return;
    }
    if (key === 'e') {
        if (!event.repeat) manejarInteraccionE();
        return;
    }
    if (key === 'q') {
        if (!event.repeat) soltarItemEnMano();
        return;
    }
}

function onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'shift') {
        teclas[key] = false;
    }
}

function actualizarHUDVista() {
    const etiqueta = document.getElementById('hud-vista');
    if (etiqueta) {
        etiqueta.textContent = vistas[indiceVista].nombre;
    }
}

function actualizarHUDEmbalaje(texto) {
    const etiqueta = document.getElementById('hud-embalaje');
    if (etiqueta) {
        etiqueta.textContent = texto;
    }
}

// ==========================================
// Luces
// ==========================================
function crearLuces() {
    const ambient = new THREE.AmbientLight(0xfff2e0, 0.55);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x33291f, 0.5);
    scene.add(hemi);

    const direccional = new THREE.DirectionalLight(0xffe9c7, 1.1);
    direccional.position.set(-10, 16, 8);
    direccional.target.position.set(0, 0, 0);
    direccional.castShadow = true;
    direccional.shadow.mapSize.set(2048, 2048);
    direccional.shadow.camera.left = -20;
    direccional.shadow.camera.right = 20;
    direccional.shadow.camera.top = 20;
    direccional.shadow.camera.bottom = -20;
    scene.add(direccional);
    scene.add(direccional.target);

    const puntual = new THREE.PointLight(0xff9955, 1.1, 20);
    puntual.position.set(0, 6, 4);
    scene.add(puntual);

    // Luz cenital blanca dedicada a la estación de empaquetado, para que
    // el proceso de envoltura/sellado se vea claro y destacado.
    const luzEstacion = new THREE.PointLight(0xffffff, 1.4, 12);
    luzEstacion.position.set(-3, 5, 10);
    luzEstacion.castShadow = true;
    scene.add(luzEstacion);

    // Luz cálida sobre la zona de práctica del jugador
    const luzPractica = new THREE.PointLight(0xffffff, 1.2, 14);
    luzPractica.position.set(1.5, 5, 3);
    scene.add(luzPractica);
}

// ==========================================
// Suelo y paredes (almacén)
// ==========================================
function crearSueloYParedes() {
    const floorTexture = textureLoader.load(RUTA_RECURSOS + 'pisofabrica.png');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(6, 6);

    const wallTexture = textureLoader.load(RUTA_RECURSOS + 'paredof.png');
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(5, 2);

    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 26),
        new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.85 })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    scene.add(suelo);

    const wallHeight = 8;
    const wallGeometry = new THREE.PlaneGeometry(26, wallHeight);

    const wallBack = new THREE.Mesh(wallGeometry, new THREE.MeshStandardMaterial({
        map: wallTexture, roughness: 0.9, side: THREE.DoubleSide,
    }));
    wallBack.position.set(0, wallHeight / 2, -13);
    scene.add(wallBack);

    const wallLeft = new THREE.Mesh(wallGeometry, new THREE.MeshStandardMaterial({
        map: wallTexture, roughness: 0.9, side: THREE.DoubleSide,
    }));
    wallLeft.position.set(-13, wallHeight / 2, 0);
    wallLeft.rotation.y = Math.PI / 2;
    scene.add(wallLeft);

    const wallRight = new THREE.Mesh(wallGeometry, new THREE.MeshStandardMaterial({
        map: wallTexture.clone(), roughness: 0.9, side: THREE.DoubleSide,
    }));
    wallRight.material.map.needsUpdate = true;
    wallRight.position.set(13, wallHeight / 2, 0);
    wallRight.rotation.y = -Math.PI / 2;
    scene.add(wallRight);

    // Límites del salón como colisionadores (evita que el jugador atraviese los muros)
    const grosor = 0.4;
    colisionadores.push({ min: { x: -13 - grosor, z: -13 - grosor }, max: { x: 13 + grosor, z: -13 } });
    colisionadores.push({ min: { x: -13 - grosor, z: -13 }, max: { x: -13, z: 13 } });
    colisionadores.push({ min: { x: 13, z: -13 }, max: { x: 13 + grosor, z: 13 } });
}

// ==========================================
// Carga y normalización de modelos GLB
// ==========================================
function cargarModelo(nombreArchivo, fabricaFallback) {
    return loader.loadAsync(RUTA_RECURSOS + nombreArchivo)
        .then((gltf) => gltf.scene)
        .catch((error) => {
            console.warn(`No se pudo cargar "${nombreArchivo}" (¿existe en ${RUTA_RECURSOS}?). Uso geometría de reemplazo.`, error);
            return fabricaFallback();
        });
}

// ── Geometría de reemplazo, usada solo si el .glb correspondiente no carga ──
function crearEstantePlaceholder(colorMadera = 0x5a4632) {
    const grupo = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: colorMadera, roughness: 0.85 });

    [-0.42, 0.42].forEach((x) => {
        const poste = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.4), material);
        poste.position.set(x, 0.8, 0);
        grupo.add(poste);
    });
    [0.15, 0.8, 1.45].forEach((y) => {
        const repisa = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.4), material);
        repisa.position.set(0, y, 0);
        grupo.add(repisa);
    });

    return grupo;
}

function crearCajaPlaceholder(color = 0xC8A882) {
    const grupo = new THREE.Group();
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
    );
    grupo.add(mesh);
    return grupo;
}

// Escala el modelo para que su dimensión mayor mida "tamanoObjetivo"
// y alinea su base en y = 0 (local), para poder apoyarlo sobre el piso o el anaquel.
function normalizarModelo(root, tamanoObjetivo) {
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
    const tamanoFinal = new THREE.Vector3();
    cajaEscalada.getSize(tamanoFinal);
    const centro = new THREE.Vector3();
    cajaEscalada.getCenter(centro);

    // Centramos en X/Z y apoyamos la base en y = 0
    root.position.x -= centro.x;
    root.position.z -= centro.z;
    root.position.y -= cajaEscalada.min.y;

    return tamanoFinal;
}

async function construirAlmacen() {
    const [estEstandar, estExpres, estFragil, cajaEstandar, cajaExpres, cajaFragil, cajaInternacional] =
        await Promise.all([
            cargarModelo('estante-estandar.glb', () => crearEstantePlaceholder(0x5a4632)),
            cargarModelo('estante-expres.glb', () => crearEstantePlaceholder(0x3d4a5c)),
            cargarModelo('estante-fragil.glb', () => crearEstantePlaceholder(0x6b3d3d)),
            cargarModelo('cajaestandar.glb', () => crearCajaPlaceholder(0xC8A882)),
            cargarModelo('cajaexpres.glb', () => crearCajaPlaceholder(0xf2c14e)),
            cargarModelo('cajafragil.glb', () => crearCajaPlaceholder(0x8ecae6)),
            cargarModelo('cajainternacional.glb', () => crearCajaPlaceholder(0x94a89a)),
        ]);

    const plantillasEstantes = [
        { root: estEstandar, tamano: normalizarModelo(estEstandar, 2.6) },
        { root: estExpres, tamano: normalizarModelo(estExpres, 2.6) },
        { root: estFragil, tamano: normalizarModelo(estFragil, 2.6) },
    ];

    plantillasCajas = [
        { root: cajaEstandar, tamano: normalizarModelo(cajaEstandar, 0.6) },
        { root: cajaExpres, tamano: normalizarModelo(cajaExpres, 0.6) },
        { root: cajaFragil, tamano: normalizarModelo(cajaFragil, 0.6) },
        { root: cajaInternacional, tamano: normalizarModelo(cajaInternacional, 0.6) },
    ];

    let contadorEstante = 0;
    let contadorCaja = 0;

    function siguienteEstante() {
        const plantilla = plantillasEstantes[contadorEstante % plantillasEstantes.length];
        contadorEstante++;
        return plantilla;
    }

    function siguienteCaja() {
        const plantilla = plantillasCajas[contadorCaja % plantillasCajas.length];
        contadorCaja++;
        return plantilla;
    }

    // Crea un anaquel con cajas apiladas encima, dentro de un grupo
    // para que las cajas hereden automáticamente la rotación del anaquel.
    function crearAnaquelConCajas(x, z, rotacionY) {
        const plantillaEstante = siguienteEstante();
        const grupo = new THREE.Group();
        grupo.position.set(x, 0, z);
        grupo.rotation.y = rotacionY;

        const estante = plantillaEstante.root.clone(true);
        grupo.add(estante);

        const alturaEstante = plantillaEstante.tamano.y;
        const anchoEstante = plantillaEstante.tamano.x;

        // Fila de cajas apoyada en la repisa superior del anaquel
        const espacioCaja = 0.68;
        const cantidadCajas = Math.max(1, Math.min(3, Math.floor(anchoEstante / espacioCaja)));
        const inicioX = -((cantidadCajas - 1) * espacioCaja) / 2;

        for (let i = 0; i < cantidadCajas; i++) {
            const plantillaCaja = siguienteCaja();
            const caja = plantillaCaja.root.clone(true);
            caja.position.set(inicioX + i * espacioCaja, alturaEstante, 0);
            grupo.add(caja);
        }

        scene.add(grupo);

        // Registrar el anaquel como colisionador para el modo primera persona
        const cajaColision = new THREE.Box3().setFromObject(grupo);
        colisionadores.push({
            min: { x: cajaColision.min.x, z: cajaColision.min.z },
            max: { x: cajaColision.max.x, z: cajaColision.max.z },
        });
    }

    // ── Distribución organizada del almacén: anaqueles a lo largo
    // de las 3 paredes, dejando el centro libre como pasillo ──
    const posicionesFila = [-8.4, -2.8, 2.8, 8.4];
    const inset = 1.5; // distancia desde la pared hacia el interior

    // Pared trasera (z negativa): anaqueles mirando hacia el pasillo
    posicionesFila.forEach((x) => crearAnaquelConCajas(x, -13 + inset, 0));

    // Pared izquierda (x negativa)
    posicionesFila.forEach((z) => crearAnaquelConCajas(-13 + inset, z, Math.PI / 2));

    // Pared derecha (x positiva)
    posicionesFila.forEach((z) => crearAnaquelConCajas(13 - inset, z, -Math.PI / 2));

    // ── Cajas en espera, apiladas en el piso cerca del pasillo central ──
    const filasPiso = [-2, 0, 2];
    const columnasPiso = [3, 4.7, 6.4];
    filasPiso.forEach((z) => {
        columnasPiso.forEach((x) => {
            const plantillaCaja = siguienteCaja();
            const caja = plantillaCaja.root.clone(true);
            caja.position.set(x, 0, z);
            caja.rotation.y = Math.random() * 0.3 - 0.15;
            scene.add(caja);
        });
    });

    ocultarCargando();
}

function ocultarCargando() {
    const cargando = document.getElementById('hud-cargando');
    if (cargando) cargando.style.display = 'none';
}

function siguientePlantillaCaja() {
    if (plantillasCajas.length === 0) return null;
    const plantilla = plantillasCajas[contadorCajaPlantilla % plantillasCajas.length];
    contadorCajaPlantilla++;
    return plantilla;
}

// ==========================================
// ESTACIÓN DE EMPAQUETADO AUTOMÁTICA (demostrativa, sin cambios de comportamiento)
// Zona sobre el lado abierto (+Z) del almacén: aquí llegan cajas sueltas,
// se envuelven con film, se sellan con cinta y se apilan como producto listo.
// ==========================================

const EMBALAJE = {
    spawn: new THREE.Vector3(-9, 0, 12),
    estacion: new THREE.Vector3(-3, 0, 10),
    salida: new THREE.Vector3(3, 0, 10),
    alturaMesa: 0.9,
    duracionEntrada: 2.2,
    duracionEnvoltura: 1.6,
    duracionSellado: 1.0,
    duracionSalida: 2.0,
    intervaloSpawnMs: 4200,
    maxApiladas: 9, // 3 columnas x 3 de alto, se reciclan al llegar al límite
};

let cajasEnProceso = [];
let estacionOcupada = false;
let contadorApiladas = 0;
let slotsSalidaOcupados = {}; // índice de slot -> item apilado (para reciclar)
let cajasEmpacadasTotal = 0;

function crearEstacionEmbalaje() {
    const grupoEstacion = new THREE.Group();
    grupoEstacion.position.copy(EMBALAJE.estacion);
    scene.add(grupoEstacion);

    // Mesa de empaquetado
    const mesa = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, EMBALAJE.alturaMesa, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x3d4a5c, roughness: 0.6, metalness: 0.3 })
    );
    mesa.position.y = EMBALAJE.alturaMesa / 2;
    mesa.castShadow = true;
    mesa.receiveShadow = true;
    grupoEstacion.add(mesa);

    // Patas simples (detalle visual)
    const patasGeo = new THREE.CylinderGeometry(0.05, 0.05, EMBALAJE.alturaMesa, 8);
    const patasMat = new THREE.MeshStandardMaterial({ color: 0x22262e });
    [[-1.15, 0.55], [1.15, 0.55], [-1.15, -0.55], [1.15, -0.55]].forEach(([x, z]) => {
        const pata = new THREE.Mesh(patasGeo, patasMat);
        pata.position.set(x, EMBALAJE.alturaMesa / 2, z);
        grupoEstacion.add(pata);
    });

    // Arco/gantry sobre la mesa, de donde "cae" el film (detalle visual)
    const arcoMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.4, metalness: 0.5 });
    const columnaGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8);
    const travesanoGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8);

    const colIzq = new THREE.Mesh(columnaGeo, arcoMat);
    colIzq.position.set(-1.3, 1.15 + EMBALAJE.alturaMesa, 0);
    grupoEstacion.add(colIzq);

    const colDer = new THREE.Mesh(columnaGeo, arcoMat);
    colDer.position.set(1.3, 1.15 + EMBALAJE.alturaMesa, 0);
    grupoEstacion.add(colDer);

    const travesano = new THREE.Mesh(travesanoGeo, arcoMat);
    travesano.rotation.z = Math.PI / 2;
    travesano.position.set(0, 2.3 + EMBALAJE.alturaMesa, 0);
    grupoEstacion.add(travesano);

    // Letrero de la estación
    crearLetrero('EMPAQUETADO', EMBALAJE.estacion.clone().add(new THREE.Vector3(0, 3.0, -1.2)));
    crearLetrero('SALIDA', EMBALAJE.salida.clone().add(new THREE.Vector3(0, 3.0, -1.2)));

    // Colisionador de la mesa demostrativa
    const box = new THREE.Box3().setFromObject(mesa);
    box.translate(EMBALAJE.estacion);
    colisionadores.push({ min: { x: box.min.x, z: box.min.z }, max: { x: box.max.x, z: box.max.z } });
}

function crearLetrero(texto, posicion, colorTexto = '#f2c14e', colorFondo = '#12161f') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorFondo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = colorTexto;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    ctx.fillStyle = colorTexto;
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, canvas.width / 2, canvas.height / 2);

    const textura = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: textura, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.2, 0.55, 1);
    sprite.position.copy(posicion);
    scene.add(sprite);
    return sprite;
}

// Crea el grupo visual de una caja "en proceso": modelo real + film + cinta
function crearItemEmbalaje() {
    const plantilla = siguientePlantillaCaja();
    if (!plantilla) return null;

    const grupo = new THREE.Group();
    const caja = plantilla.root.clone(true);
    grupo.add(caja);

    const tamano = plantilla.tamano;

    // Film de envoltura: caja semitransparente ligeramente más grande,
    // que "crece" en Y durante el envolvimiento simulando el film subiendo.
    const filmMat = new THREE.MeshStandardMaterial({
        color: 0xf5f7fa,
        transparent: true,
        opacity: 0.35,
        roughness: 0.15,
        metalness: 0.1,
        side: THREE.DoubleSide,
    });
    const film = new THREE.Mesh(
        new THREE.BoxGeometry(tamano.x * 1.08, tamano.y * 1.08, tamano.z * 1.08),
        filmMat
    );
    film.position.y = tamano.y / 2;
    film.scale.y = 0.001;
    film.visible = false;
    grupo.add(film);

    // Cinta de sellado: franja delgada oscura que crece a lo ancho.
    const cintaMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 });
    const cinta = new THREE.Mesh(
        new THREE.BoxGeometry(tamano.x * 1.1, tamano.y * 0.16, tamano.z * 1.12),
        cintaMat
    );
    cinta.position.y = tamano.y * 0.55;
    cinta.scale.x = 0.001;
    cinta.visible = false;
    grupo.add(cinta);

    scene.add(grupo);

    return {
        grupo,
        film,
        cinta,
        tamano,
        estado: 'entrando',
        tiempoEstado: 0,
        origen: EMBALAJE.spawn.clone(),
        destino: new THREE.Vector3(EMBALAJE.estacion.x, EMBALAJE.alturaMesa, EMBALAJE.estacion.z),
        slot: -1,
    };
}

function calcularSlotSalida(indice) {
    const columnas = 3;
    const col = indice % columnas;
    const fila = Math.floor(indice / columnas) % 3;
    return new THREE.Vector3(
        EMBALAJE.salida.x + col * 0.75,
        fila * 0.42,
        EMBALAJE.salida.z
    );
}

function intentarSpawnCaja() {
    if (estacionOcupada) return;
    if (plantillasCajas.length === 0) return; // aún no cargan los modelos

    const item = crearItemEmbalaje();
    if (!item) return;

    item.grupo.position.copy(item.origen);
    estacionOcupada = true;
    cajasEnProceso.push(item);
}

function iniciarCicloEmbalaje() {
    intentarSpawnCaja();
    setInterval(intentarSpawnCaja, EMBALAJE.intervaloSpawnMs);
}

// Curva suave (ease-in-out) para movimientos más naturales
function suavizar(t) {
    return t * t * (3 - 2 * t);
}

function actualizarEmbalaje(dt) {
    for (let i = cajasEnProceso.length - 1; i >= 0; i--) {
        const item = cajasEnProceso[i];
        item.tiempoEstado += dt;

        switch (item.estado) {
            case 'entrando': {
                const t = Math.min(item.tiempoEstado / EMBALAJE.duracionEntrada, 1);
                const tSuave = suavizar(t);
                item.grupo.position.lerpVectors(item.origen, item.destino, tSuave);
                item.grupo.position.y += Math.sin(t * Math.PI) * 0.5; // arco de "cargado"
                item.grupo.rotation.y = t * Math.PI * 0.5;

                if (t >= 1) {
                    item.grupo.position.copy(item.destino);
                    item.estado = 'envolviendo';
                    item.tiempoEstado = 0;
                    item.film.visible = true;
                    actualizarHUDEmbalaje('Envolviendo caja…');
                }
                break;
            }

            case 'envolviendo': {
                const t = Math.min(item.tiempoEstado / EMBALAJE.duracionEnvoltura, 1);
                item.film.scale.y = Math.max(0.001, suavizar(t));
                item.grupo.rotation.y += dt * 5.5; // gira como en una envolvedora real

                if (t >= 1) {
                    item.grupo.rotation.y = 0;
                    item.estado = 'sellando';
                    item.tiempoEstado = 0;
                    item.cinta.visible = true;
                    actualizarHUDEmbalaje('Sellando con cinta…');
                }
                break;
            }

            case 'sellando': {
                const t = Math.min(item.tiempoEstado / EMBALAJE.duracionSellado, 1);
                item.cinta.scale.x = Math.max(0.001, suavizar(t));

                if (t >= 1) {
                    item.slot = contadorApiladas % EMBALAJE.maxApiladas;
                    contadorApiladas++;
                    cajasEmpacadasTotal++;

                    const slotPos = calcularSlotSalida(item.slot);
                    item.origen = item.grupo.position.clone();
                    item.destino = new THREE.Vector3(slotPos.x, slotPos.y, slotPos.z);

                    // Si el slot de destino ya tenía una caja, se desvanece para reciclarlo
                    const anterior = slotsSalidaOcupados[item.slot];
                    if (anterior) {
                        anterior.estado = 'desvaneciendo';
                        anterior.tiempoEstado = 0;
                    }
                    slotsSalidaOcupados[item.slot] = item;

                    item.estado = 'saliendo';
                    item.tiempoEstado = 0;
                    estacionOcupada = false; // libera la mesa para la siguiente caja
                    actualizarHUDEmbalaje(`Cajas empacadas: ${cajasEmpacadasTotal}`);
                }
                break;
            }

            case 'saliendo': {
                const t = Math.min(item.tiempoEstado / EMBALAJE.duracionSalida, 1);
                const tSuave = suavizar(t);
                item.grupo.position.lerpVectors(item.origen, item.destino, tSuave);
                item.grupo.position.y += Math.sin(t * Math.PI) * 0.4;
                item.grupo.rotation.y += dt * 1.2;

                if (t >= 1) {
                    item.grupo.position.copy(item.destino);
                    item.grupo.rotation.y = 0;
                    item.estado = 'apilada';
                    item.tiempoEstado = 0;
                }
                break;
            }

            case 'apilada':
                // Permanece quieta hasta que su slot sea reciclado (ver 'sellando')
                break;

            case 'desvaneciendo': {
                const duracion = 0.8;
                const t = Math.min(item.tiempoEstado / duracion, 1);
                item.grupo.traverse((hijo) => {
                    if (hijo.isMesh) {
                        hijo.material.transparent = true;
                        hijo.material.opacity = 1 - t;
                    }
                });
                item.grupo.position.y -= dt * 0.6;

                if (t >= 1) {
                    scene.remove(item.grupo);
                    item.grupo.traverse((hijo) => {
                        if (hijo.isMesh) {
                            hijo.geometry.dispose();
                            if (hijo.material.map) hijo.material.map.dispose();
                            hijo.material.dispose();
                        }
                    });
                    cajasEnProceso.splice(cajasEnProceso.indexOf(item), 1);
                }
                break;
            }
        }
    }
}

// ==========================================
// MODO PRÁCTICA — PRIMERA PERSONA
// Zona de recepción → mesa de embalaje interactiva → estante de práctica.
// El objetivo del alumno es: recoger un producto, meterlo en una caja del
// tamaño correcto, sellarla con cinta y ubicarla en un espacio del estante.
// ==========================================

function crearMarcadorPiso(centro, radio, colorHex) {
    const geo = new THREE.CircleGeometry(radio, 32);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const marcador = new THREE.Mesh(geo, mat);
    marcador.rotation.x = -Math.PI / 2;
    marcador.position.set(centro.x, 0.02, centro.z);
    scene.add(marcador);
    return marcador;
}

// ── Zona de recepción: 4 puntos con productos variados para recoger ──
function crearZonaRecepcion() {
    crearMarcadorPiso(ZONA_RECEPCION, 2.6, 0xf2c14e);
    crearLetrero('RECEPCIÓN', ZONA_RECEPCION.clone().add(new THREE.Vector3(0, 2.6, -1.6)));

    const offsets = [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]];
    TIPOS_PRODUCTO.forEach((tipo, i) => {
        const [ox, oz] = offsets[i];
        spawnProducto(tipo, ZONA_RECEPCION.x + ox, ZONA_RECEPCION.z + oz);
    });
}

function crearMeshProducto(tipo) {
    const [dx, dy, dz] = tipo.dims;
    const material = new THREE.MeshStandardMaterial({ color: tipo.color, roughness: 0.6 });
    let mesh;
    if (tipo.forma === 'cilindro') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(dx, dx, dy, 16), material);
    } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(dx, dy, dz), material);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

function spawnProducto(tipo, x, z) {
    const mesh = crearMeshProducto(tipo);
    mesh.position.set(x, tipo.dims[1] / 2, z);
    scene.add(mesh);

    const registro = { mesh, tipo: 'producto', data: { ...tipo, posOrigen: new THREE.Vector3(x, tipo.dims[1] / 2, z) } };
    interactuables.push(registro);
    return registro;
}

// Reemplaza (con una breve espera) un producto que el jugador se llevó,
// para que la zona de recepción nunca se quede vacía durante la práctica.
function reponerProducto(tipoId, x, z) {
    setTimeout(() => {
        const tipo = TIPOS_PRODUCTO.find((t) => t.id === tipoId);
        if (tipo) spawnProducto(tipo, x, z);
    }, 3000);
}

// ── Estación de embalaje interactiva (mesa de práctica del jugador) ──
function crearEstacionPractica() {
    const grupo = new THREE.Group();
    grupo.position.copy(ESTACION_PRACTICA);
    scene.add(grupo);

    const mesa = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.85, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x3d4a5c, roughness: 0.6, metalness: 0.3 })
    );
    mesa.position.y = 0.425;
    mesa.castShadow = true;
    mesa.receiveShadow = true;
    grupo.add(mesa);

    // Rollo de cinta (prop interactivo: sella la caja abierta)
    const cinta = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.06, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.4 })
    );
    cinta.rotation.x = Math.PI / 2;
    cinta.position.set(-0.95, 0.95, 0.35);
    cinta.castShadow = true;
    grupo.add(cinta);
    interactuables.push({ mesh: cinta, tipo: 'cinta', data: {} });

    // Rollo de papel (decorativo)
    const papel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9 })
    );
    papel.rotation.z = Math.PI / 2;
    papel.position.set(-0.95, 1.0, -0.35);
    grupo.add(papel);

    // Plástico burbuja (decorativo)
    const burbuja = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16),
        new THREE.MeshStandardMaterial({ color: 0xbfe8f5, roughness: 0.5, transparent: true, opacity: 0.75 })
    );
    burbuja.rotation.z = Math.PI / 2;
    burbuja.position.set(-0.6, 1.0, -0.35);
    grupo.add(burbuja);

    crearLetrero('EMBALAJE — PRÁCTICA', ESTACION_PRACTICA.clone().add(new THREE.Vector3(0, 2.6, -1.4)), '#22c55e');

    // Tres cajas vacías, una por cada tamaño disponible
    const offsetsX = [0.85, 0, -0.3];
    TIPOS_CAJA.forEach((tipoCaja, i) => {
        crearCajaVacia(tipoCaja, ESTACION_PRACTICA.x + [0.9, 0.05, -0.85][i], ESTACION_PRACTICA.z + 0.35, 0.85);
    });

    const box = new THREE.Box3().setFromObject(mesa);
    box.translate(ESTACION_PRACTICA);
    colisionadores.push({ min: { x: box.min.x, z: box.min.z }, max: { x: box.max.x, z: box.max.z } });
}

function crearCajaVacia(tipoCaja, x, z, alturaMesa) {
    const [dx, dy, dz] = tipoCaja.dims;
    const grupo = new THREE.Group();
    grupo.position.set(x, alturaMesa, z);
    scene.add(grupo);

    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(dx, dy, dz),
        new THREE.MeshStandardMaterial({ color: 0xC8A882, roughness: 0.85 })
    );
    mesh.position.y = dy / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grupo.add(mesh);

    const registro = {
        mesh: grupo,
        tipo: 'caja',
        data: {
            tipoCaja,
            estado: 'vacia', // vacia -> abierta -> sellada
            contenido: null,
            correcto: null,
            slotOrigen: { x, z, alturaMesa },
            indicador: null,
        },
    };
    interactuables.push(registro);
    return registro;
}

// ── Estante de práctica: estructura simple con 6 espacios (2 filas x 3) ──
function crearEstantePractica() {
    const grupo = new THREE.Group();
    grupo.position.copy(ESTANTE_PRACTICA);
    scene.add(grupo);

    const materialMadera = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.85 });
    const anchoTotal = 3.6;
    const alturaRepisas = [0.85, 1.65];

    // Postes
    [-anchoTotal / 2, anchoTotal / 2].forEach((x) => {
        const poste = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.5), materialMadera);
        poste.position.set(x, 1.05, 0);
        poste.castShadow = true;
        poste.receiveShadow = true;
        grupo.add(poste);
    });

    // Repisas
    alturaRepisas.forEach((y) => {
        const repisa = new THREE.Mesh(new THREE.BoxGeometry(anchoTotal, 0.06, 0.5), materialMadera);
        repisa.position.set(0, y, 0);
        repisa.castShadow = true;
        repisa.receiveShadow = true;
        grupo.add(repisa);
    });

    crearLetrero('ESTANTE — GUARDAR CAJAS', ESTANTE_PRACTICA.clone().add(new THREE.Vector3(0, 2.6, -0.3)), '#7c3aed');

    // 6 marcadores fantasma (2 filas x 3 columnas)
    const columnasX = [-1.1, 0, 1.1];
    let indice = 0;
    alturaRepisas.forEach((y) => {
        columnasX.forEach((x) => {
            const posicionMundo = ESTANTE_PRACTICA.clone().add(new THREE.Vector3(x, y + 0.32, 0));
            const geo = new THREE.BoxGeometry(0.85, 0.6, 0.4);
            const edges = new THREE.EdgesGeometry(geo);
            const linea = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x9ca3af }));
            linea.position.copy(posicionMundo);
            scene.add(linea);

            const registro = {
                mesh: linea,
                tipo: 'estante_slot',
                data: { index: indice, ocupado: false, posicion: posicionMundo },
            };
            interactuables.push(registro);
            slotsEstantePractica.push(registro);
            indice++;
        });
    });

    const box = new THREE.Box3().setFromObject(grupo);
    colisionadores.push({ min: { x: box.min.x, z: box.min.z - 0.3 }, max: { x: box.max.x, z: box.max.z + 0.3 } });
}

// ── Tweens genéricos (para animar sin motor de física) ──
function crearTween({ duracion, onUpdate, onComplete }) {
    tweensActivos.push({ t: 0, duracion, onUpdate, onComplete });
}

function actualizarTweens(dt) {
    for (let i = tweensActivos.length - 1; i >= 0; i--) {
        const tw = tweensActivos[i];
        tw.t += dt;
        const p = Math.min(tw.t / tw.duracion, 1);
        tw.onUpdate(suavizar(p), p);
        if (p >= 1) {
            if (tw.onComplete) tw.onComplete();
            tweensActivos.splice(i, 1);
        }
    }
}

// ── Resaltado de objetos interactuables ──
function resaltarObjeto(mesh) {
    mesh.traverse((h) => {
        if (h.isMesh && h.material) {
            const mats = Array.isArray(h.material) ? h.material : [h.material];
            mats.forEach((m) => {
                if (!m.emissive) return;
                if (!emisivosOriginales.has(m)) emisivosOriginales.set(m, m.emissive.getHex());
                m.emissive.setHex(0xf2c14e);
                m.emissiveIntensity = 0.7;
            });
        } else if (h.isLineSegments && h.material) {
            if (!coloresLineaOriginales.has(h.material)) coloresLineaOriginales.set(h.material, h.material.color.getHex());
            h.material.color.setHex(0xf2c14e);
        }
    });
}

function desresaltarObjeto(mesh) {
    mesh.traverse((h) => {
        if (h.isMesh && h.material) {
            const mats = Array.isArray(h.material) ? h.material : [h.material];
            mats.forEach((m) => {
                if (m.emissive && emisivosOriginales.has(m)) {
                    m.emissive.setHex(emisivosOriginales.get(m));
                    m.emissiveIntensity = 1;
                }
            });
        } else if (h.isLineSegments && h.material && coloresLineaOriginales.has(h.material)) {
            h.material.color.setHex(coloresLineaOriginales.get(h.material));
        }
    });
}

// ── Control de puntero (pointer lock) y movimiento en primera persona ──
function configurarControlesPrimeraPersona() {
    document.addEventListener('pointerlockchange', () => {
        pointerLocked = document.pointerLockElement === container;
        sincronizarHUDPrimeraPersona();
    });

    container.addEventListener('click', () => {
        if (activeCamera === fpCamera && !pointerLocked) {
            container.requestPointerLock();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!pointerLocked) return;
        yaw -= e.movementX * FP_CONFIG.sensibilidadMouse;
        pitch -= e.movementY * FP_CONFIG.sensibilidadMouse;
        pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
        fpCamera.rotation.set(pitch, yaw, 0, 'YXZ');
    });

    sincronizarHUDPrimeraPersona();
}

function sincronizarHUDPrimeraPersona() {
    const overlay = document.getElementById('hud-fp-overlay');
    if (overlay) overlay.classList.toggle('activo', activeCamera === fpCamera);

    const clickLock = document.getElementById('hud-click-lock');
    if (clickLock) clickLock.classList.toggle('visible', activeCamera === fpCamera && !pointerLocked);

    if (activeCamera === fpCamera && metrics.inicio === null) {
        metrics.inicio = Date.now();
    }
}

function colisionaConAlgo(pos) {
    for (const c of colisionadores) {
        if (
            pos.x > c.min.x - FP_CONFIG.radioJugador && pos.x < c.max.x + FP_CONFIG.radioJugador &&
            pos.z > c.min.z - FP_CONFIG.radioJugador && pos.z < c.max.z + FP_CONFIG.radioJugador
        ) {
            return true;
        }
    }
    return false;
}

function actualizarMovimientoJugador(dt) {
    if (!pointerLocked) return;

    const velocidad = (teclas.shift ? FP_CONFIG.velocidadCorrer : FP_CONFIG.velocidadCaminar) * dt;

    const dirFrente = new THREE.Vector3();
    fpCamera.getWorldDirection(dirFrente);
    dirFrente.y = 0;
    dirFrente.normalize();
    const dirDerecha = new THREE.Vector3().crossVectors(dirFrente, fpCamera.up).normalize();

    const movimiento = new THREE.Vector3();
    if (teclas.w) movimiento.add(dirFrente);
    if (teclas.s) movimiento.sub(dirFrente);
    if (teclas.d) movimiento.add(dirDerecha);
    if (teclas.a) movimiento.sub(dirDerecha);
    if (movimiento.lengthSq() > 0) movimiento.normalize().multiplyScalar(velocidad);
    else return;

    const nuevaPos = jugadorPos.clone().add(movimiento);
    nuevaPos.x = THREE.MathUtils.clamp(nuevaPos.x, -12.4, 12.4);
    nuevaPos.z = THREE.MathUtils.clamp(nuevaPos.z, -12.4, 12.4);

    if (!colisionaConAlgo(nuevaPos)) {
        jugadorPos.copy(nuevaPos);
    } else {
        const soloX = jugadorPos.clone();
        soloX.x = nuevaPos.x;
        const soloZ = jugadorPos.clone();
        soloZ.z = nuevaPos.z;
        if (!colisionaConAlgo(soloX)) jugadorPos.x = soloX.x;
        else if (!colisionaConAlgo(soloZ)) jugadorPos.z = soloZ.z;
    }

    fpCamera.position.set(jugadorPos.x, FP_CONFIG.alturaOjos, jugadorPos.z);
}

// ── Detección de objetivo (raycast desde el centro de la pantalla) ──
function esAncestro(posible, objetivo) {
    let actual = objetivo;
    while (actual) {
        if (actual === posible) return true;
        actual = actual.parent;
    }
    return false;
}

function actualizarInteraccion() {
    if (!pointerLocked) {
        if (objetivoInteractuable) desresaltarObjeto(objetivoInteractuable.mesh);
        objetivoInteractuable = null;
        actualizarHUDPrompt(null);
        return;
    }

    raycasterInteraccion.setFromCamera({ x: 0, y: 0 }, fpCamera);
    const meshes = interactuables.map((o) => o.mesh);
    const hits = raycasterInteraccion.intersectObjects(meshes, true);

    let nuevoObjetivo = null;
    if (hits.length && hits[0].distance <= FP_CONFIG.alcanceInteraccion) {
        nuevoObjetivo = interactuables.find((o) => esAncestro(o.mesh, hits[0].object));
    }

    if (objetivoInteractuable && objetivoInteractuable !== nuevoObjetivo) {
        desresaltarObjeto(objetivoInteractuable.mesh);
    }
    if (nuevoObjetivo && nuevoObjetivo !== objetivoInteractuable) {
        resaltarObjeto(nuevoObjetivo.mesh);
    }
    objetivoInteractuable = nuevoObjetivo;
    actualizarHUDPrompt(objetivoInteractuable);
}

function actualizarHUDPrompt(obj) {
    const el = document.getElementById('hud-prompt');
    const crosshair = document.getElementById('hud-crosshair');
    if (!el) return;

    if (!obj) {
        el.textContent = '';
        el.classList.remove('visible');
        if (crosshair) crosshair.classList.remove('activo');
        return;
    }

    let texto = '';
    if (!itemEnMano) {
        if (obj.tipo === 'producto') texto = `Presiona E para recoger — ${obj.data.nombre}`;
        else if (obj.tipo === 'caja' && obj.data.estado === 'sellada') texto = 'Presiona E para levantar la caja sellada';
        else if (obj.tipo === 'caja') texto = 'Esta caja aún no está lista';
        else texto = '';
    } else if (itemEnMano.tipo === 'producto') {
        if (obj.tipo === 'caja' && obj.data.estado === 'vacia') texto = `Presiona E para colocar ${itemEnMano.data.nombre} en la caja`;
        else texto = 'Necesitas una caja vacía';
    } else if (itemEnMano.tipo === 'caja') {
        if (obj.tipo === 'cinta' && cajaEnProceso && cajaEnProceso.data.estado === 'abierta') texto = 'Presiona E para sellar con cinta';
        else if (obj.tipo === 'estante_slot' && !obj.data.ocupado) texto = 'Presiona E para colocar la caja en el estante';
        else if (obj.tipo === 'estante_slot' && obj.data.ocupado) texto = 'Ese espacio ya está ocupado';
        else texto = '';
    }

    if (texto) {
        el.textContent = texto;
        el.classList.add('visible');
        if (crosshair) crosshair.classList.add('activo');
    } else {
        el.textContent = '';
        el.classList.remove('visible');
        if (crosshair) crosshair.classList.remove('activo');
    }
}

// ── Acciones del jugador ──
function manejarInteraccionE() {
    if (!objetivoInteractuable) return;
    const obj = objetivoInteractuable;

    if (!itemEnMano) {
        if (obj.tipo === 'producto') recogerProducto(obj);
        else if (obj.tipo === 'caja' && obj.data.estado === 'sellada') recogerCaja(obj);
        return;
    }

    if (itemEnMano.tipo === 'producto') {
        if (obj.tipo === 'caja' && obj.data.estado === 'vacia') colocarProductoEnCaja(obj);
        return;
    }

    if (itemEnMano.tipo === 'caja') {
        if (obj.tipo === 'cinta' && cajaEnProceso && cajaEnProceso.data.estado === 'abierta') sellarCaja(cajaEnProceso);
        else if (obj.tipo === 'estante_slot') colocarCajaEnEstante(obj);
    }
}

function recogerProducto(obj) {
    interactuables.splice(interactuables.indexOf(obj), 1);
    desresaltarObjeto(obj.mesh);
    scene.remove(obj.mesh);

    itemEnMano = { tipo: 'producto', data: obj.data };
    actualizarHUDHeld();
    reponerProducto(obj.data.id, obj.data.posOrigen.x, obj.data.posOrigen.z);
    objetivoInteractuable = null;
}

function colocarProductoEnCaja(obj) {
    const producto = itemEnMano.data;
    const correcto = producto.tamano === obj.data.tipoCaja.tamano;

    obj.data.estado = 'abierta';
    obj.data.contenido = producto;
    obj.data.correcto = correcto;
    cajaEnProceso = obj;
    itemEnMano = null;
    actualizarHUDHeld();

    // Animación breve: el producto "cae" dentro de la caja y desaparece
    const mini = crearMeshProducto(producto);
    mini.scale.setScalar(0.9);
    const mundo = new THREE.Vector3();
    obj.mesh.getWorldPosition(mundo);
    mini.position.copy(mundo).add(new THREE.Vector3(0, obj.data.tipoCaja.dims[1] * 0.6, 0));
    scene.add(mini);

    crearTween({
        duracion: 0.45,
        onUpdate: (p) => {
            mini.position.y = mundo.y + obj.data.tipoCaja.dims[1] * (0.6 - 0.6 * p);
            mini.scale.setScalar(0.9 * (1 - p * 0.7));
        },
        onComplete: () => {
            scene.remove(mini);
            mini.geometry.dispose();
            mini.material.dispose();
        },
    });

    mostrarFlash(correcto ? 'correcto' : 'incorrecto');
}

function sellarCaja(obj) {
    const [dx, dy, dz] = obj.data.tipoCaja.dims;
    const cintaMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 });
    const cinta = new THREE.Mesh(new THREE.BoxGeometry(dx * 1.05, dy * 0.18, dz * 1.08), cintaMat);
    cinta.position.y = dy * 0.55;
    cinta.scale.x = 0.001;
    obj.mesh.add(cinta);

    crearTween({
        duracion: 0.5,
        onUpdate: (p) => { cinta.scale.x = Math.max(0.001, p); },
        onComplete: () => {
            obj.data.estado = 'sellada';
            const colorTexto = obj.data.correcto ? '#22c55e' : '#e53e3e';
            const texto = obj.data.correcto ? '✓ OK' : '✗ REVISAR';
            const mundo = new THREE.Vector3();
            obj.mesh.getWorldPosition(mundo);
            obj.data.indicador = crearLetrero(texto, mundo.clone().add(new THREE.Vector3(0, dy + 0.4, 0)), colorTexto);
            cajaEnProceso = null;
            actualizarHUDPrompt(objetivoInteractuable);
        },
    });
}

function recogerCaja(obj) {
    interactuables.splice(interactuables.indexOf(obj), 1);
    desresaltarObjeto(obj.mesh);

    itemEnMano = { tipo: 'caja', data: obj.data, mesh: obj.mesh, registroOriginal: obj };
    actualizarHUDHeld();
    objetivoInteractuable = null;

    // Repone una caja vacía nueva del mismo tamaño en el mismo lugar de la mesa
    const { x, z, alturaMesa } = obj.data.slotOrigen;
    setTimeout(() => crearCajaVacia(obj.data.tipoCaja, x, z, alturaMesa), 200);
}

function colocarCajaEnEstante(obj) {
    if (obj.data.ocupado) {
        mostrarFlash('incorrecto');
        return;
    }

    obj.data.ocupado = true;
    obj.mesh.material.color.setHex(0x22c55e);

    const cajaMesh = itemEnMano.mesh;
    const origen = new THREE.Vector3();
    cajaMesh.getWorldPosition(origen);
    const destino = obj.data.posicion.clone();

    itemEnMano.data.correcto ? metrics.correctas++ : metrics.incorrectas++;
    itemEnMano = null;
    actualizarHUDHeld();
    actualizarHUDMetricas();

    crearTween({
        duracion: 0.9,
        onUpdate: (p, raw) => {
            cajaMesh.position.lerpVectors(origen, destino, p);
            cajaMesh.position.y += Math.sin(raw * Math.PI) * 0.35;
        },
        onComplete: () => {
            cajaMesh.position.copy(destino);
        },
    });
}

function soltarItemEnMano() {
    if (!itemEnMano) return;

    if (itemEnMano.tipo === 'producto') {
        // El producto se descarta; ya fue repuesto en su punto de origen al recogerlo
        itemEnMano = null;
        actualizarHUDHeld();
        return;
    }

    if (itemEnMano.tipo === 'caja') {
        // Soltar una caja sellada sin colocarla en el estante cuenta como desperdicio
        const mesh = itemEnMano.mesh;
        const origen = new THREE.Vector3();
        mesh.getWorldPosition(origen);
        metrics.incorrectas++;
        actualizarHUDMetricas();
        mostrarFlash('incorrecto');

        crearTween({
            duracion: 0.4,
            onUpdate: (p) => {
                mesh.position.y = origen.y * (1 - p);
                mesh.traverse((h) => { if (h.isMesh) { h.material.transparent = true; h.material.opacity = 1 - p; } });
            },
            onComplete: () => {
                scene.remove(mesh);
                mesh.traverse((h) => { if (h.isMesh) { h.geometry.dispose(); h.material.dispose(); } });
            },
        });

        itemEnMano = null;
        actualizarHUDHeld();
    }
}

// ── HUD: ítem en mano, flashes y métricas ──
function actualizarHUDHeld() {
    const el = document.getElementById('hud-held');
    if (!el) return;
    if (!itemEnMano) {
        el.textContent = '';
        el.classList.remove('visible');
        return;
    }
    const nombre = itemEnMano.tipo === 'producto' ? itemEnMano.data.nombre : itemEnMano.data.tipoCaja.nombre;
    el.textContent = `En mano: ${nombre}`;
    el.classList.add('visible');
}

let timeoutFlash = null;
function mostrarFlash(tipo) {
    const el = document.getElementById('hud-flash');
    if (!el) return;
    el.classList.remove('correcto', 'incorrecto');
    void el.offsetWidth; // fuerza reflow para poder reiniciar la animación
    el.classList.add(tipo);
    if (timeoutFlash) clearTimeout(timeoutFlash);
    timeoutFlash = setTimeout(() => el.classList.remove('correcto', 'incorrecto'), 450);
}

function actualizarHUDMetricas() {
    const total = metrics.correctas + metrics.incorrectas;
    const eficiencia = total > 0 ? Math.round((metrics.correctas / total) * 100) : 100;

    const elCorrectas = document.getElementById('hud-correctas');
    const elIncorrectas = document.getElementById('hud-incorrectas');
    const elEficiencia = document.getElementById('hud-eficiencia');
    if (elCorrectas) elCorrectas.textContent = metrics.correctas;
    if (elIncorrectas) elIncorrectas.textContent = metrics.incorrectas;
    if (elEficiencia) elEficiencia.textContent = eficiencia + '%';
}

function actualizarHUDTiempo() {
    const el = document.getElementById('hud-tiempo');
    if (!el || metrics.inicio === null) return;
    const segundos = Math.floor((Date.now() - metrics.inicio) / 1000);
    const mm = String(Math.floor(segundos / 60)).padStart(2, '0');
    const ss = String(segundos % 60).padStart(2, '0');
    el.textContent = `${mm}:${ss}`;
}

// ==========================================
// Animación / render loop
// ==========================================
function animate() {
    const dt = Math.min(clock.getDelta(), 0.05); // limita saltos si la pestaña pierde foco
    actualizarEmbalaje(dt);
    actualizarTweens(dt);

    if (activeCamera === fpCamera) {
        actualizarMovimientoJugador(dt);
        actualizarInteraccion();
        actualizarHUDTiempo();
    }

    renderer.render(scene, activeCamera);
}

// ==========================================
// Resize
// ==========================================
function onWindowResize() {
    width = container.clientWidth;
    height = container.clientHeight;
    const aspect = width / height;

    perspectiveCamera.aspect = aspect;
    perspectiveCamera.updateProjectionMatrix();

    fpCamera.aspect = aspect;
    fpCamera.updateProjectionMatrix();

    vistas.forEach(({ camera }) => {
        if (camera.isOrthographicCamera) {
            const halfH = camera.userData.frustumSize / 2;
            const halfW = halfH * aspect;
            camera.left = -halfW;
            camera.right = halfW;
            camera.top = halfH;
            camera.bottom = -halfH;
            camera.updateProjectionMatrix();
        }
    });

    renderer.setSize(width, height);
}