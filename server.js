const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a la base de datos
const pool = new Pool({
    connectionString: 'postgresql://minimarketplus_user:PgMv08yNE01VplusUukNrpkkGbEZgFsP@dpg-crdtnklsvqrc73fb3fpg-a.oregon-postgres.render.com/minimarketplus',
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Crear la tabla `users` si no existe
const createUsersTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                reset_token VARCHAR(255),
                reset_token_expiry TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabla `users` creada o ya existe.");
    } catch (error) {
        console.error("Error al crear la tabla `users`:", error.message);
    }
};

// Alterar la tabla `users` para agregar las columnas faltantes si no existen
const alterUsersTable = async () => {
    try {
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP;
        `);
        console.log("Tabla `users` modificada correctamente.");
    } catch (error) {
        console.error("Error al modificar la tabla `users`:", error.message);
    }
};

// Llama a las funciones para crear o modificar la tabla al iniciar el servidor
createUsersTable();
alterUsersTable();

const validatePassword = (password) => {
    const minLength = 8;
    const maxLength = 16;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[\W_]/.test(password);
    return password.length >= minLength &&
        password.length <= maxLength &&
        hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
};

// Función para verificar duplicados de usuario o correo
const checkForDuplicates = async (username, email) => {
    const result = await pool.query(
        'SELECT 1 FROM users WHERE username = $1 OR email = $2 LIMIT 1',
        [username, email]
    );
    return result.rowCount > 0;
};


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

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sebastian.arana2016@gmail.com',  // Cambia por tu correo
        pass: 'kdjsdmjihvccardr'                // Cambia por tu contraseña de aplicación
    }
});

// Función auxiliar para buscar un usuario por token
const findUserByToken = async (token) => {
    const result = await pool.query('SELECT * FROM users WHERE reset_token = $1', [token]);
    return result.rows[0];
};

// Endpoint de prueba
app.get('/ping', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users');
        return res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener los usuarios:', error);
        return res.status(500).json({ message: 'Error al obtener los usuarios.' });
    }
});

// Eliminar todos los usuarios (Solo para desarrollo)
app.delete('/delete-users', async (req, res) => {
    try {
        await pool.query('DELETE FROM users');
        res.status(200).json({ message: 'Todos los datos de la tabla users han sido eliminados.' });
    } catch (error) {
        console.error('Error al eliminar datos:', error.message);
        res.status(500).json({ message: 'Error al eliminar datos.' });
    }
});

// Buscar usuario por correo
app.get('/user-by-email/:email', async (req, res) => {
    const { email } = req.params;

    try {
        // Buscar el usuario en la base de datos
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        // Verificar si se encontró el usuario
        if (!user) {
            return res.status(404).json({ message: 'No se encontró un usuario con ese correo electrónico.' });
        }

        // Devolver la información del usuario
        return res.status(200).json(user);
    } catch (error) {
        console.error('Error al buscar el usuario por correo:', error);
        return res.status(500).json({ message: 'Ocurrió un error al buscar el usuario.' });
    }
});

// Buscar usuario por token
app.get('/user-token/:token', async (req, res) => {
    const { token } = req.params;

    try {
        // Buscar el usuario utilizando la función auxiliar
        const user = await findUserByToken(token);

        // Verificar si se encontró el usuario
        if (!user) {
            return res.status(404).json({ message: 'No se encontró un usuario con ese token.' });
        }

        // Devolver la información del usuario
        return res.status(200).json(user);
    } catch (error) {
        console.error('Error al buscar el usuario por token:', error);
        return res.status(500).json({ message: 'Ocurrió un error al buscar el usuario.' });
    }
});

// Restablecimiento de contraseña (Solicitud de Reset)
app.post('/reset-password', async (req, res) => {
    const { email } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'El correo electrónico no está registrado.' });
        }

        // Limpiar el token anterior
        await pool.query(
            'UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE email = $1',
            [email]
        );

        // Generar nuevo token
        const token = crypto.randomBytes(20).toString('hex');
        
        // Definir la expiración del token en la zona horaria de Lima, Perú
        const expireDate = moment.tz(Date.now() + 50800000, "America/Lima").toDate(); // 3 horas de validez

        // Actualizar la base de datos con el token y la fecha de expiración
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE email = $3',
            [token, expireDate, email]
        );

        // Enviar correo con el token
        const resetUrl = `https://minimarketplus.netlify.app/reset.html?token=${token}`;

        await transporter.sendMail({
            to: email,
            subject: 'Restablecimiento de contraseña - Minimarket Plus',
            text: `Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace: ${resetUrl}`,
        });

        res.status(200).json({ message: 'Enlace de restablecimiento enviado a tu correo electrónico.' });
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        res.status(500).json({ message: 'Ocurrió un error al intentar enviar el enlace de restablecimiento.' });
    }
});


// Restablecimiento de contraseña (Actualizar Contraseña)
app.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    try {
        // Buscar el usuario utilizando la función auxiliar
        const user = await findUserByToken(token);

        // Verificar si se encontró el usuario
        if (!user) {
            return res.status(400).json({ message: 'Token no válido o expirado.' });
        }

        // Verificar si la nueva contraseña cumple con los requisitos de seguridad
        if (!validatePassword(newPassword)) {
            return res.status(400).json({ message: 'La nueva contraseña no cumple con los requisitos de seguridad.' });
        }

        // Hashear la nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Actualizar la contraseña y limpiar el token
        await pool.query(
            'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        res.status(200).json({ message: 'Contraseña actualizada con éxito.' });
    } catch (error) {
        console.error('Error al restablecer la contraseña:', error);
        res.status(500).json({ message: 'Error al restablecer la contraseña. Inténtalo más tarde.' });
    }
});





// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});

