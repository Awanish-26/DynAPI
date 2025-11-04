const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
const prisma = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { checkPermissions } = require('../middleware/rbac');

const modelsDir = path.join(__dirname, '../models/generated');

// This object will keep track of registered routes to avoid duplicates
const registeredRoutes = new Set();

const loadAndRegisterRoutes = async (app) => {
    try {
        const files = await fs.readdir(modelsDir);

        for (const file of files) {
            if (!file.endsWith('.json')) continue;

            const modelName = path.basename(file, '.json');
            const routePath = `/api/${modelName.toLowerCase()}`;
            if (registeredRoutes.has(routePath)) continue;

            const modelDefinition = JSON.parse(await fs.readFile(path.join(modelsDir, file), 'utf-8'));
            const router = express.Router();

            // Use Prisma delegate in lowerCamelCase
            const delegate = modelName.charAt(0).toLowerCase() + modelName.slice(1);

            // Generic CRUD handlers
            const handlers = {
                getAll: (req, res) => prisma[delegate].findMany().then(d => res.json(d)).catch(e => res.status(500).json(e)),
                getOne: (req, res) => prisma[delegate].findUnique({ where: { id: parseInt(req.params.id) } }).then(d => res.json(d)).catch(e => res.status(500).json(e)),
                create: (req, res) => {
                    const data = req.body;
                    if (modelDefinition.ownerField) {
                        data[modelDefinition.ownerField] = req.user.userId;
                    }
                    prisma[delegate].create({ data }).then(d => res.status(201).json(d)).catch(e => res.status(500).json(e));
                },
                update: (req, res) => prisma[delegate].update({ where: { id: parseInt(req.params.id) }, data: req.body }).then(d => res.json(d)).catch(e => res.status(500).json(e)),
                deleteOne: (req, res) => prisma[delegate].delete({ where: { id: parseInt(req.params.id) } }).then(() => res.status(204).send()).catch(e => res.status(500).json(e)),
            };

            // Apply middleware
            const permissionMiddleware = checkPermissions(modelDefinition);
            router.use(cors());
            router.use(authenticateToken);
            router.use(permissionMiddleware);

            // Define routes
            router.get('/', handlers.getAll);
            router.post('/', handlers.create);
            router.get('/:id', handlers.getOne);
            router.put('/:id', handlers.update);
            router.delete('/:id', handlers.deleteOne);

            app.use(routePath, router);
            registeredRoutes.add(routePath);
            console.log(`Registered routes for ${modelName} at ${routePath}`);
        }
    } catch (error) {
        if (error.code !== 'ENOENT') { // Ignore if 'models' directory doesn't exist yet
            console.error('Failed to load dynamic routes:', error);
        }
    }
};

// Remove all routes for a specific model (base path: /api/{model})
function unregisterModelRoutes(app, modelName) {
    const base = `/api/${modelName.toLowerCase()}`;
    try {
        if (app && app._router && Array.isArray(app._router.stack)) {
            app._router.stack = app._router.stack.filter((layer) => {
                // Direct route
                if (layer?.route?.path && String(layer.route.path).startsWith(base)) return false;
                // Mounted router detection
                if (layer?.name === 'router' && layer?.regexp && layer.regexp.toString().includes(base)) return false;
                return true;
            });
        }
        // If you track a Set of registered routes, drop it:
        if (typeof registeredRoutes !== 'undefined' && registeredRoutes?.delete) {
            registeredRoutes.delete(base);
        }
        console.log(`Unregistered routes for ${base}`);
    } catch (e) {
        console.error('Failed to unregister routes:', e);
    }
}

module.exports = { loadAndRegisterRoutes, unregisterModelRoutes };