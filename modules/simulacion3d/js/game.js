import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { scene, renderer, normalizarModelo } from './escena3d.js';

let camara, controles;
let raycaster;
let mouse = new THREE.Vector2(0, 0); // Centro de la pantalla para la retícula

// State Machine del Juego (Como en el vídeo)
let estadoJugador = {
    itemEnMano: null,       // Qué objeto lleva ('producto', 'caja_sellada', null)
    tipoProducto: null,    // Color/forma del producto recolectado
    puntos: 0,
    productosProcesados: 0,
    selladas: 0,
    apiladas: 0,
    errores: 0,
    tiempo: 0
};

// Referencias de Entidades Interactuables en el espacio
let objetosInteractuables = [];
let mesaRecepcion, mesaEmpaque, estanteriaRecibo;
let cajaActualMesa = { objeto3D: null, productosDentro: 0, maxProductos: 2, sellada: false };
let slotEstanteriaVerde = null;

// Control de Teclas de Movimiento
let teclas = { w: false, a: false, s: false, d: false };
let velocidad = new THREE.Vector3();
let direccion = new THREE.Vector3();
let reloj = new THREE.Clock();

export function inicializarJuego() {
    // Configurar cámara en modo Primera Persona
    camara = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camara.position.set(0, 2.5, 5);

    controles = new PointerLockControls(camara, document.body);
    
    const pantallaBloqueo = document.getElementById('pantalla-bloqueo');
    const btnComenzar = document.getElementById('btn-comenzar');
    
    btnComenzar.addEventListener('click', () => {
        controles.lock();
    });
    controles.addEventListener('lock', () => {
        pantallaBloqueo.style.display = 'none';
    });
    controles.addEventListener('unlock', () => {
        pantallaBloqueo.style.display = 'flex';
    });

    // ── CORREGIDO: la API nueva de PointerLockControls ya no tiene
    // getObject() — ahora controla la cámara directamente, así que se
    // agrega la cámara misma a la escena, no un envoltorio. ──
    scene.add(camara);
    raycaster = new THREE.Raycaster();

    configurarMapeoTeclado();
    construirMundoInteractivo();
    iniciarContadorTiempo();
}

function configurarMapeoTeclado() {
    window.addEventListener('keydown', (e) => {
        if(e.key.toLowerCase() === 'w') teclas.w = true;
        if(e.key.toLowerCase() === 'a') teclas.a = true;
        if(e.key.toLowerCase() === 's') teclas.s = true;
        if(e.key.toLowerCase() === 'd') teclas.d = true;
        
        // Mecánica de Sellar Caja con la tecla [E]
        if(e.key.toLowerCase() === 'e') {
            intentarSellarCajaMesa();
        }
    });

    window.addEventListener('keyup', (e) => {
        if(e.key.toLowerCase() === 'w') teclas.w = false;
        if(e.key.toLowerCase() === 'a') teclas.a = false;
        if(e.key.toLowerCase() === 's') teclas.s = false;
        if(e.key.toLowerCase() === 'd') teclas.d = false;
    });

    // Acción de Clic principal para interactuar / recoger / colocar
    window.addEventListener('click', () => {
        if (controles.isLocked) ejecutarAccionInteractiva();
    });
}

function construirMundoInteractivo() {
    // 1. Mesa de Recepción (Contenedor de esferas/cilindros del vídeo)
    const mesaRecGeo = new THREE.BoxGeometry(3, 1, 1.5);
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.5 });
    mesaRecepcion = new THREE.Mesh(mesaRecGeo, mesaMat);
    mesaRecepcion.position.set(-4, 0.5, -2);
    mesaRecepcion.castShadow = true; mesaRecepcion.receiveShadow = true;
    scene.add(mesaRecepcion);

    // Spwawn inicial de productos de prueba en recepción (colores como el vídeo)
    generarProductosEnRecepcion();

    // 2. Mesa de Empaque (Donde se colocan las cajas de cartón vacías)
    mesaEmpaque = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1.5), mesaMat);
    mesaEmpaque.position.set(1, 0.5, -2);
    mesaEmpaque.castShadow = true; mesaEmpaque.receiveShadow = true;
    scene.add(mesaEmpaque);

    // Instanciar Caja Vacía inicial lista para recibir items
    crearNuevaCajaEnMesa();

    // 3. Estantería de almacenamiento (Meta Final)
    const estGeo = new THREE.Group();
    const estructuraMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, metalness: 0.6 });
    
    // Postes verticales de la estantería
    const posteGeo = new THREE.BoxGeometry(0.1, 4, 0.1);
    for(let x of [-1.5, 1.5]) {
        for(let z of [-0.6, 0.6]) {
            const p = new THREE.Mesh(posteGeo, estructuraMat);
            p.position.set(x, 2, z);
            estGeo.add(p);
        }
    }
    // Baldas/Repisas
    const repisaGeo = new THREE.BoxGeometry(3.1, 0.08, 1.2);
    for(let y of [1.2, 2.4, 3.6]) {
        const r = new THREE.Mesh(repisaGeo, estructuraMat);
        r.position.y = y;
        estGeo.add(r);
    }
    estGeo.position.set(4, 0, 2);
    scene.add(estGeo);

    // 4. Slot de Objetivo Verde translúcido (Indicador visual del vídeo)
    const slotGeo = new THREE.BoxGeometry(0.8, 0.6, 0.8);
    const slotMat = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.35,
        wireframe: false 
    });
    slotEstanteriaVerde = new THREE.Mesh(slotGeo, slotMat);
    slotEstanteriaVerde.position.set(3.5, 1.5, 2); // Ubicado sobre la balda 1
    slotEstanteriaVerde.name = "target_slot";
    scene.add(slotEstanteriaVerde);
    objetosInteractuables.push(slotEstanteriaVerde);

    actualizarHUDTexto("Recoge un producto de recepcion (clic) y llevalo a una caja.");
}

