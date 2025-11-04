const express = require('express');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const cors = require("cors");

const { loadAndRegisterRoutes } = require('./services/routeLoader');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: "http://localhost:5173",
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

app.use(express.json());
app.use('/api', apiRoutes);
app.use('/auth', authRoutes);

app.get('/health', (req, res) => {
    res.send('Running Smoothly !!!');
});

// 404 handler (must come after all app.use('/api/...'))
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Global error:", err);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});

loadAndRegisterRoutes(app).then(() => {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
});