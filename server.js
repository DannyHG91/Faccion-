const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'clave_secreta_facciones_2026',
    resave: false,
    saveUninitialized: true
}));

// Base de datos simulada con Roles: "Lider" o "Miembro"
let usuarios = [
    { user: "lider_cobra", pass: "cobra123", faction: "cobra", role: "Lider" },
    { user: "lider_agua", pass: "agua123", faction: "Agua", role: "Lider" },
    { user: "lider_tierra", pass: "tierra123", faction: "Tierra", role: "Lider" }
];

const urlsFacciones = {
    "Cobra": "https://grupo-cobra-macros.netlify.app/",
    "Agua": "https://ejemplo.com",
    "Tierra": "https://ejemplo.com"
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// LOGIN: Identifica si es Líder o Miembro común
app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const usuarioEncontrado = usuarios.find(u => u.user === user && u.pass === pass);

    if (usuarioEncontrado) {
        req.session.usuarioLogueado = true;
        req.session.faction = usuarioEncontrado.faction;
        req.session.role = usuarioEncontrado.role; // Guardamos el rol en la sesión segura
        
        if (usuarioEncontrado.role === "Lider") {
            // Si es líder, va al panel de control de su facción
            res.json({ success: true, redirect: '/panel-lider' });
        } else {
            // Si es miembro común, va directo a la URL de pantalla completa
            res.json({ success: true, redirect: '/acceso-facciosos' });
        }
    } else {
        res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos." });
    }
});

// PANEL DEL LÍDER: Solo accesible si el rol verificado es "Lider"
app.get('/panel-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") {
        return res.status(403).send("<h1>Acceso Denegado: No eres líder de ninguna facción.</h1>");
    }
    res.sendFile(path.join(__dirname, 'lider.html'));
});

// RUTA DEL SERVIDOR PARA OBTENER LOS DATOS DEL LÍDER ACTUAL
app.get('/api/info-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") {
        return res.status(403).json({ error: "No autorizado" });
    }
    res.json({ faction: req.session.faction });
});

// REGISTRO RESTRINGIDO: El servidor fuerza que el nuevo usuario herede la facción del líder logueado
app.post('/api/registrar-por-lider', (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") {
        return res.status(403).json({ error: "Acceso denegado. Solo los líderes pueden hacer esto." });
    }

    // Seguridad estricta: Ignoramos cualquier facción que envíe el navegador, usamos la de la SESIÓN del líder
    const faccionAutomatica = req.session.faction; 
    const nuevoUsuario = "miembro_" + faccionAutomatica.toLowerCase() + "_" + Math.floor(1000 + Math.random() * 9000);
    
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let nuevaContrasena = "";
    for (let i = 0; i < 8; i++) {
        nuevaContrasena += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }

    usuarios.push({ 
        user: nuevoUsuario, 
        pass: nuevaContrasena, 
        faction: faccionAutomatica, 
        role: "Miembro" // Se crea como miembro común
    });
    
    res.json({ user: nuevoUsuario, pass: nuevaContrasena, faction: faccionAutomatica });
});

// ACCESO MIEMBROS: Redirección estricta según facción
app.get('/acceso-facciosos', (req, res) => {
    if (!req.session.usuarioLogueado) {
        return res.status(403).send("<h1>Acceso Denegado: Inicia sesión primero.</h1>");
    }

    const faccionDelUsuario = req.session.faction;
    const urlDestino = urlsFacciones[faccionDelUsuario];

    if (urlDestino) {
        res.redirect(urlDestino);
    } else {
        res.status(404).send("Error: Facción no encontrada.");
    }
});

// CERRAR SESIÓN
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(3000, () => {
    console.log('Servidor corriendo de forma segura en http://localhost:3000');
});