function generarProductosEnRecepcion() {
    const colores = [0xffffff, 0x3182ce, 0xdd6b20, 0x38a169];
    const posicionesX = [-4.8, -4.2, -3.6, -3.0];
    
    colores.forEach((col, i) => {
        const prodGeo = (i % 2 === 0) ? new THREE.SphereGeometry(0.22, 32, 32) : new THREE.CylinderGeometry(0.2, 0.2, 0.4, 32);
        const prodMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 });
        const producto = new THREE.Mesh(prodGeo, prodMat);
        producto.position.set(posicionesX[i], 1.2, -2);
        producto.name = "producto_" + col;
        producto.castShadow = true;
        scene.add(producto);
        objetosInteractuables.push(producto);
    });
}

function crearNuevaCajaEnMesa() {
    const cajaG = new THREE.Group();
    const cartonMat = new THREE.MeshStandardMaterial({ color: 0xc69063, roughness: 0.8 }); // Color kraft carton
    
    // Base e infraestructura de la caja abierta
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), cartonMat);
    base.position.y = 0.025;
    cajaG.add(base);

    const paredGeo = new THREE.BoxGeometry(0.05, 0.5, 0.9);
    const p1 = new THREE.Mesh(paredGeo, cartonMat); p1.position.set(-0.45, 0.25, 0); cajaG.add(p1);
    const p2 = new THREE.Mesh(paredGeo, cartonMat); p2.position.set(0.45, 0.25, 0); cajaG.add(p2);
    
    cajaG.position.set(0.5, 1, -2);
    cajaG.name = "caja_empaque";
    scene.add(cajaG);
    
    cajaActualMesa.objeto3D = cajaG;
    cajaActualMesa.productosDentro = 0;
    cajaActualMesa.sellada = false;
    
    objetosInteractuables.push(cajaG);
}

