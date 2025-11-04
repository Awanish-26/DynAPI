const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { loadAndRegisterRoutes, unregisterModelRoutes } = require('../services/routeLoader');
const { swapClient } = require('../prisma/clientManager');

const execPromise = util.promisify(exec);
const modelsDir = path.join(__dirname, '../models/generated');
const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');

// Prevent concurrent publishes in-process
let isPublishing = false;

// Helper to replace existing model block or append if not present
const upsertModelInSchema = async (schemaPath, modelName, modelBlock) => {
    let schema = '';
    try {
        schema = await fs.readFile(schemaPath, 'utf-8');
    } catch {
        schema = '';
    }
    const blockRegex = new RegExp(`\\nmodel\\s+${modelName}\\s+\\{[\\s\\S]*?\\n\\}`, 'g');

    if (blockRegex.test(schema)) {
        schema = schema.replace(blockRegex, '\n' + modelBlock.trim() + '\n');
    } else {
        if (!schema.endsWith('\n')) schema += '\n';
        schema += modelBlock + '\n';
    }
    await fs.writeFile(schemaPath, schema, 'utf-8');
};

// A map to convert JSON types to Prisma types
const typeMapping = {
    string: 'String',
    number: 'Int', // Defaulting number to Int, can be extended for Float
    boolean: 'Boolean',
    datetime: 'DateTime',
};

async function writeTempSchemaWithOutput(baseSchemaPath, outDir) {
    const schema = await fs.readFile(baseSchemaPath, 'utf-8');
    const generatorBlockRegex = /generator\s+client\s+\{[\s\S]*?\}/m;
    const replaced = schema.replace(generatorBlockRegex, (block) => {
        let b = block;
        const out = outDir.replace(/\\/g, '\\\\');
        if (/output\s*=/.test(b)) {
            b = b.replace(/output\s*=.*$/m, `output = "${out}"`);
        } else {
            b = b.replace(/\}$/, `  output = "${out}"\n}`);
        }
        return b;
    });
    const tmpDir = path.join(path.dirname(baseSchemaPath), '.tmp');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpSchema = path.join(tmpDir, `schema.publish.${Date.now()}.prisma`);
    await fs.writeFile(tmpSchema, replaced, 'utf-8');
    return tmpSchema;
}

const toPascal = (s = '') => s ? s[0].toUpperCase() + s.slice(1) : s;

const findModelBlock = async (schemaPath, modelName) => {
    const schema = await fs.readFile(schemaPath, 'utf-8').catch(() => '');
    const blockRegex = new RegExp(`\\nmodel\\s+${modelName}\\s+\\{[\\s\\S]*?\\n\\}`, 'm');
    const match = schema.match(blockRegex);
    return match ? match[0].trim() : null;
};

const removeModelFromSchema = async (schemaPath, modelName) => {
    let schema = await fs.readFile(schemaPath, 'utf-8').catch(() => '');
    const blockRegex = new RegExp(`\\nmodel\\s+${modelName}\\s+\\{[\\s\\S]*?\\n\\}`, 'g');
    const next = schema.replace(blockRegex, '\n');
    if (next !== schema) {
        await fs.writeFile(schemaPath, next, 'utf-8');
        return true;
    }
    return false;
};

// List all models from models/generated/*.json
const getModels = async (req, res) => {
    try {
        const files = await fs.readdir(modelsDir);
        const models = [];
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const content = await fs.readFile(path.join(modelsDir, file), 'utf-8');
            const json = JSON.parse(content);
            models.push({ name: json.name, fields: json.fields, ownerField: json.ownerField || null });
        }
        res.json(models);
    } catch {
        res.status(500).json({ message: 'Failed to retrieve models.' });
    }
};

// View a single model: JSON definition + Prisma model block
const getModel = async (req, res) => {
    try {
        const name = toPascal(req.params.name);
        const file = path.join(modelsDir, `${name}.json`);
        const content = await fs.readFile(file, 'utf-8');
        const json = JSON.parse(content);
        const prismaModel = await findModelBlock(schemaPath, name);
        res.json({ json, prismaModel });
    } catch {
        res.status(404).json({ message: 'Model not found.' });
    }
};

