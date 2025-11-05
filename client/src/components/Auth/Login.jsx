import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Login = () => {
    const [role, setRole] = useState('ADMIN');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // take flash once from router state
    const initialFlash = location.state?.flash || '';
    const [flash, setFlash] = useState(initialFlash);
    const [showFlash, setShowFlash] = useState(!!initialFlash);

    // check if already logged in
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) navigate('/dashboard');
    }, [navigate]);

    // clear router state once (avoid re-showing on back/forward)
    useEffect(() => {
        if (initialFlash) {
            // start animation in
            setShowFlash(true);
            // immediately clear route state
            navigate(location.pathname, { replace: true, state: {} });

            // auto hide after 3s, then remove the message after transition (500ms)
            const hideT = setTimeout(() => setShowFlash(false), 3000);
            const clearT = setTimeout(() => setFlash(''), 3500);
            return () => {
                clearTimeout(hideT);
                clearTimeout(clearT);
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(role, password);
            navigate('/dashboard');
        } catch (err) {
            setError('Failed to log in. Please check your credentials.');
            console.error(err);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-300">
            {flash && (
                <div
                    className={[
                        'fixed left-1/2 -translate-x-1/2 top-0 mt-4 z-50',
                        'px-4 py-3 rounded shadow-lg text-white bg-green-600',
                        'transition-all duration-500 ease-out',
                        showFlash ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6 pointer-events-none',
                    ].join(' ')}
                >
                    {flash}
                </div>
            )}

            <form onSubmit={handleSubmit} className="p-8 bg-gray-50 rounded shadow-md border-2 border-gray-500 w-96">
                <h2 className="mb-6 text-3xl pb-4 font-bold text-center text-green-400 border-b-2 border-black">Login</h2>
                {error && <p className="mb-4 text-red-500">{error}</p>}
                <div className="mb-4">
                    <label htmlFor="role">Role:</label>
                    <select name="role" id="role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 bg-gray-100 border border-gray-500 rounded">
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="VIEWER">Viewer</option>
                    </select>
                </div>
                <div className="mb-6">
                    <label htmlFor="password">Password</label>
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-100 border border-gray-500 rounded placeholder:text-gray-400" required />
                </div>
                <button type="submit" className="w-full py-2 font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700">
                    Log In
                </button>
            </form>
        </div>
    );
};

export default Login;