const { sessions, getSession } = require('../utils/session');
const jwt = require('jsonwebtoken');

// Authentication middleware to check and validate tokens
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Token is invalid (e.g., expired, malformed)
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({ message: 'Forbidden: Invalid or expired token.' });
        }

        // Token is valid, attach the decoded user payload to the request object
        req.user = user;
        next(); // Proceed to the next middleware or route handler
    });
};

module.exports = { authenticateToken };
