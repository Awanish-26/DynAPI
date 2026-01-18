import express, { json } from 'express';
import { config } from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import cors from "cors";
import { loadAndRegisterRoutes } from './services/routeLoader.js';

config();

const app = express();
const port = process.env.PORT;
const corsOrigin = process.env.CORS_ORIGIN;

// Middleware
app.use(cors({
    origin: corsOrigin,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));
app.use(json());

// Await dynamic routes before registering other routers and the 404 handler
(async function bootstrap() {
    try {

        app.use('/api', apiRoutes);
        app.use('/auth', authRoutes);
        await loadAndRegisterRoutes(app);

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
