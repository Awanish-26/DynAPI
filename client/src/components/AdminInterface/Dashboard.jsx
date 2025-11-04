import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa6';

const Dashboard = () => {
    const navigate = useNavigate();


    return (
        <div className="p-8">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <button
                    onClick={() => navigate('/model-builder')}
                    className="px-4 py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700 flex items-center mt-4">
                    <span className='px-2'>Create Model </span> <FaPlus />
                </button>
            </div>
        </div>
    );
};

export default Dashboard;