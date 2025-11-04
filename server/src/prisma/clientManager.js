const path = require('path');

let currentDir = path.join(__dirname, '../../generated/prisma');
let { PrismaClient } = require(currentDir);
let prisma = new PrismaClient();

async function swapClient(newDir) {
    const old = prisma;
    try {
        const mod = require(newDir);
        const NewClient = mod.PrismaClient;
        const next = new NewClient();
        prisma = next;
        currentDir = newDir;
        await old.$disconnect().catch(() => { });
        console.log(`Prisma client swapped to: ${newDir}`);
    } catch (e) {
        console.error('Failed to swap Prisma client:', e);
    }
}

function getPrisma() {
    return prisma;
}

module.exports = { getPrisma, swapClient };