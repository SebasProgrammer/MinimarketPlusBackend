const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a la base de datos usando URL externa
const pool = new Pool({
    connectionString: 'postgresql://minimarketplus_user:PgMv08yNE01VplusUukNrpkkGbEZgFsP@dpg-crdtnklsvqrc73fb3fpg-a.oregon-postgres.render.com/minimarketplus',
    ssl: {
        rejectUnauthorized: false // Esto es necesario si tu base de datos requiere SSL
    }
});

// Función para crear la tabla `users` si no existe
const createUsersTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabla `users` creada o ya existe.");
    } catch (error) {
        console.error("Error al crear la tabla `users`:", error.message);
    }
};

// Llama a la función para crear la tabla al iniciar el servidor
createUsersTable();

// Usar cors para todas las solicitudes
app.use(cors());

// Middleware
app.use(bodyParser.json());

// Check for duplicates
const checkForDuplicates = async (username, email) => {
    const result = await pool.query('SELECT 1 FROM users WHERE username = $1 OR email = $2 LIMIT 1', [username, email]);
    return result.rowCount > 0;
};

// Register Endpoint
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return res.status(400).json({ message: 'Correo electrónico no válido.' });
        }

        // Check for duplicates
        if (await checkForDuplicates(username, email)) {
            return res.status(409).json({ message: 'El nombre de usuario o el correo electrónico ya están en uso.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
            [username, email, hashedPassword]
        );

        res.status(201).json({ message: 'Registro exitoso.' });

    } catch (error) {
        console.error('Error en el registro:', error.message);
        res.status(500).json({ message: 'Error en el registro. Inténtalo de nuevo.' });
    }
});

// Login Endpoint
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }

        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ message: 'Nombre de usuario o contraseña incorrectos.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Nombre de usuario o contraseña incorrectos.' });
        }

        res.status(200).json({ message: 'Inicio de sesión exitoso.' });

    } catch (error) {
        console.error('Error en el inicio de sesión:', error.message);
        res.status(500).json({ message: 'Error en el inicio de sesión. Inténtalo de nuevo.' });
    }
});

app.get('/ping', async (req, res) => {
    const result = await pool.query('SELECT * from users');
    console.log(result)
    return res.json(result.rows);
});

app.delete('/delete-users', async (req, res) => {
    try {
        await pool.query('DELETE FROM users');
        res.status(200).json({ message: 'Todos los datos de la tabla users han sido eliminados.' });
    } catch (error) {
        console.error('Error al eliminar datos:', error.message);
        res.status(500).json({ message: 'Error al eliminar datos.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
