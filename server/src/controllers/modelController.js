import { readdir, readFile, mkdir, writeFile, unlink, access } from 'fs/promises';
import { join } from 'path';
import { prisma } from '../prisma/client.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { toPascal, findModelBlock, removeModelFromSchema, writeTempSchemaWithOutput, swapClient } from '../utils/modelUtils.js';
import { exec } from 'child_process';
import { loadAndRegisterRoutes, unregisterModelRoutes } from '../services/routeLoader.js';
import { promisify } from 'util';


const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// path of prisma schema and models directory
const modelsDir = join(__dirname, '../../prisma/generatedModels');
const schemaPath = join(__dirname, '../../prisma/schema.prisma');

let isPublishing = false;

// Utility to convert string to PascalCase
const typeMapping = {
    'string': 'String',
    'number': 'Int',
    'float': 'Float',
    'boolean': 'Boolean',
    'datetime': 'DateTime'
};

// Helper function to build Prisma model string efficiently
const buildPrismaModelString = (normalizedName, fields) => {
    const lines = [
        `\nmodel ${normalizedName} {`,
        `  id        Int      @id @default(autoincrement())`
    ];
    
    fields.forEach(field => {
        let line = `  ${field.name} ${typeMapping[field.type] || 'String'}`;
        if (!field.required) line += '?';
        if (field.unique) line += ' @unique';
        lines.push(line);
    });
    
    lines.push(`  createdAt DateTime @default(now())`);
    lines.push(`  updatedAt DateTime @updatedAt`);
    lines.push(`}\n`);
    
    return lines.join('\n');
};

const upsertModelInSchema = async (schemaPath, modelName, modelBlock) => {
    let schema = '';
    try {
        schema = await readFile(schemaPath, 'utf-8');
    } catch {
        schema = '';
    }

    const blockRegex = new RegExp(`model\\s+${modelName}\\s+\\{[\\s\\S]*?\\n\\}`, 'gm');
    
    // Optimize: Check and replace in one operation
    const newSchema = schema.replace(blockRegex, modelBlock.trim());
    
    if (newSchema === schema) {
        // Model not found, append it
        if (!schema.endsWith('\n')) schema += '\n';
        schema += '\n' + modelBlock.trim() + '\n';
    } else {
        schema = newSchema;
    }

    await writeFile(schemaPath, schema, 'utf-8');
};


// List all models from models/generated/*.json
export const getModels = async (req, res) => {
    try {
        const files = await readdir(modelsDir);
        // Filter JSON files first
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        // Read all files in parallel for better performance
        const fileReads = jsonFiles.map(async (file) => {
            try {
                const content = await readFile(join(modelsDir, file), 'utf-8');
                const json = JSON.parse(content);
                return { name: json.name, fields: json.fields, ownerField: json.ownerField || null };
            } catch (err) {
                console.error(`Failed to read model file ${file}:`, err);
                return null;
            }
        });
        
        const models = (await Promise.all(fileReads)).filter(Boolean);
        res.json(models);
    } catch {
        res.status(500).json({ message: 'Failed to retrieve models.' });
    }
};

// View a single model: JSON definition + Prisma model block
export const getModel = async (req, res) => {
    try {
        const name = toPascal(req.params.name);
        console.log('Fetching model:', name);
        const file = join(modelsDir, `${name}.json`);
        const content = await readFile(file, 'utf-8');
        const json = JSON.parse(content);
        const prismaModel = await findModelBlock(schemaPath, name);
        res.json({ json, prismaModel });
    } catch {
        res.status(404).json({ message: 'Model not found.' });
    }
};

export const publishModel = async (req, res) => {
    const { name, fields, ownerField, rbac } = req.body;
    const app = req.app;

    if (!name || !fields) {
        return res.status(400).json({ message: 'Model name and fields are required.' });
    }
    if (isPublishing) {
        return res.status(409).json({ message: 'Another model operation is in progress. Try again shortly.' });
    }

    const normalizedName = toPascal(name);
    const modelKey = normalizedName.toLowerCase();

    if (prisma[modelKey]) {
        return res.status(409).json({ message: `Model '${normalizedName}' already exists.` });
    }

    const modelJsonPath = join(modelsDir, `${normalizedName}.json`);
    const modelDefinition = { name: normalizedName, fields, ownerField, rbac, tableName: normalizedName.toLowerCase() + 's' };



    try {
        await writeFile(modelJsonPath, JSON.stringify(modelDefinition, null, 2));

        // Build Prisma model block efficiently
        const modelString = buildPrismaModelString(normalizedName, fields);

        await upsertModelInSchema(schemaPath, normalizedName, modelString);

        res.status(202).json({ message: `Publishing '${name}' started.` });

        // Background process to push DB changes, generate client, and register routes
        (async () => {
            try {
                await execPromise('npx prisma db push');
                await execPromise('npx prisma generate');
                await loadAndRegisterRoutes(app);
                console.log(`Model '${normalizedName}' published and endpoints generated.`);
            } catch (error) {
                console.error('Background publish failed:', error);
            } finally {
                isPublishing = false;
            }
        })();
    } catch (error) {
        await unlink(modelJsonPath).catch(() => { });
        isPublishing = false;
        res.status(500).json({ message: 'Error starting publish.', error: error.message });
    }
};

