const prisma = require('../prisma/client');

const checkPermissions = (modelDefinition) => {
    return async (req, res, next) => {
        const userRole = req.user.role; // From authenticateToken middleware
        const actionMap = {
            'POST': 'create',
            'GET': 'read',
            'PUT': 'update',
            'DELETE': 'delete'
        };
        const requiredAction = actionMap[req.method];

        if (!requiredAction) return next();

        const userPermissions = modelDefinition.rbac[userRole] || [];

        if (!userPermissions.includes(requiredAction) && !userPermissions.includes('all')) {
            return res.status(403).json({ message: `Forbidden: Role '${userRole}' cannot perform '${requiredAction}' action.` });
        }

        next();
    };
};

module.exports = { checkPermissions };