function ejecutarAccionInteractiva() {
    // Configurar raycaster desde el centro de la cámara en primera persona
    raycaster.setFromCamera(mouse, camara);
    const colisiones = raycaster.intersectObjects(objetosInteractuables, true);

    if (colisiones.length > 0) {
        let objetivo = colisiones[0].object;
        
        // Encontrar ancestro directo con nombre si está en un grupo
        while (objetivo.parent && !objetivo.name) {
            objetivo = objetivo.parent;
        }

        // CASO 1: Recoger Producto Libre de la Recepción
        if (objetivo.name.startsWith("producto_") && estadoJugador.itemEnMano === null) {
            estadoJugador.itemEnMano = 'producto';
            estadoJugador.tipoProducto = objetivo.name;
            scene.remove(objetivo);
            
            // Eliminar de los interactuables temporalmente mientras esté en la mano
            objetosInteractuables = objetosInteractuables.filter(o => o !== objetivo);
            
            estadoJugador.productosProcesados++;
            document.getElementById('val-productos').textContent = estadoJugador.productosProcesados;
            
            actualizarHUDTexto("Lleva el producto a una caja abierta y haz clic para empacar.");
            return;
        }

        // CASO 2: Colocar Producto dentro de la Caja Abierta en la mesa
        if (objetivo.name === "caja_empaque" && estadoJugador.itemEnMano === 'producto') {
            if (!cajaActualMesa.sellada && cajaActualMesa.productosDentro < cajaActualMesa.maxProductos) {
                cajaActualMesa.productosDentro++;
                estadoJugador.itemEnMano = null;

                // Crear un indicador visual del producto dentro de la caja
                const miniatura = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshStandardMaterial({color: 0x718096}));
                miniatura.position.set((cajaActualMesa.productosDentro === 1) ? -0.2 : 0.2, 0.2, 0);
                cajaActualMesa.objeto3D.add(miniatura);

                if (cajaActualMesa.productosDentro === cajaActualMesa.maxProductos) {
                    actualizarHUDTexto("Hay una caja lista. Apunta a ella y pulsa [E] para sellarla.");
                } else {
                    actualizarHUDTexto(`Producto empacado (${cajaActualMesa.productosDentro}/2). Recoge más material.`);
                }
            }
            return;
        }

        // CASO 3: Agarrar la Caja que ya ha sido Sellada
        if (objetivo.name === "caja_empaque" && cajaActualMesa.sellada && estadoJugador.itemEnMano === null) {
            estadoJugador.itemEnMano = 'caja_sellada';
            scene.remove(cajaActualMesa.objeto3D);
            objetosInteractuables = objetosInteractuables.filter(o => o !== cajaActualMesa.objeto3D);
            
            actualizarHUDTexto("Caja sellada en mano. Apilala en la estanteria verde.");
            return;
        }

        // CASO 4: Colocar la Caja Sellada en el Slot Verde (Meta del juego)
        if (objetivo.name === "target_slot" && estadoJugador.itemEnMano === 'caja_sellada') {
            // Recrear caja fija en el estante permanentemente
            const cajaFinal = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshStandardMaterial({color: 0x9c4221}));
            cajaFinal.position.copy(slotEstanteriaVerde.position);
            scene.add(cajaFinal);

            // Desactivar el slot verde completado
            scene.remove(slotEstanteriaVerde);
            objetosInteractuables = objetosInteractuables.filter(o => o !== slotEstanteriaVerde);

            // Actualizar métricas finales del HUD
            estadoJugador.itemEnMano = null;
            estadoJugador.apiladas++;
            estadoJugador.puntos += 50;

            document.getElementById('val-apiladas').textContent = `${estadoJugador.apiladas}/3`;
            document.getElementById('val-puntos').textContent = estadoJugador.puntos;

            actualizarHUDTexto("¡Caja apilada en el hueco correcto! Simulación completada con éxito. +50 pts");
            
            // Ciclo continuo opcional: Respawnear otra caja para bucle infinito si se requiere
            setTimeout(() => { crearNuevaCajaEnMesa(); }, 1500);
            return;
        }
    } else {
        // Validación de penalización de errores por clics en zonas inválidas según contexto
        if (estadoJugador.itemEnMano === 'producto') {
            registrarErrorLogistico("¡Error! Apunta a una caja abierta para empacar el producto.");
        }
    }
}

function intentarSellarCajaMesa() {
    if (cajaActualMesa.objeto3D && cajaActualMesa.productosDentro === cajaActualMesa.maxProductos && !cajaActualMesa.sellada) {
        cajaActualMesa.sellada = true;
        estadoJugador.selladas++;
        document.getElementById('val-selladas').textContent = estadoJugador.selladas;

        // Añadir línea visual simulando la cinta de sellado (igual que tu código base)
        const cintaGeo = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.04, 0.15), new THREE.MeshStandardMaterial({color: 0x2d3748}));
        cintaGeo.position.set(0, 0.51, 0);
        cajaActualMesa.objeto3D.add(cintaGeo);

        actualizarHUDTexto("Caja sellada correctamente. Recogela (clic) y apilala.");
    } else if (cajaActualMesa.productosDentro < cajaActualMesa.maxProductos) {
        registrarErrorLogistico("La caja no está llena para poder sellarse.");
    }
}

function registrarErrorLogistico(mensaje) {
    estadoJugador.errores++;
    document.getElementById('val-errores').textContent = estadoJugador.errores;
    actualizarHUDTexto(mensaje);
}

function actualizarHUDTexto(txt) {
    document.getElementById('hud-guia').textContent = txt;
}

function iniciarContadorTiempo() {
    setInterval(() => {
        if(controles.isLocked) {
            estadoJugador.tiempo++;
            const mins = Math.floor(estadoJugador.tiempo / 60);
            const secs = estadoJugador.tiempo % 60;
            document.getElementById('val-tiempo').textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }
    }, 1000);
}

// Bucle de físicas y actualizaciones cinemáticas para la traslación de la cámara (WASD)
export function actualizarFisicasMundo(dt) {
    if (!controles.isLocked) return;

    // Reducción / Fricción lineal
    velocidad.x -= velocidad.x * 10.0 * dt;
    velocidad.z -= velocidad.z * 10.0 * dt;

    direccion.z = Number(teclas.w) - Number(teclas.s);
    direccion.x = Number(teclas.d) - Number(teclas.a);
    direccion.normalize();

    if (teclas.w || teclas.s) velocidad.z -= direccion.z * 40.0 * dt;
    if (teclas.a || teclas.d) velocidad.x -= direccion.x * 40.0 * dt;

    controles.moveRight(-velocidad.x * dt);
    controles.moveForward(-velocidad.z * dt);
}

export function renderizarCicloJuego() {
    const delta = Math.min(reloj.getDelta(), 0.05);
    actualizarFisicasMundo(delta);
    renderer.render(scene, camara);
}