// Update model fields and republish (no rename via this endpoint)
export const updateModel = async (req, res) => {
    const app = req.app;
    const nameParam = req.params.name;
    const normalizedName = toPascal(nameParam);
    const { fields, ownerField, rbac } = req.body || {};
    if (!Array.isArray(fields)) {
        return res.status(400).json({ message: 'fields array is required.' });
    }
    if (isPublishing) {
        return res.status(409).json({ message: 'Another model operation is in progress. Try again shortly.' });
    }
    isPublishing = true;

    const modelJsonPath = join(modelsDir, `${normalizedName}.json`);
    try {
        const exists = await access(modelJsonPath).then(() => true).catch(() => false);
        if (!exists) {
            isPublishing = false;
            return res.status(404).json({ message: 'Model not found.' });
        }
        const current = JSON.parse(await readFile(modelJsonPath, 'utf-8'));
        const updated = { ...current, fields, ownerField: ownerField ?? current.ownerField, rbac: rbac ?? current.rbac };
        await writeFile(modelJsonPath, JSON.stringify(updated, null, 2));

        // Rebuild prisma block efficiently
        const modelString = buildPrismaModelString(normalizedName, fields);

        await upsertModelInSchema(schemaPath, normalizedName, modelString);

        res.status(202).json({ message: `Updating '${normalizedName}' started.` });

        (async () => {
            try {
                await execPromise('npx prisma db push');
                const buildsDir = join(__dirname, '../../generated/prisma_builds');
                await mkdir(buildsDir, { recursive: true });
                const outDir = join(buildsDir, String(Date.now()));
                const tmpSchema = await writeTempSchemaWithOutput(schemaPath, outDir);
                await execPromise(`npx prisma generate --schema "${tmpSchema}"`);
                await swapClient(outDir);
                await loadAndRegisterRoutes(app);
                console.log(`Model '${normalizedName}' updated and endpoints refreshed.`);
            } catch (e) {
                console.error('Background update failed:', e);
            } finally {
                isPublishing = false;
            }
        })();
    } catch (e) {
        isPublishing = false;
        res.status(500).json({ message: 'Update failed.', error: e.message });
    }
};

// Delete a model: remove JSON and Prisma block, drop table, unregister routes
export const deleteModel = async (req, res) => {
    const app = req.app;
    const normalizedName = toPascal(req.params.name);
    const modelJsonPath = join(modelsDir, `${normalizedName}.json`);
    if (isPublishing) {
        return res.status(409).json({ message: 'Another model operation is in progress. Try again shortly.' });
    }
    isPublishing = true;

    try {
        // Remove file (if exists)
        await unlink(modelJsonPath).catch(() => { });
        // Remove schema block
        await removeModelFromSchema(schemaPath, normalizedName);

        // Respond immediately
        res.status(202).json({ message: `Deletion of '${normalizedName}' started.` });

        (async () => {
            try {
                // Accept data loss to drop table on db push
                await execPromise('npx prisma db push --accept-data-loss');
                const buildsDir = join(__dirname, '../../generated/prisma_builds');
                await mkdir(buildsDir, { recursive: true });
                const outDir = join(buildsDir, String(Date.now()));
                const tmpSchema = await writeTempSchemaWithOutput(schemaPath, outDir);
                await execPromise(`npx prisma generate --schema "${tmpSchema}"`);
                await swapClient(outDir);

                // Unregister routes for this model and refresh any remaining routes
                unregisterModelRoutes(app, normalizedName);
                await loadAndRegisterRoutes(app);

                console.log(`Model '${normalizedName}' deleted and endpoints removed.`);
            } catch (e) {
                console.error('Background delete failed:', e);
            } finally {
                isPublishing = false;
            }
        })();
    } catch (e) {
        isPublishing = false;
        res.status(500).json({ message: 'Deletion failed.', error: e.message });
    }
};
