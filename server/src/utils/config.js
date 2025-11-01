// Session configuration
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Role permissions
const rolePermissions = {
    ADMIN: [
    ],
    MANAGER: [
    ],
    VIEWER: [
    ]
};



module.exports = {
    SESSION_EXPIRY,
    rolePermissions,
};
