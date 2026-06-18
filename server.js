const express = require('express');
const session = require('express-session');
const compression = require('compression');
const path = require('path');
const app = express();

// ⚡ OPTIMIZACIÓN EN LA NUBE: Compresión de datos ultrarrápida
app.use(compression());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuración de Sesiones Seguras
app.use(session({
    secret: 'token_ancestral_facciones_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // La sesión expira en 1 día
}));

// ⚡ OPTIMIZACIÓN EN LA NUBE: Caché estática para carga instantánea (7 días)
app.use(express.static(path.join(__dirname), {
    maxAge: '7d',
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=604800');
    }
}));

// Base de Datos Centralizada con Líderes por Defecto
let usuarios = [
    { user: "lider_fuego", pass: "fuego123", faction: "Fuego", role: "Lider" },
    { user: "lider_agua", pass: "agua123", faction: "Agua", role: "Lider" },
    { user: "lider_tierra", pass: "tierra123", faction: "Tierra", role: "Lider" }
];

// URLs Secretas de Pantalla Completa para los Miembros
const urlsFacciones = {
    "Fuego": "https://grupo-cobra-macros.netlify.app/",
    "Agua": "https://ejemplo.com",
    "Tierra": "https://ejemplo.com"
};

// 🏰 PAGINA PRINCIPAL: Listado de selección de Facciones
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 🔑 RUTAS DE LOGIN INDIVIDUALES PARA CADA FACCIÓN
app.get('/:faccion/login', (req, res) => {
    const faccion = req.params.faccion.toLowerCase();
    if (['fuego', 'agua', 'tierra'].includes(faccion)) {
        res.sendFile(path.join(__dirname, 'login_facciosos.html'));
    } else {
        res.status(404).send('<h1>Facción inexistente</h1>');
    }
});

// 🔐 VALIDACIÓN DE LOGIN EXCLUSIVO POR FACCIÓN
app.post('/api/login-exclusivo', (req, res) => {
    const { user, pass, factionUrl } = req.body; // Recibe el usuario, clave y la página desde donde lo intenta
    
    const usuarioEncontrado = usuarios.find(u => u.user === user && u.pass === pass);

    if (usuarioEncontrado) {
        // 🔥 VALIDACIÓN CRÍTICA DE BANDO: El usuario debe coincidir con el login de su facción
        if (usuarioEncontrado.faction.toLowerCase() !== factionUrl.toLowerCase()) {
            return res.status(403).json({ success: false, message: `⚠️ ¡Acceso denegado! Tus credenciales no pertenecen a la Facción ${factionUrl}.` });
        }

        req.session.usuarioLogueado = true;
        req.session.faction = usuarioEncontrado.faction;
        req.session.role = usuarioEncontrado.role;
        
        if (usuarioEncontrado.role === "Lider") {
            res.json({ success: true, redirect: '/panel-lider' });
        } else {
            res.json({ success: true, redirect: '/acceso-facciosos' });
        }
    } else {
        res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos." });
    }
});

// 👑 SEGURIDAD: Panel de Control del Líder
app.get('/panel-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") {
        return res.status(403).send("<h1>Acceso Denegado: No eres líder.</h1>");
    }
    res.sendFile(path.join(__dirname, 'lider.html'));
});

app.get('/api/info-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") {
        return res.status(403).json({ error: "No autorizado" });
    }
    res.json({ faction: req.session.faction });
});

// 🎯 RECLUTAMIENTO: El Líder crea reclutas automáticos para su propio bando
app.post('/api/registrar-por-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") {
        return res.status(403).json({ error: "Acceso denegado." });
    }

    const faccionLider = req.session.faction; 
    const nuevoUsuario = "recluta_" + faccionLider.toLowerCase() + "_" + Math.floor(1000 + Math.random() * 9000);
    
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let nuevaContrasena = "";
    for (let i = 0; i < 8; i++) {
        nuevaContrasena += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }

    usuarios.push({ user: nuevoUsuario, pass: nuevaContrasena, faction: faccionLider, role: "Miembro" });
    res.json({ user: nuevoUsuario, pass: nuevaContrasena, faction: faccionLider });
});

// GUARDIÁN DE RUTAS OPTIMIZADO PARA EVITAR PANTALLAS NEGRAS
app.get('/acceso-facciosos', (req, res) => {
    if (!req.session.usuarioLogueado) {
        return res.status(403).send("<h1>Acceso Denegado: Inicia sesión primero.</h1>");
    }
    
    const faccionDelUsuario = req.session.faction;
    const urlDestino = urlsFacciones[faccionDelUsuario];

    // CORRECCIÓN: En lugar de forzar la redirección aquí, enviamos una página intermedia ultrarrápida
    // que obliga al navegador del celular a cargar la URL real de forma limpia.
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cargando Faccción...</title>
            <style>body { background: #121214; color: white; font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }</style>
        </head>
        <body>
            <div style="text-align: center;">
                <h2>Ingresando al santuario...</h2>
                <p>Si no redirige automáticamente, <a href="${urlDestino}" style="color: #007bff; font-weight: bold;">haz clic aquí</a></p>
            </div>
            <script>
                // Forzamos al navegador a limpiar memoria y cargar la URL real en pantalla completa
                window.location.replace("${urlDestino}");
            </script>
        </body>
        </html>
    `);
});


// ⚡ PUERTO DINÁMICO PARA RENDER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
});
