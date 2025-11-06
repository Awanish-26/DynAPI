const express = require('express');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const cors = require("cors");
const { loadAndRegisterRoutes } = require('./services/routeLoader');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Middleware
app.use(cors({
    origin: corsOrigin,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(express.json());

// Await dynamic routes before registering other routers and the 404 handler
(async function bootstrap() {
    try {
        await loadAndRegisterRoutes(app); // important

        app.use('/auth', authRoutes);
        app.use('/api', apiRoutes);

        app.get('/health', (req, res) => {
            res.send('Running Smoothly !!!');
        });

        // 404 handler after all routes
        app.use((req, res) => {
            res.status(404).json({ success: false, message: "Route not found" });
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

        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error('Failed to bootstrap server', err);
        process.exit(1);
    }
})();
