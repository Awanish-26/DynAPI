const { sessions } = require('../utils/session');

// Authentication middleware to check and validate tokens
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    const session = sessions.get(token);
    if (!session || session.expires < Date.now()) {
        sessions.delete(token);
        return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // Extend session
    session.expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    req.user = session.user;
    next();
};

module.exports = { authenticateToken };
