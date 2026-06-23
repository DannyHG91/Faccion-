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
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// 🟢 DESPACHADOR ESTÁTICO SEGURO: Apunta a la nueva carpeta pública
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0,
    setHeaders: (res, ruta) => { 
        if (ruta.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private'); 
        } else {
            res.setHeader('Cache-Control', 'public, max-age=3600'); 
        }
    }
}));

// Base de datos local persistente en JSON
const ARCHIVO_USUARIOS = path.join(__dirname, 'usuarios.json');

const lideresPorDefecto = [
    { user: "lider_academia", pass: "academia", faction: "academia", role: "Lider" },
    { user: "lider_fuego", pass: "fuego123", faction: "Fuego", role: "Lider" },
    { user: "lider_agua", pass: "agua123", faction: "Agua", role: "Lider" },
    { user: "lider_tierra", pass: "tierra123", faction: "Tierra", role: "Lider" }
];

// PROTECCIÓN DE LECTURA DE ARCHIVO
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
        console.error("Fallo de lectura de disco:", error);
        return [...lideresPorDefecto];
    }
}

function guardarUsuariosEnArchivo(lista) {
    try { 
        fs.writeFileSync(ARCHIVO_USUARIOS, JSON.stringify(lista, null, 2), 'utf8'); 
    } catch (error) {
        console.error("Fallo de escritura de disco:", error);
    }
}

// 🗺️ RUTAS DE VISTAS (Corregidas apuntando a la carpeta /public)

app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, 'public', 'index.html')); 
});

app.get('/altomando/login', (req, res) => { 
    res.sendFile(path.join(__dirname, 'public', 'login_lideres.html')); 
});

app.get('/:faccion/login', (req, res) => {
    if (['academia','fuego', 'agua', 'tierra'].includes(req.params.faccion.toLowerCase())) {
        res.sendFile(path.join(__dirname, 'public', 'login_facciosos.html'));
    } else { 
        res.status(404).send('<h1>Facción inexistente</h1>'); 
    }
});

app.get('/panel-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") return res.status(403).send("No autorizado");
    res.sendFile(path.join(__dirname, 'public', 'lider.html'));
});

// 🔒 ACCESO DE FACCIOSOS (Busca el archivo protegido en la raíz, FUERA de public)
app.get('/acceso-facciosos', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Miembro" || !req.session.faction) {
        return res.status(403).send("<h1>[ALERTA DE INTRUSO]: Autenticación criptográfica requerida.</h1>");
    }

    const divisionMiembro = req.session.faction.toLowerCase();
    const rutaArchivo = path.join(__dirname, `contenido_${divisionMiembro}.html`); // Se queda en la raíz por seguridad

    if (fs.existsSync(rutaArchivo)) {
        res.sendFile(rutaArchivo);
    } else {
        res.status(404).send(`<h1>[ERROR CENTRAL]: El archivo 'contenido_${divisionMiembro}.html' no se encuentra en el servidor central.</h1>`);
    }
});

// ⚡ ENDPOINTS DE LA API

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

app.get('/api/info-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") return res.status(403).json({ error: "No autorizado" });
    res.json({ faction: req.session.faction });
});

// GENERACIÓN DE TOKEN MULTIUSUARIO CON DURACIÓN DE 24 HORAS
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
    
    // Almacena el token y la fecha de creación exacta en milisegundos
    lista.push({ 
        token: tokenGenerado, 
        faction: faccionLider, 
        role: "TokenCompartido", 
        creadoEn: Date.now() 
    });
    
    guardarUsuariosEnArchivo(lista);

    res.json({ token: tokenGenerado, faction: faccionLider });
});

// LOGUEO POR TOKEN CON EXPIRACIÓN AUTOMÁTICA
app.post('/api/login-token', (req, res) => {
    try {
        const { token, factionUrl } = req.body;
        const lista = cargarUsuariosDeArchivo();

        // Buscar el token multiusuario válido
        const tokenValido = lista.find(u => u.token === token && u.role === "TokenCompartido");

        if (!tokenValido) {
            return res.status(401).json({ success: false, message: "El Token de acceso no existe." });
        }

        // CONTROL DE EXPIRACIÓN: Comprobamos si el token superó las 24 horas de vida
        const limite24Horas = 24 * 60 * 60 * 1000;
        const tiempoTranscurrido = Date.now() - tokenValido.creadoEn;

        if (tiempoTranscurrido > limite24Horas) {
            return res.status(401).json({ success: false, message: "⚠️ Este token ha expirado (Superó el límite de 24hs)." });
        }

        // VALIDACIÓN: Comprueba que la URL de facción por la que ingresa coincida con el token
        if (!tokenValido.faction || tokenValido.faction.toLowerCase() !== factionUrl.toLowerCase()) {
            return res.status(403).json({ success: false, message: `⚠️ Código inválido para la División ${factionUrl.toUpperCase()}.` });
        }

        // El usuario supera el filtro y hereda de forma independiente el rol de acceso
        req.session.usuarioLogueado = true;
        req.session.faction = tokenValido.faction;
        req.session.role = "Miembro";

        res.json({ success: true, redirect: '/acceso-facciosos' });
    } catch (err) {
        res.status(500).json({ success: false, message: "Falla temporal en el mainframe militar." });
    }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor militar asegurado en puerto ${PORT}`); });
