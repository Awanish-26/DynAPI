const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { loadAndRegisterRoutes } = require('../services/routeLoader');
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

const publishModel = async (req, res) => {
    const { name, fields, ownerField, rbac } = req.body;

    const app = req.app;

    if (!name || !fields) {
        return res.status(400).json({ message: 'Model name and fields are required.' });
    }

    if (isPublishing) {
        return res.status(409).json({ message: 'Another model publish is in progress. Please try again shortly.' });
    }
    isPublishing = true;

    // Normalize model name to PascalCase to avoid case-collisions
    const normalizedName = name.charAt(0).toUpperCase() + name.slice(1);

    const modelJsonPath = path.join(modelsDir, `${normalizedName}.json`);
    const modelDefinition = { name: normalizedName, fields, ownerField, rbac, tableName: normalizedName.toLowerCase() + 's' };

    try {
        // 1. Save model definition to a .json file
        await fs.writeFile(modelJsonPath, JSON.stringify(modelDefinition, null, 2));

        // 2. Generate the Prisma model string
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

        // 3. Upsert into schema.prisma
        await upsertModelInSchema(schemaPath, normalizedName, modelString);

        // Respond immediately so the HTTP request does not block
        res.status(202).json({ message: `Publishing '${normalizedName}' started.` });

        // 4. Continue in background
        (async () => {
            try {
                // Push DB schema without generating (non-blocking)
                await execPromise('npx prisma db push --skip-generate');

                // Generate a new client into a fresh directory to avoid file locks
                const buildsDir = path.join(__dirname, '../../generated/prisma_builds');
                await fs.mkdir(buildsDir, { recursive: true });
                const outDir = path.join(buildsDir, String(Date.now()));
                const tmpSchema = await writeTempSchemaWithOutput(schemaPath, outDir);
                await execPromise(`npx prisma generate --schema "${tmpSchema}"`);

                // Hot-swap the Prisma client to the new build
                await swapClient(outDir);

                // Reload routes after swapping client
                await loadAndRegisterRoutes(app);

                console.log(`Model '${normalizedName}' published and endpoints generated successfully.`);
            } catch (error) {
                console.error('Background publish failed:', error);
                await fs.unlink(modelJsonPath).catch(() => { });
            } finally {
                isPublishing = false;
            }
        })();

    } catch (error) {
        console.error('Failed to start publish:', error);
        // Basic cleanup: remove the generated json if something fails
        await fs.unlink(modelJsonPath).catch(() => { });
        isPublishing = false;
        res.status(500).json({ message: 'Error starting publish.', error: error.message });
    }
};

const getModels = async (req, res) => {
    try {
        const files = await fs.readdir(modelsDir);
        const models = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const content = await fs.readFile(path.join(modelsDir, file), 'utf-8');
                models.push(JSON.parse(content));
            }
        }
        res.json(models);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve models.' });
    }
};


module.exports = { publishModel, getModels };