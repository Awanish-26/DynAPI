import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            // Here you would typically fetch user profile
            // For now, we'll just assume the token is valid
            // setUser({ role: 'ADMIN' }); // Placeholder
        }
        setLoading(false);
    }, [token]);

    const login = async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const { token } = response.data;
        localStorage.setItem('token', token);
        setToken(token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // You might want to fetch the user profile here
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
    };

    const value = { token, user, login, logout, isAuthenticated: !!token };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};