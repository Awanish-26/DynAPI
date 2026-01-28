import { Router } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors';
import { prisma } from '../prisma/client.js';
import authenticateToken from '../middleware/authMiddleware.js';
import checkPermissions from '../middleware/rbacMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const modelsDir = join(__dirname, '../../prisma/generatedModels');

// This object will keep track of registered routes to avoid duplicates
const registeredRoutes = new Set();

export const loadAndRegisterRoutes = async (app) => {
    try {
        const files = await readdir(modelsDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        // Read all model definitions in parallel for better performance
        const modelDefinitions = await Promise.all(
            jsonFiles.map(async (file) => {
                try {
                    const modelName = basename(file, '.json');
                    const content = await readFile(join(modelsDir, file), 'utf-8');
                    const definition = JSON.parse(content);
                    return { modelName, definition };
                } catch (err) {
                    console.error(`Failed to load model from ${file}:`, err);
                    return null;
                }
            })
        );

        // Register routes for each valid model
        for (const item of modelDefinitions) {
            if (!item) continue;
            
            const { modelName, definition: modelDefinition } = item;
            const routePath = `/api/${modelName.toLowerCase()}`;
            
            if (registeredRoutes.has(routePath)) continue;

            const router = Router();

            // Resolve Prisma delegate (Prisma uses lowerCamelCase)
            const toLowerCamel = (s) => s.charAt(0).toLowerCase() + s.slice(1);
            const base = toLowerCamel(modelName);
            const candidates = [
                modelDefinition?.prismaModel ? toLowerCamel(modelDefinition.prismaModel) : null,
                base,                                                     // e.g. students
                base.endsWith('ies') ? base.slice(0, -3) + 'y' : null,   // categories -> category
                base.endsWith('s') ? base.slice(0, -1) : null            // students -> student
            ].filter(Boolean);

            const delegateName = candidates.find((n) => prisma[n]);
            if (!delegateName) {
                console.warn(`No Prisma delegate for ${modelName}. Tried: ${candidates.join(', ')}. Skipping ${routePath}`);
                continue;
            }
            const delegate = prisma[delegateName];
            console.log(`Setting up routes for model: ${modelName} using delegate: ${delegateName}`);

            // Generic CRUD handlers (use next so global error handler catches issues)
            const handlers = {
                getAll: (req, res, next) =>
                    delegate.findMany().then(d => res.json(d)).catch(next),
                getOne: (req, res, next) =>
                    delegate.findUnique({ where: { id: Number(req.params.id) } }).then(d => res.json(d)).catch(next),
                create: (req, res, next) => {
                    const data = { ...req.body };
                    if (modelDefinition.ownerField && req.user) {
                        data[modelDefinition.ownerField] = req.user.userId;
                    }
                    delegate.create({ data }).then(d => res.status(201).json(d)).catch(next);
                },
                update: (req, res, next) =>
                    delegate.update({ where: { id: Number(req.params.id) }, data: req.body }).then(d => res.json(d)).catch(next),
                deleteOne: (req, res, next) =>
                    delegate.delete({ where: { id: Number(req.params.id) } }).then(() => res.status(204).send()).catch(next),
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
        if (error.code !== 'ENOENT') {
            console.error('Failed to load dynamic routes:', error);
        }
    }
};

export function unregisterModelRoutes(app, modelName) {
    const base = `/api/${modelName.toLowerCase()}`;
    try {
        if (app && app._router && Array.isArray(app._router.stack)) {
            app._router.stack = app._router.stack.filter((layer) => {
                if (layer?.route?.path && String(layer.route.path).startsWith(base)) return false;
                if (layer?.name === 'router' && layer?.regexp && layer.regexp.toString().includes(base)) return false;
                return true;
            });
        }
        if (typeof registeredRoutes !== 'undefined' && registeredRoutes?.delete) {
            registeredRoutes.delete(base);
        }
        console.log(`Unregistered routes for ${base}`);
    } catch (e) {
        console.error('Failed to unregister routes:', e);
    }
}