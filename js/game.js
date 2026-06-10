class EscenaPrincipal extends Phaser.Scene {

    constructor() {
        super({ key: 'EscenaPrincipal' });
    }

    preload() {
        this.load.image('prueba', '../images/prueba.jpeg');
    }

    create() {

        const imagen = this.add.image(400, 200, 'prueba');

        imagen.setScale(0.3);

        const texto = this.add.text(
            400,
            450,
            '¡Phaser funciona!',
            {
                fontSize: '36px',
                fontFamily: 'Arial',
                color: '#00ff00',
                fontStyle: 'bold'
            }
        );

        texto.setOrigin(0.5);
        
        this.tweens.add({
            targets: texto,
            alpha: 0.5,
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
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: EscenaPrincipal
};

new Phaser.Game(config);