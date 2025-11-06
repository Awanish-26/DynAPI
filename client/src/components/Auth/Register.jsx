import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Register = () => {
    const [role, setRole] = useState('');
    const [password, setPassword] = useState('');
    const [confirmpassword, setConfirmpassword] = useState('');
    const [error, setError] = useState('');
    const { register } = useAuth();
    const navigate = useNavigate();

    // check if already logged in
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (token) {
            navigate('/dashboard');
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmpassword) {
            setError('Passwords do not match.');
            return;
        }
        try {
            await register(role, password);
            navigate('/login', { state: { flash: 'Registered Successfully. Please Log-in' } });
        } catch (err) {
            setError('Failed to register. Please try again.');
            console.error(err);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-300">
            <form onSubmit={handleSubmit} className="p-8 bg-gray-50 rounded shadow-md border-2 border-gray-500 w-96">
                <h2 className="mb-6 text-3xl pb-4 font-bold text-center text-green-400 border-b-2 border-black">Register</h2>
                {error && <p className="mb-4 text-red-500">{error}</p>}

                <div className="mb-4">
                    <label htmlFor="role">Role:</label>
                    <select name="role" id="role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 bg-gray-100 border border-gray-500 rounded" required>
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="VIEWER">Viewer</option>
                    </select>
                </div>

                <div className="mb-6">
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-100 border border-gray-500 rounded placeholder:text-gray-400" required />
                </div>

                <div className="mb-6">
                    <label htmlFor="password2">Comfirm Password</label>
                    <input id="password2" type="password" placeholder="Reenter Password" value={confirmpassword} onChange={(e) => setConfirmpassword(e.target.value)} className="w-full px-3 py-2 bg-gray-100 border border-gray-500 rounded placeholder:text-gray-400" required />
                </div>

                <button type="submit" className="w-full py-2 font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700">
                    Register
                </button>
            </form>
        </div>
    );
};

export default Register;