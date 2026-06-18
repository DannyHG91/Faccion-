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
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Sesión activa por 24 horas
}));

app.use(express.static(path.join(__dirname), {
    maxAge: '7d',
    setHeaders: (res) => { res.setHeader('Cache-Control', 'public, max-age=604800'); }
}));

// Si usas el disco persistente de Render, cambia esta ruta por la de tu volumen (/opt/render/project/src/datos/usuarios.json)
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
    } catch (error) { return [...lideresPorDefecto]; }
}

function guardarUsuariosEnArchivo(lista) {
    try { fs.writeFileSync(ARCHIVO_USUARIOS, JSON.stringify(lista, null, 2), 'utf8'); } catch (error) {}
}

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// 🦅 PORTAL EXCLUSIVO DEL ALTO MANDO
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

// 🔑 PORTALES DE RECLUTAS
app.get('/:faccion/login', (req, res) => {
    if (['fuego', 'agua', 'tierra'].includes(req.params.faccion.toLowerCase())) {
        res.sendFile(path.join(__dirname, 'login_facciosos.html'));
    } else { res.status(404).send('<h1>Facción inexistente</h1>'); }
});

// VALIDACIÓN Y CREACIÓN DE SESIÓN RECLUTA
app.post('/api/login-token', (req, res) => {
    const { token, factionUrl } = req.body;
    const lista = cargarUsuariosDeArchivo();
    
    const tokenValido = lista.find(u => u.token === token && u.role === "Miembro");

    if (tokenValido) {
        if (tokenValido.faction.toLowerCase() !== factionUrl.toLowerCase()) {
            return res.status(403).json({ success: false, message: `⚠️ Código inválido para la División ${factionUrl.toUpperCase()}.` });
        }

        // Activamos la sesión del recluta en el servidor
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

app.post('/api/generar-token', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") return res.status(403).json({ error: "Denegado" });

    const faccionLider = req.session.faction;
    
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

// 📂 NUEVA RUTA DE DESPACHO INTERNO DE ARCHIVOS MILITARES
app.get('/acceso-facciosos', (req, res) => {
    // Si un intruso intenta forzar esta ruta sin haber validado su token, es bloqueado por el servidor
    if (!req.session.usuarioLogueado || req.session.role !== "Miembro") {
        return res.status(403).send("<h1>[ALERTA DE INTRUSO]: Autenticación criptográfica requerida.</h1>");
    }
    
    const divisionMiembro = req.session.faction.toLowerCase(); // 'fuego', 'agua' o 'tierra'

    // Servimos directamente el archivo HTML correspondiente desde el disco del servidor
    res.sendFile(path.join(__dirname, `contenido_${fuego}.html`));
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor de Contenidos Locales activo en puerto ${PORT}`); });
