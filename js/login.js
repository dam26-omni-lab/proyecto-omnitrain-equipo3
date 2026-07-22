// Espera a que todo el HTML esté cargado en el navegador antes de ejecutar el script
document.addEventListener("DOMContentLoaded", () => {
 
  // Busca en el HTML el formulario con id="loginForm" y lo guarda en la variable "form"
  const form = document.getElementById("loginForm");
 
  // Si el formulario no existe en esta página, detiene la ejecución del script (evita errores)
  if (!form) return;

  // Busca el elemento donde se mostrarán los mensajes de estado (éxito, error, validación)
  const feedbackEl = document.getElementById("loginFeedback");
 
  // Busca el botón de envío del formulario, para poder deshabilitarlo mientras se procesa el login
  const loginButton = document.getElementById("loginButton");

  // Escucha el evento "submit" (cuando el usuario da clic en "Acceder a OmniTrain")
  // Se usa "async" porque dentro se va a esperar una respuesta (await) de una función asíncrona
  form.addEventListener("submit", async (event) => {
   
    // Evita que el formulario haga el envío por defecto (que recargaría la página)
    event.preventDefault();
   
    // Evita que el evento se propague a otros elementos padre (buena práctica de control de eventos)
    event.stopPropagation();

    // Activar validación visual de Bootstrap
    // Verifica si el formulario cumple todas las reglas HTML (required, type="email", minlength, etc.)
    if (!form.checkValidity()) {
      // Si NO es válido, agrega la clase "was-validated" para que Bootstrap muestre los mensajes de error en rojo
      form.classList.add("was-validated");
      // Detiene la ejecución aquí: no continúa el proceso de login si el formulario está incompleto
      return;
    }

    // Obtiene el valor seleccionado en el campo de perfil (coordinador o colaborador)
    const role = document.getElementById("role").value;
   
    // Obtiene el valor del campo de correo y elimina espacios en blanco al inicio/final con .trim()
    const email = document.getElementById("email").value.trim();
   
    // Obtiene el valor del campo de contraseña tal cual lo escribió el usuario
    const password = document.getElementById("password").value;

    // Muestra un mensaje temporal indicando que se están validando los datos
    feedbackEl.textContent =
      "Validando datos de acceso y perfil de capacitación...";
   
    // Deshabilita el botón de login para evitar que el usuario haga clic varias veces mientras se procesa
    loginButton.disabled = true;

    // Bloque try/catch/finally: intenta ejecutar el proceso de autenticación y maneja errores si ocurren
    try {
      // Carga Firebase solo hasta este punto (ya pasó la validación de campos).
      // Import dinámico: funciona en un <script> normal, sin necesidad de type="module".
      const { auth } = await import("./firebase-config.js");
      const { signInWithEmailAndPassword } = await import(
        "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
      );

      // Autentica contra los usuarios reales que creaste en Firebase (prueba1ace)
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Si el login fue exitoso, revisa qué perfil seleccionó el usuario
      if (role === "coordinador") {
        // Muestra un mensaje específico para el perfil Coordinador
        feedbackEl.textContent =
          "Acceso como Coordinador. Podrás asignar módulos y tareas a colaboradores.";
      } else if (role === "colaborador") {
        // Muestra un mensaje específico para el perfil Colaborador
        feedbackEl.textContent =
          "Acceso como Colaborador. Podrás realizar tus módulos de capacitación asignados.";
      }

      // Guarda los datos básicos de la sesión para usarlos en index.html
      // (por ejemplo, mostrar el correo y el perfil en el topbar)
      sessionStorage.setItem("ace_user_email", credential.user.email);
      sessionStorage.setItem("ace_user_role", role);

      // Espera un momento para que el usuario alcance a leer el mensaje,
      // y luego lo redirige a index.html
      setTimeout(() => {
        window.location.href = "index.html";
      }, 800);
    } catch (error) {
      // Si Firebase rechaza las credenciales (correo/contraseña incorrectos), se captura aquí
      // Imprime el error en la consola del navegador, útil para depuración
      console.error(error);
      // Muestra al usuario un mensaje de error específico según lo que devolvió Firebase
      feedbackEl.textContent = mapFirebaseError(error.code);
    } finally {
      // Este bloque se ejecuta siempre, haya éxito o error
      // Vuelve a habilitar el botón de login para que el usuario pueda intentar de nuevo si falló
      loginButton.disabled = false;
    }
  });
});

// Traduce los códigos de error de Firebase Authentication a mensajes en español,
// para que el usuario entienda qué falló sin ver el código técnico.
function mapFirebaseError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "El formato del correo no es válido.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.";
    case "auth/network-request-failed":
      return "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.";
    default:
      return "No fue posible iniciar sesión. Verifica tu correo, contraseña y perfil o contacta al área de capacitación.";
  }
}