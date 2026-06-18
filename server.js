const express = require('express');
const session = require('express-session');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'token_ancestral_facciones_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Sesión por 24 horas
}));

app.use(express.static(path.join(__dirname), {
    maxAge: '7d',
    setHeaders: (res) => { res.setHeader('Cache-Control', 'public, max-age=604800'); }
}));

const ARCHIVO_USUARIOS = path.join(__dirname, 'usuarios.json');

// Cuentas maestras de los líderes (Ellos mantienen usuario y clave)
const lideresPorDefecto = [
    { user: "lider_fuego", pass: "fuego123", faction: "Fuego", role: "Lider" },
    { user: "lider_agua", pass: "agua123", faction: "Agua", role: "Lider" },
    { user: "lider_tierra", pass: "tierra123", faction: "Tierra", role: "Lider" }
];

function cargarUsuariosDeArchivo() {
    try {
        if (fs.existsSync(ARCHIVO_USUARIOS)) {
            const datosRaw = fs.readFileSync(ARCHIVO_USUARIOS, 'utf8');
            return JSON.parse(datosRaw);
        } else {
            fs.writeFileSync(ARCHIVO_USUARIOS, JSON.stringify(lideresPorDefecto, null, 2), 'utf8');
            return [...lideresPorDefecto];
        }
    } catch (error) { return [...lideresPorDefecto]; }
}

function guardarUsuariosEnArchivo(lista) {
    try { fs.writeFileSync(ARCHIVO_USUARIOS, JSON.stringify(lista, null, 2), 'utf8'); } catch (error) {}
}

const urlsFacciones = {
    "Fuego": "https://ejemplo.com",
    "Agua": "https://ejemplo.com",
    "Tierra": "https://ejemplo.com"
};

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// 🦅 LOGIN DE LÍDERES
app.get('/altomando/login', (req, res) => { res.sendFile(path.join(__dirname, 'login_lideres.html')); });

app.post('/api/login-lideres', (req, res) => {
    const { user, pass } = req.body;
    const lista = cargarUsuariosDeArchivo();
    const encontrado = lista.find(u => u.user === user && u.pass === pass && u.role === "Lider");

    if (encontrado) {
        req.session.usuarioLogueado = true;
        req.session.faction = encontrado.faction;
        req.session.role = encontrado.role;
        res.json({ success: true, redirect: '/panel-lider' });
    } else {
        res.status(401).json({ success: false, message: "Credenciales de Líder incorrectas." });
    }
});

// 🔑 PORTALES DE RECLUTAS (AHORA POR TOKEN)
app.get('/:faccion/login', (req, res) => {
    if (['fuego', 'agua', 'tierra'].includes(req.params.faccion.toLowerCase())) {
        res.sendFile(path.join(__dirname, 'login_facciosos.html'));
    } else { res.status(404).send('<h1>Facción inexistente</h1>'); }
});

// VALIDACIÓN DE TOKEN ÚNICO
app.post('/api/login-token', (req, res) => {
    const { token, factionUrl } = req.body;
    const lista = cargarUsuariosDeArchivo();
    
    // Buscamos si el token existe en la base de datos
    const tokenValido = lista.find(u => u.token === token && u.role === "Miembro");

    if (tokenValido) {
        // Bloqueo si el token es de otra facción
        if (tokenValido.faction.toLowerCase() !== factionUrl.toLowerCase()) {
            return res.status(403).json({ success: false, message: `⚠️ Código inválido para la Facción ${factionUrl}.` });
        }

        req.session.usuarioLogueado = true;
        req.session.faction = tokenValido.faction;
        req.session.role = tokenValido.role;
        res.json({ success: true, redirect: '/acceso-facciosos' });
    } else {
        res.status(401).json({ success: false, message: "El Token de acceso no existe o ya expiró." });
    }
});

// 🛡️ CONTROL INTERNO Y GENERACIÓN DE TOKENS
app.get('/panel-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") return res.status(403).send("No autorizado");
    res.sendFile(path.join(__dirname, 'lider.html'));
});

app.get('/api/info-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") return res.status(403).json({ error: "No autorizado" });
    res.json({ faction: req.session.faction });
});

// EL LÍDER GENERA UN TOKEN ÚNICO COMPACTO
app.post('/api/generar-token', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") return res.status(403).json({ error: "Denegado" });

    const faccionLider = req.session.faction;
    
    // Genera un código tipo FUEGO-K92B-47A1
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let bloque1 = "", bloque2 = "";
    for (let i = 0; i < 4; i++) {
        bloque1 += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        bloque2 += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    const tokenGenerado = `${faccionLider.toUpperCase()}-${bloque1}-${bloque2}`;

    const lista = cargarUsuariosDeArchivo();
    lista.push({ token: tokenGenerado, faction: faccionLider, role: "Miembro" });
    guardarUsuariosEnArchivo(lista);

    res.json({ token: tokenGenerado, faction: faccionLider });
});

// GUARDIÁN DE ARCHIVOS LOCALES MILITARES
app.get('/acceso-facciosos', (req, res) => {
    // 1. Bloqueo radical si no ha iniciado sesión con token
    if (!req.session.usuarioLogueado || req.session.role !== "Miembro") { 
        return res.status(403).send("<h1>[ACCESO DENEGADO]: Autenticación Requerida.</h1>"); 
    }
    
    const faccionDelUsuario = req.session.faction.toLowerCase(); // 'fuego', 'agua' o 'tierra'

    // 2. Servimos el archivo HTML local exclusivo de su bando en pantalla completa
    res.sendFile(path.join(__dirname, `contenido_${faccionDelUsuario}.html`));
});


app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor de Tokens activo en puerto ${PORT}`); });
