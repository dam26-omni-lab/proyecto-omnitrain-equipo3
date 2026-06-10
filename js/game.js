class EscenaPrincipal extends Phaser.Scene {

    constructor() {
        super({ key: 'EscenaPrincipal' });
    }

    preload() {
        this.load.image('prueba', 'images/prueba.jpeg');
    }

    create() {

        // Agregar imagen centrada
        const imagen = this.add.image(400, 250, 'prueba');

        // Reducir tamaño
        imagen.setScale(0.3);

        // Efecto de movimiento continuo
        this.tweens.add({
            targets: imagen,
            y: 280,
            duration: 1500,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // Texto
        const texto = this.add.text(
            400,
            500,
            '¡Phaser funciona!',
            {
                fontSize: '40px',
                fontFamily: 'Arial',
                color: '#00ff00',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 6
            }
        );

        // Centrar el texto
        texto.setOrigin(0.5);

        // Efecto de zoom continuo
        this.tweens.add({
            targets: texto,
            scale: 1.2,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    scene: EscenaPrincipal
};

new Phaser.Game(config);