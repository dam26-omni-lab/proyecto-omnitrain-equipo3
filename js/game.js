class EscenaPrincipal extends Phaser.Scene {

    constructor() {
        super({ key: 'EscenaPrincipal' });
    }

    preload() {
        this.load.image('fondo', '../../images/imagenfondo.png');
        this.load.image('trabajador', '../../images/trabajadorAlmacen1.png');
    }

    create() {

        // ── Fondo: cubre todo el lienzo (800x600) ──
        const fondo = this.add.image(0, 0, 'fondo').setOrigin(0, 0);
        fondo.setDisplaySize(this.scale.width, this.scale.height);

        // ── Trabajador: imagen movible ──
        const trabajador = this.add.image(400, 450, 'trabajador');
        trabajador.setScale(0.5); // ajusta este valor según el tamaño real de tu imagen

        trabajador.setInteractive();
        this.input.setDraggable(trabajador);

        // Efecto visual mientras se arrastra
        this.input.on('dragstart', (pointer, gameObject) => {
            gameObject.setTint(0xcccccc);
        });

        // Mover el objeto siguiendo el cursor/dedo, sin salirse del lienzo
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = Phaser.Math.Clamp(dragX, 0, this.scale.width);
            gameObject.y = Phaser.Math.Clamp(dragY, 0, this.scale.height);
        });

        this.input.on('dragend', (pointer, gameObject) => {
            gameObject.clearTint();
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: EscenaPrincipal
};

const game = new Phaser.Game(config);

// ── Pantalla completa ──
function toggleFullscreenGame() {
    if (!game.scale.isFullscreen) {
        game.scale.startFullscreen();
    } else {
        game.scale.stopFullscreen();
    }
}

// Actualiza el texto/ícono del botón según el estado actual
game.scale.on('enterfullscreen', () => {
    const btn = document.getElementById('btnFullscreen');
    if (btn) btn.innerHTML = '<i class="bi bi-fullscreen-exit"></i> Salir de pantalla completa';
});

game.scale.on('leavefullscreen', () => {
    const btn = document.getElementById('btnFullscreen');
    if (btn) btn.innerHTML = '<i class="bi bi-arrows-fullscreen"></i> Pantalla completa';
});