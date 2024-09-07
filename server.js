// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cors = require('cors'); // Importar cors
const app = express();
const PORT = process.env.PORT || 3000;

// Usar cors para todas las solicitudes
app.use(cors());

// Middleware
app.use(bodyParser.json());

// Simulated Database (use an actual database in production)
const users = [];

// Register Endpoint
app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Basic server-side validation
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }

        // Validate email format
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            return res.status(400).json({ message: 'Correo electrónico no válido.' });
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Store the user (replace with actual database logic)
        users.push({ username, email, password: hashedPassword });

        res.status(201).json({ message: 'Registro exitoso.' });

    } catch (error) {
        res.status(500).json({ message: 'Error en el registro. Inténtalo de nuevo.' });
    }
});

// Login Endpoint
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Basic server-side validation
        if (!username || !password) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }

        // Find user (replace with actual database logic)
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ message: 'Nombre de usuario o contraseña incorrectos.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Nombre de usuario o contraseña incorrectos.' });
        }

        res.status(200).json({ message: 'Inicio de sesión exitoso.' });

    } catch (error) {
        res.status(500).json({ message: 'Error en el inicio de sesión. Inténtalo de nuevo.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