const publishModel = async (req, res) => {
    const { name, fields, ownerField, rbac } = req.body;
    const app = req.app;

    if (!name || !fields) {
        return res.status(400).json({ message: 'Model name and fields are required.' });
    }
    if (isPublishing) {
        return res.status(409).json({ message: 'Another model operation is in progress. Try again shortly.' });
    }
    isPublishing = true;

    const normalizedName = toPascal(name);
    const modelJsonPath = path.join(modelsDir, `${normalizedName}.json`);
    const modelDefinition = { name: normalizedName, fields, ownerField, rbac, tableName: normalizedName.toLowerCase() + 's' };

    try {
        await fs.mkdir(modelsDir, { recursive: true });
        await fs.writeFile(modelJsonPath, JSON.stringify(modelDefinition, null, 2));

        // Build Prisma model block
        let modelString = `\nmodel ${normalizedName} {\n`;
        modelString += `  id        Int      @id @default(autoincrement())\n`;
        fields.forEach(field => {
            let line = `  ${field.name} ${typeMapping[field.type] || 'String'}`;
            if (!field.required) line += '?';
            if (field.unique) line += ' @unique';
            modelString += line + '\n';
        });
        modelString += `  createdAt DateTime @default(now())\n`;
        modelString += `  updatedAt DateTime @updatedAt\n`;
        modelString += `}\n`;

        await upsertModelInSchema(schemaPath, normalizedName, modelString);

        res.status(202).json({ message: `Publishing '${normalizedName}' started.` });

        (async () => {
            try {
                await execPromise('npx prisma db push --skip-generate');
                const buildsDir = path.join(__dirname, '../../generated/prisma_builds');
                await fs.mkdir(buildsDir, { recursive: true });
                const outDir = path.join(buildsDir, String(Date.now()));
                const tmpSchema = await writeTempSchemaWithOutput(schemaPath, outDir);
                await execPromise(`npx prisma generate --schema "${tmpSchema}"`);
                await swapClient(outDir);
                await loadAndRegisterRoutes(app);
                console.log(`Model '${normalizedName}' published and endpoints generated.`);
            } catch (error) {
                console.error('Background publish failed:', error);
            } finally {
                isPublishing = false;
            }
        })();
    } catch (error) {
        await fs.unlink(modelJsonPath).catch(() => { });
        isPublishing = false;
        res.status(500).json({ message: 'Error starting publish.', error: error.message });
    }
};

// Update model fields and republish (no rename via this endpoint)
const updateModel = async (req, res) => {
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

    const modelJsonPath = path.join(modelsDir, `${normalizedName}.json`);
    try {
        const exists = await fs.access(modelJsonPath).then(() => true).catch(() => false);
        if (!exists) {
            isPublishing = false;
            return res.status(404).json({ message: 'Model not found.' });
        }
        const current = JSON.parse(await fs.readFile(modelJsonPath, 'utf-8'));
        const updated = { ...current, fields, ownerField: ownerField ?? current.ownerField, rbac: rbac ?? current.rbac };
        await fs.writeFile(modelJsonPath, JSON.stringify(updated, null, 2));

        // Rebuild prisma block
        let modelString = `\nmodel ${normalizedName} {\n`;
        modelString += `  id        Int      @id @default(autoincrement())\n`;
        fields.forEach(field => {
            let line = `  ${field.name} ${typeMapping[field.type] || 'String'}`;
            if (!field.required) line += '?';
            if (field.unique) line += ' @unique';
            modelString += line + '\n';
        });
        modelString += `  createdAt DateTime @default(now())\n`;
        modelString += `  updatedAt DateTime @updatedAt\n`;
        modelString += `}\n`;

        await upsertModelInSchema(schemaPath, normalizedName, modelString);

        res.status(202).json({ message: `Updating '${normalizedName}' started.` });

        (async () => {
            try {
                await execPromise('npx prisma db push --skip-generate');
                const buildsDir = path.join(__dirname, '../../generated/prisma_builds');
                await fs.mkdir(buildsDir, { recursive: true });
                const outDir = path.join(buildsDir, String(Date.now()));
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
const deleteModel = async (req, res) => {
    const app = req.app;
    const normalizedName = toPascal(req.params.name);
    const modelJsonPath = path.join(modelsDir, `${normalizedName}.json`);
    if (isPublishing) {
        return res.status(409).json({ message: 'Another model operation is in progress. Try again shortly.' });
    }
    isPublishing = true;

    try {
        // Remove file (if exists)
        await fs.unlink(modelJsonPath).catch(() => { });
        // Remove schema block
        await removeModelFromSchema(schemaPath, normalizedName);

        // Respond immediately
        res.status(202).json({ message: `Deletion of '${normalizedName}' started.` });

        (async () => {
            try {
                // Accept data loss to drop table on db push
                await execPromise('npx prisma db push --skip-generate --accept-data-loss');
                const buildsDir = path.join(__dirname, '../../generated/prisma_builds');
                await fs.mkdir(buildsDir, { recursive: true });
                const outDir = path.join(buildsDir, String(Date.now()));
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

module.exports = { publishModel, getModels, getModel, updateModel, deleteModel };