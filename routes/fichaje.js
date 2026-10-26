const express = require("express");
const { verificarToken, soloRoles } = require("../middlewares/auth");
const { registrarFichaje, obtenerFichajes } = require("../controllers/fichajeController");

const router = express.Router();

// El endpoint de fichaje es público (se usa con PIN): se limitan los intentos
// por IP para frenar la adivinación de PINs. 20 intentos cada 10 minutos.
// Es un contador en memoria (se reinicia si se reinicia el servidor).
const VENTANA_MS = 10 * 60 * 1000;
const MAX_INTENTOS = 20;
const intentos = new Map();

const limitarFichaje = (req, res, next) => {
  const ahora = Date.now();
  const clave = req.ip;
  const registro = intentos.get(clave);
  if (!registro || ahora > registro.expira) {
    intentos.set(clave, { cuenta: 1, expira: ahora + VENTANA_MS });
    return next();
  }
  registro.cuenta += 1;
  if (registro.cuenta > MAX_INTENTOS) {
    return res.status(429).json({ error: "Demasiados intentos. Probá de nuevo en unos minutos." });
  }
  next();
};

// Limpieza periódica para que el Map no crezca sin límite
setInterval(() => {
  const ahora = Date.now();
  for (const [clave, r] of intentos) if (ahora > r.expira) intentos.delete(clave);
}, VENTANA_MS).unref();

router.post("/", limitarFichaje, registrarFichaje);
router.get("/", verificarToken, soloRoles("DUENO"), obtenerFichajes);

module.exports = router;
