import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError('Failed to log in. Please check your credentials.');
            console.error(err);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen">
            <form onSubmit={handleSubmit} className="p-8 bg-gray-800 rounded shadow-md w-96">
                <h2 className="mb-6 text-2xl font-bold text-center">Login</h2>
                {error && <p className="mb-4 text-red-500">{error}</p>}
                <div className="mb-4">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 text-white bg-gray-700 rounded"
                        required
                    />
                </div>
                <div className="mb-6">
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 text-white bg-gray-700 rounded"
                        required
                    />
                </div>
                <button type="submit" className="w-full py-2 font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700">
                    Log In
                </button>
            </form>
        </div>
    );
};

export default Login;