import React, { useState } from 'react';
import api from '../../services/api';

const ModelBuilder = () => {
    const [modelName, setModelName] = useState('');
    const [fields, setFields] = useState([{ name: '', type: 'string', required: true, unique: false }]);
    const [rbac, setRbac] = useState({ ADMIN: ['all'], MANAGER: ['read'], VIEWER: ['read'] });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleAddField = () => setFields([...fields, { name: '', type: 'string', required: true, unique: false }]);
    const handleRemoveField = (index) => setFields(fields.filter((_, i) => i !== index));

    const handleFieldChange = (index, e) => {
        const newFields = [...fields];
        const { name, value, type, checked } = e.target;
        newFields[index][name] = type === 'checkbox' ? checked : value;
        setFields(newFields);
    };

    const handleRbacChange = (role, e) => {
        const { value } = e.target;
        setRbac({ ...rbac, [role]: value.split(',').map(p => p.trim()) });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!modelName) {
            setError('Model Name is required.');
            return;
        }
        try {
            const payload = { name: modelName, fields, rbac };
            const response = await api.post('/api/models/publish', payload);
            setSuccess(response.data.message);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to publish model.');
        }
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-6">Create a Model</h1>
            {error && <p className="mb-4 p-3 bg-red-900 text-red-300 rounded">{error}</p>}
            {success && <p className="mb-4 p-3 bg-green-900 text-green-300 rounded">{success}</p>}

            <form onSubmit={handleSubmit} className="font-display space-y-6 grid grid-cols-3 gap-6 ">

                <div className='col-span-3 md:col-span-2 border-r-2 pr-6'>
                    <div>
                        <label className="text-xl block mb-2">Model Name</label>
                        <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)} className="w-full px-3 py-2 text-gray-800 rounded border-2 border-gray-400" placeholder="e.g., Product" />
                    </div>
                    <h2 className="text-xl mb-2 my-4">Fields</h2>
                    {fields.map((field, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center mb-3 p-3 border border-gray-300 rounded">
                            <input type="text" name="name" placeholder="Field Name" value={field.name} onChange={(e) => handleFieldChange(index, e)} className="col-span-2  px-3 py-2 text-gray-800 border border-gray-300 rounded" />
                            <select name="type" value={field.type} onChange={(e) => handleFieldChange(index, e)} className="px-3 py-2 text-gray-800 border border-gray-300 rounded">
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                            </select>
                            <label className="flex items-center space-x-2"><input type="checkbox" name="required" checked={field.required} onChange={(e) => handleFieldChange(index, e)} /><span>Required</span></label>
                            <label className="flex items-center space-x-2"><input type="checkbox" name="unique" checked={field.unique} onChange={(e) => handleFieldChange(index, e)} /><span>Unique</span></label>
                            <button type="button" onClick={() => handleRemoveField(index)} className="px-3 py-2 bg-red-500 rounded hover:bg-red-400 text-white">Remove</button>
                        </div>
                    ))}
                    <button type="button" onClick={handleAddField} className="mt-2 px-4 py-2 text-white bg-indigo-600 rounded hover:bg-indigo-700">Add Field</button>
                </div>
                <div className="col-span-3 md:col-span-1">
                    <div>
                        <h2 className="text-xl mb-4 text-blue-700">Role Permissions (comma-separated)</h2>
                        {Object.keys(rbac).map(role => (
                            <div key={role} className="mb-2">
                                <label className="block mb-1 font-semibold">{role}</label>
                                <input type="text" value={rbac[role].join(', ')} onChange={(e) => handleRbacChange(role, e)} className="w-full px-3 py-2 text-gray-800 border border-gray-300 rounded" placeholder="e.g., create, read, update, delete, all" />
                            </div>
                        ))}
                    </div>

                    <button type="submit" className="w-full py-3 font-bold text-white bg-green-600 rounded hover:bg-green-700">Publish Model</button>
                </div>
            </form>
        </div>
    );
};

export default ModelBuilder;