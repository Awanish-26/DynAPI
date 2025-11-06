import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

// Decode JWT to extract payload
function decodeJwt(token) {
    try {
        const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
        const json = atob(base64);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // { id, role }
    const [token, setToken] = useState(() => localStorage.getItem('token') || null);
    const [loading, setLoading] = useState(true);

    // Bootstrap from localStorage on mount and validate token expiry if present 
    useEffect(() => {
        const boot = async () => {
            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            }
            const payload = decodeJwt(token);
            const isExpired = !payload?.exp || payload.exp * 1000 < Date.now();
            if (!payload || isExpired) {
                localStorage.removeItem('token');
                setToken(null);
                setUser(null);
                setLoading(false);
                return;
            }
            setUser({ id: payload.userId, role: payload.role });
            setLoading(false);
        };
        boot();
    }, [token]);

    // Axios interceptors to attach token and handle 401
    useEffect(() => {
        const reqId = api.interceptors.request.use((config) => {
            if (token) config.headers.Authorization = `Bearer ${token}`;
            return config;
        });
        const resId = api.interceptors.response.use(
            (res) => res,
            (err) => {
                if (err?.response?.status === 401) {
                    // Token invalid/expired -> logout
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                }
                return Promise.reject(err);
            }
        );
        return () => {
            api.interceptors.request.eject(reqId);
            api.interceptors.response.eject(resId);
        };
    }, [token]);

    // Auth actions
    const login = async (role, password) => {
        const response = await api.post('/auth/login', { role, password });
        const { token: t } = response.data;
        localStorage.setItem('token', t);
        setToken(t);
        const payload = decodeJwt(t);
        if (payload) setUser({ id: payload.userId, role: payload.role });
    };

    // Registration action
    const register = async (role, password) => {
        const response = await api.post('/auth/register', { role, password });
        return response.data;
    };

    // Logout action
    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
    };

    const value = {
        token,
        user,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
export default AuthContext;