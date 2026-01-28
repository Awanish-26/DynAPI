import { readFile, writeFile, mkdir, rename, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function writeTempSchemaWithOutput(baseSchemaPath, outDir) {
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

export async function swapClient(newClientDir) {
    const targetDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../generated/prisma');
    const backupDir = path.join(path.dirname(targetDir), 'prisma.bak');
    
    try {
        // Create backup of current client
        await fs.rename(targetDir, backupDir).catch(() => {});
        // Move new client to target location
        await fs.rename(newClientDir, targetDir);
        // Clean up backup
        await fs.rm(backupDir, { recursive: true, force: true }).catch(() => {});
    } catch (error) {
        // Restore backup if swap failed
        try {
            await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});
            await fs.rename(backupDir, targetDir).catch(() => {});
        } catch (restoreError) {
            console.error('Failed to restore backup:', restoreError);
        }
        throw error;
    }
}

export const toPascal = (s = '') => s ? s[0].toUpperCase() + s.slice(1) : s;

export const findModelBlock = async (schemaPath, modelName) => {
    const schema = await fs.readFile(schemaPath, 'utf-8').catch(() => '');
    const blockRegex = new RegExp(`\\nmodel\\s+${modelName}\\s+\\{[\\s\\S]*?\\n\\}`, 'm');
    const match = schema.match(blockRegex);
    return match ? match[0].trim() : null;
};

export const removeModelFromSchema = async (schemaPath, modelName) => {
    let schema = await fs.readFile(schemaPath, 'utf-8').catch(() => '');
    const blockRegex = new RegExp(`\\nmodel\\s+${modelName}\\s+\\{[\\s\\S]*?\\n\\}`, 'g');
    const next = schema.replace(blockRegex, '\n');
    if (next !== schema) {
        await fs.writeFile(schemaPath, next, 'utf-8');
        return true;
    }
    return false;
};

