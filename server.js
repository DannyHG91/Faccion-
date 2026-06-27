require('dotenv').config();
const express = require('express');
const session = require('express-session');
const compression = require('compression');
const path = require('path');
const { MongoClient } = require('mongodb'); // Importamos MongoDB

const app = express();

// 1. CONEXIÓN A LA BASE DE DATOS EN LA NUBE
// Guarda tu URI de Mongo en las variables de entorno de Render para protegerla
const MONGO_URI = process.env.MONGO_URI || "TU_CADENA_DE_CONEXION_DE_MONGODB_AQUI";
const client = new MongoClient(MONGO_URI);
let db, usuariosCollection;

async function conectarBaseDeDatos() {
    try {
        await client.connect();
        db = client.db('sistema_facciones');
        usuariosCollection = db.collection('usuarios_y_tokens');
        console.log("🛡️ Mainframe conectado a la Base de Datos en la Nube (MongoDB)");
        
        // Insertar líderes por defecto si la base de datos está completamente vacía
        const conteo = await usuariosCollection.countDocuments();
        if (conteo === 0) {
            const lideresPorDefecto = [
                { user: "lider_academia", pass: "academia", faction: "academia", role: "Lider" },
                { user: "lider_fuego", pass: "fuego123", faction: "Fuego", role: "Lider" },
                { user: "lider_agua", pass: "agua123", faction: "Agua", role: "Lider" },
                { user: "lider_tierra", pass: "tierra123", faction: "Tierra", role: "Lider" }
            ];
            await usuariosCollection.insertMany(lideresPorDefecto);
        }
    } catch (error) {
        console.error("❌ Error conectando a MongoDB:", error);
    }
}
conectarBaseDeDatos();

// Middlewares estándar
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'token_ancestral_facciones_2026',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

// ⚡ ENDPOINT: GENERAR TOKEN (Se guarda directo en la nube)
app.post('/api/generar-token', async (req, res) => {
    if (!req.session.usuarioLogueado || req.session.role !== "Lider") return res.status(403).json({ error: "Denegado" });

    const faccionLider = req.session.faction;
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let bloque1 = "", bloque2 = "";
    for (let i = 0; i < 4; i++) {
        bloque1 += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        bloque2 += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    const tokenGenerado = `${faccionLider.toUpperCase()}-${bloque1}-${bloque2}`;

    try {
        // 🧹 MANTENIMIENTO: Borra de la nube los tokens viejos de más de 24 horas automáticamente
        const limite24Horas = 24 * 60 * 60 * 1000;
        const tiempoCorte = Date.now() - limite24Horas;
        await usuariosCollection.deleteMany({ role: "TokenCompartido", creadoEn: { $lt: tiempoCorte } });

        // Guardar el nuevo token en la nube
        await usuariosCollection.insertOne({
            token: tokenGenerado,
            faction: faccionLider,
            role: "TokenCompartido",
            creadoEn: Date.now()
        });

        res.json({ token: tokenGenerado, faction: faccionLider });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar el token en la nube." });
    }
});

// ⚡ ENDPOINT: LOGIN POR TOKEN (Busca directo en la nube)
app.post('/api/login-token', async (req, res) => {
    try {
        const { token, factionUrl } = req.body;
        
        // Buscar el token en MongoDB
        const tokenValido = await usuariosCollection.findOne({ 
            token: token.trim().toUpperCase(), 
            role: "TokenCompartido" 
        });

        if (!tokenValido) {
            return res.status(401).json({ success: false, message: "El Token de acceso no existe." });
        }

        // Control de expiración (24 Horas)
        const limite24Horas = 24 * 60 * 60 * 1000;
        if ((Date.now() - Number(tokenValido.creadoEn)) > limite24Horas) {
            return res.status(401).json({ success: false, message: "⚠️ Este token ha expirado." });
        }

        if (tokenValido.faction.toLowerCase() !== factionUrl.toLowerCase()) {
            return res.status(403).json({ success: false, message: `⚠️ Código inválido para la División ${factionUrl.toUpperCase()}.` });
        }

        req.session.usuarioLogueado = true;
        req.session.faction = tokenValido.faction;
        req.session.role = "Miembro";

        res.json({ success: true, redirect: '/acceso-facciosos' });
    } catch (err) {
        res.status(500).json({ success: false, message: "Falla en el mainframe de la base de datos." });
    }
});

// (Mantén tus otras rutas / y /acceso-facciosos igual que antes...)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Servidor asegurado con persistencia en la nube en puerto ${PORT}`); });