import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="mt-4">Welcome to the protected area!</p>
            <button
                onClick={handleLogout}
                className="px-4 py-2 mt-6 font-bold text-white bg-red-600 rounded hover:bg-red-700"
            >
                Logout
            </button>
        </div>
    );
};

export default Dashboard;