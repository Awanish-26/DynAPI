const { getPrisma } = require('./clientManager');

const prismaProxy = new Proxy({}, {
    get(_t, prop) {
        const prisma = getPrisma();
        return prisma[prop];
    },
    apply(_t, thisArg, args) {
        const prisma = getPrisma();
        return prisma.apply(thisArg, args);
    }
});

module.exports = prismaProxy;