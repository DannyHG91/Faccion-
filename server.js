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

// Si usas el disco persistente de Render, cambia esta ruta por la ruta del disco (/opt/render/project/src/datos/usuarios.json)
const ARCHIVO_USUARIOS = path.join(__dirname, 'usuarios.json');

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
    } catch (error) {
        return [...lideresPorDefecto];
    }
}

function guardarUsuariosEnArchivo(listaUsuarios) {
    try {
        fs.writeFileSync(ARCHIVO_USUARIOS, JSON.stringify(listaUsuarios, null, 2), 'utf8');
    } catch (error) {}
}

const urlsFacciones = {
    "Fuego": "https://ejemplo.com",
    "Agua": "https://ejemplo.com",
    "Tierra": "https://ejemplo.com"
};

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// ----------------------------------------------------
// 🔑 SECCIÓN A: PORTAL EXCLUSIVO DEL ALTO MANDO (LÍDERES)
// ----------------------------------------------------
app.get('/altomando/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login_lideres.html'));
});

app.post('/api/login-lideres', (req, res) => {
    const { user, pass } = req.body;
    const listaUsuariosActuales = cargarUsuariosDeArchivo();
    const usuarioEncontrado = listaUsuariosActuales.find(u => u.user === user && u.pass === pass);

    if (usuarioEncontrado) {
        // 🛡️ CONTROL DE ACCESO: Si no es líder, es rechazado inmediatamente
        if (usuarioEncontrado.role !== "Lider") {
            return res.status(403).json({ success: false, message: "⚠️ Acceso denegado. Este portal es únicamente para el Alto Mando." });
        }

        req.session.usuarioLogueado = true;
        req.session.faction = usuarioEncontrado.faction;
        req.session.role = usuarioEncontrado.role;
        res.json({ success: true, redirect: '/panel-lider' });
    } else {
        res.status(401).json({ success: false, message: "Credenciales de Líder incorrectas." });
    }
});

// ----------------------------------------------------
// 🔑 SECCIÓN B: PORTALES DE FACCIONES (RECLUTAS / MIEMBROS)
// ----------------------------------------------------
app.get('/:faccion/login', (req, res) => {
    const faccion = req.params.faccion.toLowerCase();
    if (['fuego', 'agua', 'tierra'].includes(faccion)) {
        res.sendFile(path.join(__dirname, 'login_facciosos.html'));
    } else {
        res.status(404).send('<h1>Facción inexistente</h1>');
    }
});

app.post('/api/login-exclusivo', (req, res) => {
    const { user, pass, factionUrl } = req.body;
    const listaUsuariosActuales = cargarUsuariosDeArchivo();
    const usuarioEncontrado = listaUsuariosActuales.find(u => u.user === user && u.pass === pass);

    if (usuarioEncontrado) {
        // 🛡️ CONTROL DE ACCESO: Un líder no puede usar el login de los miembros comunes
        if (usuarioEncontrado.role === "Lider") {
            return res.status(403).json({ success: false, message: "⚠️ Los líderes deben iniciar sesión desde el Portal del Alto Mando." });
        }

        if (usuarioEncontrado.faction.toLowerCase() !== factionUrl.toLowerCase()) {
            return res.status(403).json({ success: false, message: `⚠️ ¡Acceso denegado! No perteneces a la Facción ${factionUrl}.` });
        }

        req.session.usuarioLogueado = true;
        req.session.faction = usuarioEncontrado.faction;
        req.session.role = usuarioEncontrado.role;
        res.json({ success: true, redirect: '/acceso-facciosos' });
    } else {
        res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos." });
    }
});

// ----------------------------------------------------
// 🛡️ SECCIÓN C: SEGURIDAD INTERNA Y RECLUTAMIENTO
// ----------------------------------------------------
app.get('/panel-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") {
        return res.status(403).send("<h1>Acceso Denegado: No eres líder.</h1>");
    }
    res.sendFile(path.join(__dirname, 'lider.html'));
});

app.get('/api/info-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") { return res.status(403).json({ error: "No autorizado" }); }
    res.json({ faction: req.session.faction });
});

app.post('/api/registrar-por-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") { return res.status(403).json({ error: "Acceso denegado." }); }

    const faccionLider = req.session.faction; 
    const nuevoUsuario = "recluta_" + faccionLider.toLowerCase() + "_" + Math.floor(1000 + Math.random() * 9000);
    
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let nuevaContrasena = "";
    for (let i = 0; i < 8; i++) { nuevaContrasena += caracteres.charAt(Math.floor(Math.random() * caracteres.length)); }

    const listaUsuariosActuales = cargarUsuariosDeArchivo();
    listaUsuariosActuales.push({ user: nuevoUsuario, pass: nuevaContrasena, faction: faccionLider, role: "Miembro" });
    guardarUsuariosEnArchivo(listaUsuariosActuales);

    res.json({ user: nuevoUsuario, pass: nuevaContrasena, faction: faccionLider });
});

app.get('/acceso-facciosos', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Miembro") { return res.status(403).send("<h1>Acceso Denegado.</h1>"); }
    const urlDestino = urlsFacciones[req.session.faction];
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Cargando...</title><style>body { background: #121214; color: white; font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }</style></head>
        <body>
            <div style="text-align: center;">
                <h2>Ingresando al santuario...</h2>
                <p>Si no redirige automáticamente, <a href="${urlDestino}" style="color: #007bff; font-weight: bold;">haz clic aquí</a></p>
            </div>
            <script>window.location.replace("${urlDestino}");</script>
        </body>
        </html>
    `);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor de facciones activo en puerto ${PORT}`); });
