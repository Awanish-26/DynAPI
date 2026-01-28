import { SESSION_EXPIRY } from './config.js';

// Session storage (in-memory for simplicity)
export const sessions = new Map();

// Helper function to generate session token
export const generateSessionToken = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Create a new session
export const createSession = (user) => {
    const token = generateSessionToken();
    const expires = Date.now() + SESSION_EXPIRY;

    // Store session
    sessions.set(token, { user, expires });

    return { token, expires };
};

// Remove a session
export const removeSession = (token) => {
    if (sessions.has(token)) {
        sessions.delete(token);
        return true;
    }
    return false;
};

// Get session information
export const getSession = (token) => {
    return sessions.get(token);
};

// Get total active session count
export const getSessionCount = () => {
    return sessions.size;
};

// Clean up expired sessions (optimized for better performance)
export const cleanSessions = () => {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Use Array.from for better performance with large Maps
    const expiredTokens = [];
    
    for (const [token, session] of sessions.entries()) {
        if (session.expires < now) {
            expiredTokens.push(token);
        }
    }
    
    // Batch delete expired sessions
    for (const token of expiredTokens) {
        sessions.delete(token);
        cleanedCount++;
    }

    return cleanedCount;
};

// Schedule regular cleanup
setInterval(cleanSessions, 60 * 60 * 1000); // Run hourly
