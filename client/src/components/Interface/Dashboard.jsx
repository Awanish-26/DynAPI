import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const Dashboard = () => {
    const navigate = useNavigate();
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);

    // Fetch models from the API
    const loadModels = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/api/models');
            setModels(Array.isArray(data) ? data : []);
        } catch {
            setModels([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadModels();
    }, []);

    const handleRead = (name) => navigate(`/models/${encodeURIComponent(name)}`);
    const handleEdit = (name) => navigate(`/model-builder?edit=${encodeURIComponent(name)}`);
    const handleDelete = async (name) => {
        if (!window.confirm(`Delete model "${name}" and its endpoints?`)) return;
        setBusy(name);
        try {
            await api.delete(`/api/models/${encodeURIComponent(name)}`);
            // Background task returns 202; poll a bit then refresh
            setTimeout(loadModels, 1200);
        } catch (e) {
            alert('Delete failed. Check server logs.');
            console.error(e);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="p-6">
            <div className="mb-4 flex justify-between items-center">
                <h1 className="text-2xl font-bold">Models</h1>
                <button onClick={() => navigate('/model-builder')} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded hover:bg-blue-700">
                    Create Model
                </button>
            </div>

            {loading ? (
                <div>Loading…</div>
            ) : models.length === 0 ? (
                <div>No models found.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-3 py-2 text-left">Name</th>
                                <th className="px-3 py-2 text-center">Fields</th>
                                <th className="px-3 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {models.map((m) => (
                                <tr key={m.name} className="border-t">
                                    <td className="px-3 py-2">{m.name}</td>
                                    <td className="px-3 py-2 text-center">{Array.isArray(m.fields) ? m.fields.length : '-'}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-2 justify-center">
                                            <button onClick={() => handleRead(m.name)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">
                                                Read
                                            </button>
                                            <button onClick={() => handleEdit(m.name)} className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600">
                                                Edit
                                            </button>
                                            <button
                                                disabled={busy === m.name}
                                                onClick={() => handleDelete(m.name)}
                                                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                            >
                                                {busy === m.name ? 'Deleting…' : 'Delete'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Dashboard;