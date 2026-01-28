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
        // Create backup of current client if it exists
        try {
            await fs.rename(targetDir, backupDir);
        } catch (err) {
            // If targetDir doesn't exist, that's okay - log and continue
            if (err.code !== 'ENOENT') {
                console.warn('Failed to create backup:', err.message);
            }
        }
        
        // Move new client to target location
        await fs.rename(newClientDir, targetDir);
        
        // Clean up backup on success
        await fs.rm(backupDir, { recursive: true, force: true }).catch(err => {
            console.warn('Failed to clean up backup:', err.message);
        });
    } catch (error) {
        // Restore backup if swap failed
        console.error('Client swap failed, attempting rollback:', error);
        try {
            // Check if backup exists before attempting restore
            const backupExists = await fs.access(backupDir).then(() => true).catch(() => false);
            if (backupExists) {
                // Remove failed target if it exists
                await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});
                // Restore backup
                await fs.rename(backupDir, targetDir);
                console.log('Rollback successful');
            }
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

