import { inicializarBase3D, renderer } from './escena3d.js';
import { inicializarJuego, renderizarCicloJuego } from './game.js';

// Inicializar ciclo de la aplicación al cargar la ventana de Chrome/Navegador
window.addEventListener('DOMContentLoaded', () => {
    // 1. Configurar la escena base 3D, luces y arquitectura del almacén
    inicializarBase3D();

    // 2. Cargar las lógicas interactivas de mecánicas del juego, HUD y PointerLock
    inicializarJuego();

    // 3. Encender el Loop de Renderizado Nativo de Three.js de manera óptima
    renderer.setAnimationLoop(buclePrincipalApp);
});

function buclePrincipalApp() {
    // Llama al procesador lógico y actualizador de fotogramas por segundo del juego
    renderizarCicloJuego();
}