// ═══════════════════════════════════════════════════════════
//  CAPACITACIÓN DE ALMACÉN — Clasificación de paquetes
//  Menú interactivo + 3 niveles + control mouse y teclado
//  Fondo y sprites: imágenes reales (carga desde /images)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  PANTALLA COMPLETA
//  Usa el contenedor #game-container del HTML para que tanto
//  el canvas como el fondo ocupen toda la pantalla del navegador.
// ═══════════════════════════════════════════════════════════
function toggleFullscreen() {
  const contenedor = document.getElementById('game-container');
  if (!contenedor) return;

  const enPantallaCompleta = document.fullscreenElement || document.webkitFullscreenElement;

  if (!enPantallaCompleta) {
    if (contenedor.requestFullscreen) contenedor.requestFullscreen();
    else if (contenedor.webkitRequestFullscreen) contenedor.webkitRequestFullscreen();
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

const ANCHO = 900;
const ALTO  = 560;

// ── Paleta de marca ACE Logístico (tomada del logo) ──
const ACE = {
  navy:        0x0f345c, // azul marino — texto "ACE LOGÍSTICO"
  navyOscuro:  0x081b30, // navy más oscuro, para fondos y bordes
  navyClaro:   0x184468, // navy secundario, para paneles y botones
  cian:        0x0592b0, // cian — flecha/swoosh del logo
  cianClaro:   0x12c4d6  // cian brillante, para acentos/resaltados
};

const PALETA = {
  estanteria: ACE.navyClaro,
  banda:      ACE.navyOscuro,
  texto:      '#0f345c',
  hudFondo:   ACE.navy
};

// ── Tipos de paquete ──
const TIPOS_PAQUETE = {
  estandar: {
    nombre: 'Estándar',
    color: 0xb0b0b0,
    icono: '📦',
    sprite: 'gris'
  },
  express: {
    nombre: 'Express',
    color: 0x0056b3,
    icono: '⚡',
    sprite: 'azul'
  },
  fragil: {
    nombre: 'Frágil',
    color: 0xe53e3e,
    icono: '🍷',
    sprite: 'roja'
  },
  internacional: {
    nombre: 'Internacional',
    color: 0x22a559,
    icono: '🌐',
    sprite: 'verde'
  }
};
const CLAVES_TIPO = Object.keys(TIPOS_PAQUETE);

// ── Configuración de los 3 niveles ──
const NIVELES = [
  { numero: 1, nombre: 'Aprendiz',  velocidadBanda: 50, intervaloSpawn: 2600, tiempoTotal: 70,  vidasMax: 5 },
  { numero: 2, nombre: 'Operario',  velocidadBanda: 75, intervaloSpawn: 2000, tiempoTotal: 80,  vidasMax: 4 },
  { numero: 3, nombre: 'Experto',   velocidadBanda: 105, intervaloSpawn: 1500, tiempoTotal: 90,  vidasMax: 3 }
];

const FRASES_SUPERVISOR = {
  inicio: '¡Bienvenido a tu turno! Selecciona un paquete con el mouse o las flechas, y confirma la zona con clic o Enter.',
  errores: [
    'Recuerda revisar el ícono antes de clasificar — los frágiles van siempre en su zona especial.',
    'Vas con varios errores seguidos. Tómate un segundo extra para confirmar el tipo de paquete.',
    'Los envíos Express no pueden esperar — pero tampoco sirve clasificarlos mal. Calma y precisión.'
  ],
  buenRacha: '¡Excelente racha! Así se hace una clasificación profesional.'
};

// Estado compartido entre escenas (nivel elegido, mejor puntaje, etc.)
const ESTADO_GLOBAL = {
  nivelSeleccionado: 0 // índice en NIVELES
};

// ═══════════════════════════════════════════════════════════
//  ESCENA: SPLASH (logo ACE a pantalla completa antes del menú)
// ═══════════════════════════════════════════════════════════
class EscenaSplash extends Phaser.Scene {

  constructor() {
    super('EscenaSplash');
  }

  preload() {
    this.load.on('loaderror', (file) => {
      console.warn('No se pudo cargar:', file.key, '— continúa sin ese recurso.');
    });
    this.load.image('logoAce', '../../images/logoace1.jpeg');
  }

  create() {
    // Fondo navy sólido, a pantalla completa del canvas
    this.cameras.main.setBackgroundColor(ACE.navy);
    this.add.rectangle(ANCHO/2, ALTO/2, ANCHO, ALTO, ACE.navy);

    if (this.textures.exists('logoAce')) {
      const logo = this.add.image(ANCHO/2, ALTO/2 - 20, 'logoAce').setAlpha(0);

      // Escala el logo para que ocupe la mayor parte de la pantalla
      // manteniendo su proporción original (alta fidelidad, sin deformar).
      const margen = 0.72;
      const escala = Math.min((ANCHO * margen) / logo.width, (ALTO * margen) / logo.height);
      logo.setScale(escala);

      this.tweens.add({ targets: logo, alpha: 1, duration: 700, ease: 'Sine.easeOut' });
    } else {
      this.add.text(ANCHO/2, ALTO/2 - 20, 'ACE LOGÍSTICO', {
        fontFamily: 'Arial', fontSize: '40px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    const continuar = this.add.text(ANCHO/2, ALTO - 46, 'Toca la pantalla o pulsa una tecla para continuar', {
      fontFamily: 'Arial', fontSize: '13px', color: '#cfe3ee'
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: continuar, alpha: { from: 0.3, to: 1 }, duration: 900, yoyo: true, repeat: -1, delay: 700 });

    const avanzar = () => {
      if (this.scene.isActive()) this.scene.start('EscenaMenu');
    };

    this.input.once('pointerdown', avanzar);
    this.input.keyboard.once('keydown', avanzar);

    // Avance automático si nadie interactúa
    this.time.delayedCall(3200, avanzar);
  }
}

// ═══════════════════════════════════════════════════════════
//  ESCENA: MENÚ PRINCIPAL
// ═══════════════════════════════════════════════════════════
class EscenaMenu extends Phaser.Scene {

  constructor() {
    super('EscenaMenu');
  }

  preload() {
    this.load.on('loaderror', (file) => {
      console.warn('No se pudo cargar:', file.key, '— continúa sin ese recurso.');
    });
    this.load.image('fondoAlmacen', '../../images/imagenfondo.png');
  }

  create() {
    // Fondo
    if (this.textures.exists('fondoAlmacen')) {
      const fondo = this.add.image(ANCHO/2, ALTO/2, 'fondoAlmacen');
      const escala = Math.max(ANCHO/fondo.width, ALTO/fondo.height);
      fondo.setScale(escala).setTint(0x999999);
    } else {
      this.add.rectangle(ANCHO/2, ALTO/2, ANCHO, ALTO, ACE.navy);
    }
    this.add.rectangle(ANCHO/2, ALTO/2, ANCHO, ALTO, 0x000000, 0.45);

    // Título
    this.add.text(ANCHO/2, 90, '🏭 CAPACITACIÓN DE ALMACÉN', {
      fontFamily: 'Arial', fontSize: '34px', color: '#f3e9dc', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(ANCHO/2, 130, 'Clasificación de paquetes en banda transportadora', {
      fontFamily: 'Arial', fontSize: '15px', color: '#d8c9b8'
    }).setOrigin(0.5);

    // ── Selector de nivel ──
    this.add.text(ANCHO/2, 195, 'Selecciona tu nivel', {
      fontFamily: 'Arial', fontSize: '16px', color: '#FFD700', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.botonesNivel = [];
    const posicionesX = [ANCHO/2 - 230, ANCHO/2, ANCHO/2 + 230];

    NIVELES.forEach((nivel, i) => {
      const x = posicionesX[i];
      const seleccionado = i === ESTADO_GLOBAL.nivelSeleccionado;

      const caja = this.add.rectangle(x, 250, 200, 90,
        seleccionado ? ACE.cian : ACE.navyClaro, seleccionado ? 0.9 : 0.6)
        .setStrokeStyle(3, seleccionado ? 0xFFD700 : 0xf3e9dc)
        .setInteractive({ useHandCursor: true });

      this.add.text(x, 232, 'Nivel ' + nivel.numero, {
        fontFamily: 'Arial', fontSize: '16px', color: '#fff', fontStyle: 'bold'
      }).setOrigin(0.5);
      this.add.text(x, 256, nivel.nombre, {
        fontFamily: 'Arial', fontSize: '13px', color: '#f3e9dc'
      }).setOrigin(0.5);
      this.add.text(x, 278, nivel.tiempoTotal + 's · ' + nivel.vidasMax + ' vidas', {
        fontFamily: 'Arial', fontSize: '11px', color: '#bbb'
      }).setOrigin(0.5);

      caja.on('pointerdown', () => {
        ESTADO_GLOBAL.nivelSeleccionado = i;
        this.scene.restart();
      });

      this.botonesNivel.push(caja);
    });

    // ── Botones del menú ──
    this.crearBoton(ANCHO/2, 370, '▶  JUGAR', '#0592b0', () => {
      this.scene.start('EscenaAlmacen');
    });

    this.crearBoton(ANCHO/2, 430, '📋  INSTRUCCIONES', '#184468', () => {
      this.mostrarInstrucciones();
    });

    this.crearBoton(ANCHO/2, 490, '✕  SALIR', '#7a2e2e', () => {
      this.mostrarPantallaSalida();
    });

    // Botón de pantalla completa, esquina superior derecha
    const btnFullscreen = this.add.text(ANCHO - 20, 20, '⛶ Pantalla completa', {
      fontFamily: 'Arial', fontSize: '12px', color: '#fff',
      backgroundColor: '#184468', padding: { x: 10, y: 6 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    btnFullscreen.on('pointerdown', () => toggleFullscreen());
    btnFullscreen.on('pointerover', () => btnFullscreen.setScale(1.05));
    btnFullscreen.on('pointerout',  () => btnFullscreen.setScale(1));

    // Control de teclado para navegar el menú
    this.cursors = this.input.keyboard.createCursorKeys();
    this.teclasWASD = this.input.keyboard.addKeys('W,A,S,D,ENTER');

    this.input.keyboard.on('keydown-LEFT', () => this.moverSeleccionNivel(-1));
    this.input.keyboard.on('keydown-A', () => this.moverSeleccionNivel(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.moverSeleccionNivel(1));
    this.input.keyboard.on('keydown-D', () => this.moverSeleccionNivel(1));
    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('EscenaAlmacen'));
  }

  moverSeleccionNivel(direccion) {
    ESTADO_GLOBAL.nivelSeleccionado = Phaser.Math.Wrap(
      ESTADO_GLOBAL.nivelSeleccionado + direccion, 0, NIVELES.length
    );
    this.scene.restart();
  }

  crearBoton(x, y, texto, color, callback) {
    const boton = this.add.text(x, y, texto, {
      fontFamily: 'Arial', fontSize: '17px', color: '#fff', fontStyle: 'bold',
      backgroundColor: color, padding: { x: 28, y: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    boton.on('pointerover', () => boton.setScale(1.05));
    boton.on('pointerout',  () => boton.setScale(1));
    boton.on('pointerdown', callback);

    return boton;
  }

  mostrarInstrucciones() {
    const overlay = this.add.rectangle(ANCHO/2, ALTO/2, ANCHO, ALTO, 0x000000, 0.85).setInteractive();
    const panel = this.add.rectangle(ANCHO/2, ALTO/2, 620, 380, 0xfff8ec).setStrokeStyle(3, PALETA.estanteria);

    const titulo = this.add.text(ANCHO/2, ALTO/2 - 165, '📋 Instrucciones', {
      fontFamily: 'Arial', fontSize: '20px', color: PALETA.texto, fontStyle: 'bold'
    }).setOrigin(0.5);

    const texto = this.add.text(ANCHO/2, ALTO/2 - 40,
      '• Los paquetes avanzan por la banda transportadora.\n\n' +
      '• Con el MOUSE: haz clic en el paquete y luego en su zona.\n\n' +
      '• Con TECLADO: usa ← → (o A/D) para elegir el paquete activo,\n  ↑ ↓ (o W/S) para elegir la zona, y ENTER para confirmar.\n\n' +
      '• Clasifica antes de que el paquete llegue al final de la banda.\n\n' +
      '• Los frágiles requieren más cuidado: un error los rompe.', {
      fontFamily: 'Arial', fontSize: '14px', color: PALETA.texto, align: 'left', lineSpacing: 6
    }).setOrigin(0.5);

    const cerrar = this.add.text(ANCHO/2, ALTO/2 + 150, 'Cerrar', {
      fontFamily: 'Arial', fontSize: '15px', color: '#fff', fontStyle: 'bold',
      backgroundColor: '#0592b0', padding: { x: 20, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const grupo = [overlay, panel, titulo, texto, cerrar];
    cerrar.on('pointerdown', () => grupo.forEach(g => g.destroy()));
  }

  mostrarPantallaSalida() {
    const overlay = this.add.rectangle(ANCHO/2, ALTO/2, ANCHO, ALTO, 0x000000, 0.9).setInteractive();
    this.add.text(ANCHO/2, ALTO/2 - 30, '👋 Turno finalizado', {
      fontFamily: 'Arial', fontSize: '24px', color: '#f3e9dc', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(ANCHO/2, ALTO/2 + 15, 'Puedes cerrar esta pestaña o volver al menú principal de la plataforma.', {
      fontFamily: 'Arial', fontSize: '13px', color: '#bbb'
    }).setOrigin(0.5);

    const volver = this.add.text(ANCHO/2, ALTO/2 + 70, '← Volver al menú', {
      fontFamily: 'Arial', fontSize: '14px', color: '#fff',
      backgroundColor: '#184468', padding: { x: 18, y: 8 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    volver.on('pointerdown', () => this.scene.restart());
  }
}

// ═══════════════════════════════════════════════════════════
//  ESCENA: JUEGO (banda transportadora + clasificación)
// ═══════════════════════════════════════════════════════════
class EscenaAlmacen extends Phaser.Scene {

  constructor() {
    super('EscenaAlmacen');
  }

  preload() {
    this.load.on('loaderror', (file) => {
      console.warn('No se pudo cargar:', file.key, '— usando forma de respaldo.');
    });

    this.load.image('fondoAlmacen', '../../images/imagenfondo.png');
    this.load.image('bandaTexture', '../../images/banda-transportadora.png');
    this.load.image('gris', '../../images/gris.png');
    this.load.image('azul', '../../images/azul.png');
    this.load.image('roja', '../../images/roja.png');
    this.load.image('verde', '../../images/verde.png');

    this.load.audio('beep',      'sounds/beep.mp3');
    this.load.audio('correcto',  'sounds/correcto.mp3');
    this.load.audio('error',     'sounds/error.mp3');
    this.load.audio('cinta',     'sounds/cinta.mp3');
    this.load.audio('roto',      'sounds/roto.mp3');
    this.load.audio('aplastado', 'sounds/aplastado.mp3');
    this.load.audio('alarma',    'sounds/alarma.mp3');
    this.load.audio('ambiente',  'sounds/ambiente.mp3');
  }

  create() {
    this.nivel = NIVELES[ESTADO_GLOBAL.nivelSeleccionado];

    this.puntos = 0;
    this.aciertos = 0;
    this.errores = 0;
    this.erroresConsecutivos = 0;
    this.aciertosConsecutivos = 0;
    this.tiempoRestante = this.nivel.tiempoTotal;
    this.vidas = this.nivel.vidasMax;
    this.juegoActivo = true;
    this.paqueteSeleccionado = null;
    this.indiceSeleccionTeclado = 0;
    this.zonaResaltadaTeclado = 0;
    this.velocidadBanda = this.nivel.velocidadBanda;

    this.crearSonidos();
    this.crearFondo();
    this.crearBanda();
    this.crearZonas();
    this.crearHUD();
    this.crearSupervisor();
    this.crearControlTeclado();

    this.paquetes = [];

    this.eventoSpawn = this.time.addEvent({
      delay: this.nivel.intervaloSpawn,
      callback: this.spawnPaquete,
      callbackScope: this,
      loop: true
    });

    this.eventoTiempo = this.time.addEvent({
      delay: 1000,
      callback: this.tick,
      callbackScope: this,
      loop: true
    });

    this.mostrarDialogoSupervisor(
      `Nivel ${this.nivel.numero} — ${this.nivel.nombre}. ` + FRASES_SUPERVISOR.inicio
    );

    this.input.once('pointerdown', () => {
      if (this.sonidos.ambiente) this.sonidos.ambiente.play({ loop: true });
    });
  }

  // ───────────────────────────────────────────────
  //  SONIDO
  // ───────────────────────────────────────────────
  crearSonidos() {
    const cargar = (key, vol) => this.cache.audio.exists(key) ? this.sound.add(key, { volume: vol }) : null;
    this.sonidos = {
      beep:      cargar('beep', 0.4),
      correcto:  cargar('correcto', 0.6),
      error:     cargar('error', 0.6),
      cinta:     cargar('cinta', 0.5),
      roto:      cargar('roto', 0.7),
      aplastado: cargar('aplastado', 0.7),
      alarma:    cargar('alarma', 0.5),
      ambiente:  cargar('ambiente', 0.2)
    };
  }

  reproducir(key) {
    const s = this.sonidos[key];
    if (s) s.play();
  }

  // ───────────────────────────────────────────────
  //  FONDO
  // ───────────────────────────────────────────────
  crearFondo() {
    if (this.textures.exists('fondoAlmacen')) {
      const fondo = this.add.image(ANCHO/2, ALTO/2, 'fondoAlmacen');
      const escala = Math.max(ANCHO/fondo.width, ALTO/fondo.height);
      fondo.setScale(escala).setTint(0xcccccc);
    } else {
      this.add.rectangle(ANCHO/2, ALTO/2, ANCHO, ALTO, ACE.navy);
    }

    this.add.rectangle(ANCHO/2, 45, ANCHO, 90, 0x000000, 0.35);
    this.callejonY = 215;

    this.add.rectangle(ANCHO/2, 24, 340, 30, PALETA.estanteria, 0.9).setStrokeStyle(2, 0xf3e9dc);
    this.add.text(ANCHO/2, 24,
      `🏭 NIVEL ${this.nivel.numero} — ${this.nivel.nombre.toUpperCase()}`, {
      fontFamily: 'Arial', fontSize: '13px', color: '#f3e9dc', fontStyle: 'bold'
    }).setOrigin(0.5);
  }

  // ───────────────────────────────────────────────
  //  BANDA TRANSPORTADORA (con textura real si existe)
  // ───────────────────────────────────────────────
  crearBanda() {
    this.bandaY = 300;

    this.add.rectangle(ANCHO/2, this.bandaY + 36, ANCHO - 140, 14, PALETA.estanteria);

    if (this.textures.exists('bandaTexture')) {
      // TileSprite: la textura se repite horizontalmente y se puede animar
      this.bandaSprite = this.add.tileSprite(
        ANCHO/2, this.bandaY, ANCHO - 140, 50, 'bandaTexture'
      );
    } else {
      this.bandaSprite = null;
      this.add.rectangle(ANCHO/2, this.bandaY, ANCHO - 140, 50, PALETA.banda)
        .setStrokeStyle(2, ACE.navyOscuro);

      // Líneas de respaldo si no hay textura real
      this.lineasBanda = [];
      for (let i = 0; i < 16; i++) {
        const linea = this.add.rectangle(100 + i * 48, this.bandaY, 26, 6, ACE.navyClaro);
        this.lineasBanda.push(linea);
      }
    }

    this.add.rectangle(130, this.bandaY, 6, 70, ACE.cianClaro).setAlpha(0.7);
    this.add.text(130, this.bandaY - 50, '🔎 ESCÁNER', {
      fontFamily: 'Arial', fontSize: '11px', color: '#1a2d5a', fontStyle: 'bold',
      backgroundColor: '#f3e9dc', padding: { x: 4, y: 2 }
    }).setOrigin(0.5);
  }

  // ───────────────────────────────────────────────
  //  ZONAS DE CLASIFICACIÓN
  // ───────────────────────────────────────────────
  crearZonas() {
    const zonaY = 440;
    const posiciones = [150, 350, 550, 750];
    this.zonas = [];

    CLAVES_TIPO.forEach((clave, i) => {
      const tipo = TIPOS_PAQUETE[clave];
      const x = posiciones[i];

      const caja = this.add.rectangle(x, zonaY, 150, 80, tipo.color, 0.55)
        .setStrokeStyle(3, tipo.color)
        .setInteractive({ useHandCursor: true });

      if (this.textures.exists(tipo.sprite)) {
        this.add.image(x, zonaY - 20, tipo.sprite).setDisplaySize(46, 34);
      } else {
        this.add.text(x, zonaY - 20, tipo.icono, { fontSize: '26px' }).setOrigin(0.5);
      }
      this.add.text(x, zonaY + 14, tipo.nombre, {
        fontFamily: 'Arial', fontSize: '13px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);

      caja.on('pointerover', () => caja.setAlpha(0.8));
      caja.on('pointerout',  () => { if (i !== this.zonaResaltadaTeclado) caja.setAlpha(1).setFillStyle(tipo.color, 0.55); });
      caja.on('pointerdown', () => this.intentarClasificar(clave));

      this.zonas.push({ clave, x, y: zonaY, rect: caja, tipo });
    });

    this.resaltarZonaTeclado(0);
  }

  // ───────────────────────────────────────────────
  //  HUD
  // ───────────────────────────────────────────────
  crearHUD() {
    this.add.rectangle(ANCHO/2, 60, ANCHO - 20, 36, PALETA.hudFondo, 0.9).setStrokeStyle(1, 0xf3e9dc);

    this.txtTiempo = this.add.text(30, 60, '', {
      fontFamily: 'Arial', fontSize: '14px', color: '#f3e9dc', fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    this.txtPuntos = this.add.text(180, 60, '', {
      fontFamily: 'Arial', fontSize: '14px', color: '#FFD700', fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    this.txtAciertos = this.add.text(320, 60, '', {
      fontFamily: 'Arial', fontSize: '14px', color: '#7CFC9C', fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    this.txtErrores = this.add.text(430, 60, '', {
      fontFamily: 'Arial', fontSize: '14px', color: '#ff8a8a', fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    this.txtVidas = this.add.text(540, 60, '', {
      fontFamily: 'Arial', fontSize: '14px', color: '#ff6b6b', fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    this.txtAlertaFragil = this.add.text(ANCHO - 40, 60, '', {
      fontFamily: 'Arial', fontSize: '14px', color: '#ffcc00', fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    const btnMenu = this.add.text(ANCHO - 40, 24, '☰ Menú', {
      fontFamily: 'Arial', fontSize: '12px', color: '#fff',
      backgroundColor: '#184468', padding: { x: 10, y: 4 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    btnMenu.on('pointerdown', () => this.scene.start('EscenaMenu'));

    const btnFullscreen = this.add.text(ANCHO - 140, 24, '⛶', {
      fontFamily: 'Arial', fontSize: '14px', color: '#fff',
      backgroundColor: '#184468', padding: { x: 8, y: 4 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    btnFullscreen.on('pointerdown', () => toggleFullscreen());

    this.actualizarHUD();
  }

  actualizarHUD() {
    this.txtTiempo.setText('⏱ ' + this.tiempoRestante + 's');
    this.txtPuntos.setText('★ ' + this.puntos);
    this.txtAciertos.setText('✓ ' + this.aciertos);
    this.txtErrores.setText('✗ ' + this.errores);
    this.txtVidas.setText('❤ ' + this.vidas);

    // Actualizar también los stats del HTML (las pills encima del canvas)
    const prec = (this.aciertos + this.errores) > 0
      ? Math.round((this.aciertos / (this.aciertos + this.errores)) * 100)
      : 100;
    if (typeof actualizarStatsHTML === 'function') {
      actualizarStatsHTML(this.puntos, prec, this.vidas, this.nivel.numero);
    }
  }

  // ───────────────────────────────────────────────
  //  SUPERVISOR
  // ───────────────────────────────────────────────
  crearSupervisor() {
    this.cuadroDialogo = this.add.container(0, 0).setVisible(false);

    const fondoDialogo = this.add.rectangle(ANCHO/2, ALTO - 90, ANCHO - 80, 90, 0xfff8ec)
      .setStrokeStyle(3, PALETA.estanteria);
    const retrato = this.add.text(ANCHO/2 - (ANCHO - 100)/2 + 10, ALTO - 90, '🧑‍💼', { fontSize: '40px' }).setOrigin(0, 0.5);
    const etiqueta = this.add.text(ANCHO/2 - (ANCHO - 100)/2 + 60, ALTO - 115, 'SUPERVISOR', {
      fontFamily: 'Arial', fontSize: '11px', color: '#888', fontStyle: 'bold'
    });
    this.txtDialogoSupervisor = this.add.text(ANCHO/2 - (ANCHO - 100)/2 + 60, ALTO - 95, '', {
      fontFamily: 'Arial', fontSize: '13px', color: PALETA.texto, wordWrap: { width: ANCHO - 200 }
    });

    this.cuadroDialogo.add([fondoDialogo, retrato, etiqueta, this.txtDialogoSupervisor]);
  }

  mostrarDialogoSupervisor(texto) {
    this.txtDialogoSupervisor.setText(texto);
    this.cuadroDialogo.setVisible(true);
    if (this.timerDialogo) this.timerDialogo.remove();
    this.timerDialogo = this.time.delayedCall(4500, () => this.cuadroDialogo.setVisible(false));
  }

  // ───────────────────────────────────────────────
  //  CONTROL POR TECLADO
  //  ←/→ o A/D: cambia el paquete seleccionado
  //  ↑/↓ o W/S: cambia la zona resaltada
  //  ENTER: confirma clasificación
  // ───────────────────────────────────────────────
  crearControlTeclado() {
    this.input.keyboard.on('keydown-LEFT',  () => this.moverSeleccionPaquete(-1));
    this.input.keyboard.on('keydown-A',     () => this.moverSeleccionPaquete(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.moverSeleccionPaquete(1));
    this.input.keyboard.on('keydown-D',     () => this.moverSeleccionPaquete(1));

    this.input.keyboard.on('keydown-UP',    () => this.moverSeleccionZona(-1));
    this.input.keyboard.on('keydown-W',     () => this.moverSeleccionZona(-1));
    this.input.keyboard.on('keydown-DOWN',  () => this.moverSeleccionZona(1));
    this.input.keyboard.on('keydown-S',     () => this.moverSeleccionZona(1));

    this.input.keyboard.on('keydown-ENTER', () => this.confirmarConTeclado());
    this.input.keyboard.on('keydown-SPACE', () => this.confirmarConTeclado());
    this.input.keyboard.on('keydown-F', () => toggleFullscreen());
  }

  moverSeleccionPaquete(direccion) {
    const activos = this.paquetes.filter(p => p.active && !p.getData('clasificado'));
    if (activos.length === 0) return;

    this.indiceSeleccionTeclado = Phaser.Math.Wrap(this.indiceSeleccionTeclado + direccion, 0, activos.length);
    this.seleccionarPaquete(activos[this.indiceSeleccionTeclado]);
  }

  moverSeleccionZona(direccion) {
    const nuevaZona = Phaser.Math.Wrap(this.zonaResaltadaTeclado + direccion, 0, this.zonas.length);
    this.resaltarZonaTeclado(nuevaZona);
  }

  resaltarZonaTeclado(indice) {
    this.zonas.forEach((z, i) => {
      if (i === indice) {
        z.rect.setStrokeStyle(5, 0xFFD700);
      } else {
        z.rect.setStrokeStyle(3, z.tipo.color);
      }
    });
    this.zonaResaltadaTeclado = indice;
  }

  confirmarConTeclado() {
    if (!this.paqueteSeleccionado) return;
    const zona = this.zonas[this.zonaResaltadaTeclado];
    this.intentarClasificar(zona.clave);
  }

  // ───────────────────────────────────────────────
  //  SPAWN DE PAQUETES (usa sprite real si existe)
  // ───────────────────────────────────────────────
  spawnPaquete() {
    if (!this.juegoActivo) return;

    const claveTipo = CLAVES_TIPO[Phaser.Math.Between(0, CLAVES_TIPO.length - 1)];
    const tipo = TIPOS_PAQUETE[claveTipo];

    const grupo = this.add.container(60, this.bandaY);
    let elementoVisual;

    if (this.textures.exists(tipo.sprite)) {
      elementoVisual = this.add.image(0, 0, tipo.sprite).setDisplaySize(50, 38)
        .setInteractive({ useHandCursor: true });
    } else {
      elementoVisual = this.add.rectangle(0, 0, 50, 38, tipo.color)
        .setStrokeStyle(2, 0xffffff, 0.5)
        .setInteractive({ useHandCursor: true });
      const icono = this.add.text(0, 0, tipo.icono, { fontSize: '20px' }).setOrigin(0.5);
      grupo.add(icono);
    }

    grupo.add(elementoVisual);
    grupo.setData('tipo', claveTipo);
    grupo.setData('clasificado', false);
    grupo.setData('visual', elementoVisual);

    elementoVisual.on('pointerdown', () => this.seleccionarPaquete(grupo));

    this.paquetes.push(grupo);
    this.reproducir('beep');

    if (claveTipo === 'fragil') {
      this.txtAlertaFragil.setText('⚠ FRÁGIL EN BANDA');
      this.time.delayedCall(2000, () => this.txtAlertaFragil.setText(''));
    }
  }

  seleccionarPaquete(grupo) {
    if (grupo.getData('clasificado')) return;

    if (this.paqueteSeleccionado && this.paqueteSeleccionado.active) {
      const visualAnterior = this.paqueteSeleccionado.getData('visual');
      if (visualAnterior.setStrokeStyle) visualAnterior.setStrokeStyle(2, 0xffffff, 0.5);
      visualAnterior.clearTint && visualAnterior.clearTint();
    }

    this.paqueteSeleccionado = grupo;
    const visual = grupo.getData('visual');
    if (visual.setStrokeStyle) visual.setStrokeStyle(4, 0xffd700, 1);
    if (visual.setTint) visual.setTint(0xffe8a3);

    this.reproducir('beep');
  }

  intentarClasificar(zonaClave) {
    if (!this.paqueteSeleccionado || !this.paqueteSeleccionado.active) return;

    const grupo = this.paqueteSeleccionado;
    if (grupo.getData('clasificado')) return;

    grupo.setData('clasificado', true);
    const tipoReal = grupo.getData('tipo');
    const correcto = tipoReal === zonaClave;

    this.procesarResultado(grupo, correcto, tipoReal);
    this.paqueteSeleccionado = null;
  }

  procesarResultado(grupo, correcto, tipoReal) {
    if (correcto) {
      this.puntos += 10 * this.nivel.numero;
      this.aciertos++;
      this.erroresConsecutivos = 0;
      this.aciertosConsecutivos++;
      this.reproducir('correcto');
      this.flotarTexto(grupo.x, grupo.y, '+' + (10 * this.nivel.numero) + ' ✓', '#22a559');

      if (this.aciertosConsecutivos === 5) {
        this.mostrarDialogoSupervisor(FRASES_SUPERVISOR.buenRacha);
      }
    } else {
      this.errores++;
      this.erroresConsecutivos++;
      this.aciertosConsecutivos = 0;
      this.vidas--;
      this.reproducir('error');
      this.reproducir(tipoReal === 'fragil' ? 'roto' : 'aplastado');
      this.flotarTexto(grupo.x, grupo.y, '✗ Incorrecto', '#e53e3e');

      if (this.erroresConsecutivos >= 3) {
        const frase = FRASES_SUPERVISOR.errores[Phaser.Math.Between(0, FRASES_SUPERVISOR.errores.length - 1)];
        this.mostrarDialogoSupervisor(frase);
        this.erroresConsecutivos = 0;
      }
    }

    this.actualizarHUD();
    this.destruirPaquete(grupo);

    if (this.vidas <= 0) this.finalizarJuego();
  }

  flotarTexto(x, y, texto, color) {
    const t = this.add.text(x, y - 30, texto, {
      fontFamily: 'Arial', fontSize: '16px', color, fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  destruirPaquete(grupo) {
    this.tweens.add({
      targets: grupo, alpha: 0, scale: 0.6, duration: 200,
      onComplete: () => { this.paquetes = this.paquetes.filter(p => p !== grupo); grupo.destroy(); }
    });
  }

  tick() {
    if (!this.juegoActivo) return;
    this.tiempoRestante--;
    this.actualizarHUD();
    if (this.tiempoRestante === 10) this.reproducir('alarma');
    if (this.tiempoRestante <= 0) this.finalizarJuego();
  }

  update() {
    if (!this.juegoActivo) return;
    const dt = this.game.loop.delta / 1000;

    if (this.bandaSprite) {
      this.bandaSprite.tilePositionX += this.velocidadBanda * dt;
    } else if (this.lineasBanda) {
      this.lineasBanda.forEach(l => {
        l.x += this.velocidadBanda * dt;
        if (l.x > ANCHO - 60) l.x = 80;
      });
    }

    this.paquetes.forEach(grupo => {
      if (!grupo.active || grupo.getData('clasificado')) return;
      grupo.x += this.velocidadBanda * dt;

      if (grupo.x > ANCHO - 60) {
        grupo.setData('clasificado', true);
        this.errores++;
        this.erroresConsecutivos++;
        this.aciertosConsecutivos = 0;
        this.vidas--;
        this.reproducir('aplastado');
        this.flotarTexto(grupo.x, grupo.y, '✗ Sin clasificar', '#e53e3e');
        this.actualizarHUD();
        this.destruirPaquete(grupo);

        if (this.erroresConsecutivos >= 3) {
          const frase = FRASES_SUPERVISOR.errores[Phaser.Math.Between(0, FRASES_SUPERVISOR.errores.length - 1)];
          this.mostrarDialogoSupervisor(frase);
          this.erroresConsecutivos = 0;
        }

        if (this.vidas <= 0) this.finalizarJuego();
      }
    });
  }

  finalizarJuego() {
    this.juegoActivo = false;
    this.eventoSpawn.remove();
    this.eventoTiempo.remove();
    if (this.sonidos.ambiente) this.sonidos.ambiente.stop();

    this.paquetes.forEach(p => p.destroy());
    this.paquetes = [];

    const total = this.aciertos + this.errores;
    const precision = total > 0 ? Math.round((this.aciertos / total) * 100) : 0;
    const gano = this.vidas > 0;

    let calificacion, emoji;
    if (!gano) { calificacion = 'Sin vidas'; emoji = '💥'; }
    else if (precision >= 90) { calificacion = 'Excelente'; emoji = '🏆'; }
    else if (precision >= 75) { calificacion = 'Muy bueno'; emoji = '👍'; }
    else if (precision >= 60) { calificacion = 'Bueno'; emoji = '🙂'; }
    else { calificacion = 'Necesita mejorar'; emoji = '⚠️'; }

    // Registrar partida en el historial HTML
    if (typeof registrarPartida === 'function') {
      const ahora = new Date();
      registrarPartida({
        puntos: this.puntos,
        precision,
        vidas: this.vidas,
        nivel: `Nivel ${this.nivel.numero} — ${this.nivel.nombre}`,
        calificacion,
        fecha: ahora.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      });
    }

    this.add.rectangle(ANCHO/2, ALTO/2, ANCHO, ALTO, 0x000000, 0.82);

    this.add.text(ANCHO/2, ALTO/2 - 150, emoji, { fontSize: '52px' }).setOrigin(0.5);
    this.add.text(ANCHO/2, ALTO/2 - 95, gano ? 'TURNO FINALIZADO' : 'SIN VIDAS', {
      fontFamily: 'Arial', fontSize: '24px', color: '#f3e9dc', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(ANCHO/2, ALTO/2 - 55,
      `Nivel ${this.nivel.numero} — ${this.nivel.nombre}`, {
      fontFamily: 'Arial', fontSize: '14px', color: '#00b4d8'
    }).setOrigin(0.5);

    this.add.text(ANCHO/2, ALTO/2 - 15,
      `Puntos: ${this.puntos}     Precisión: ${precision}%`, {
      fontFamily: 'Arial', fontSize: '16px', color: '#FFD700'
    }).setOrigin(0.5);

    this.add.text(ANCHO/2, ALTO/2 + 20,
      `Aciertos: ${this.aciertos}     Errores: ${this.errores}`, {
      fontFamily: 'Arial', fontSize: '14px', color: '#f3e9dc'
    }).setOrigin(0.5);

    this.add.text(ANCHO/2, ALTO/2 + 55, 'Desempeño: ' + calificacion, {
      fontFamily: 'Arial', fontSize: '16px', color: '#7CFC9C', fontStyle: 'bold'
    }).setOrigin(0.5);

    const btnReiniciar = this.add.text(ANCHO/2 - 110, ALTO/2 + 110, '🔄 Reintentar', {
      fontFamily: 'Arial', fontSize: '14px', color: '#fff',
      backgroundColor: '#0056b3', padding: { x: 16, y: 9 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const btnSiguiente = this.add.text(ANCHO/2 + 70, ALTO/2 + 110,
      gano && precision >= 70 && this.nivel.numero < 3 ? '➜ Siguiente nivel' : '☰ Menú principal', {
      fontFamily: 'Arial', fontSize: '14px', color: '#fff',
      backgroundColor: '#22a559', padding: { x: 16, y: 9 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btnReiniciar.on('pointerdown', () => this.scene.restart());

    btnSiguiente.on('pointerdown', () => {
      if (gano && precision >= 70 && this.nivel.numero < 3) {
        ESTADO_GLOBAL.nivelSeleccionado = this.nivel.numero; // avanza al siguiente índice
        this.scene.restart();
      } else {
        this.scene.start('EscenaMenu');
      }
    });
  }
}

// ── Configuración Phaser ──
const config = {
  type: Phaser.AUTO,
  width: ANCHO,
  height: ALTO,
  parent: 'game-container',
  backgroundColor: '#0f345c',
  resolution: window.devicePixelRatio || 1,
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [EscenaSplash, EscenaMenu, EscenaAlmacen]
};

let juegoActual;

window.addEventListener('load', () => {
  juegoActual = new Phaser.Game(config);
});

// Cuando se entra o sale de pantalla completa, Phaser debe recalcular
// el tamaño del canvas para que siga ocupando todo el espacio disponible.
document.addEventListener('fullscreenchange', () => {
  if (juegoActual) juegoActual.scale.refresh();
});
document.addEventListener('webkitfullscreenchange', () => {
  if (juegoActual) juegoActual.scale.refresh();
});

// ── Funciones llamadas desde botones del HTML (si los mantienes) ──
function reiniciarJuego() {
  if (juegoActual) juegoActual.scene.start('EscenaMenu');
}

function pausarJuego() {
  if (!juegoActual) return;
  const escena = juegoActual.scene.getScene('EscenaAlmacen');
  if (!escena || !escena.scene.isActive()) return;

  const btn = document.getElementById('btnPausa');
  if (escena.juegoActivo) {
    escena.juegoActivo = false;
    juegoActual.scene.pause('EscenaAlmacen');
    if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i> Reanudar';
  } else {
    escena.juegoActivo = true;
    juegoActual.scene.resume('EscenaAlmacen');
    if (btn) btn.innerHTML = '<i class="bi bi-pause-fill"></i> Pausar';
  }
}