import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSearchParams } from 'react-router-dom';

const ModelBuilder = () => {
    const [search] = useSearchParams();
    const editName = search.get('edit');
    const isEdit = !!editName;

    const [modelName, setModelName] = useState(editName || '');
    const [fields, setFields] = useState([{ name: '', type: 'string', required: true, unique: false }]);
    const [rbac, setRbac] = useState({ ADMIN: ['all'], MANAGER: ['read'], VIEWER: ['read'] });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const load = async () => {
            if (!isEdit) return;
            try {
                const { data } = await api.get(`/api/models/${encodeURIComponent(editName)}`);
                const json = data?.json;
                if (json) {
                    setModelName(json.name);
                    setFields(Array.isArray(json.fields) ? json.fields : []);
                    setRbac(json.rbac || rbac);
                }
            } catch {
                setError('Failed to load model.');
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit, editName]);

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
        setRbac({ ...rbac, [role]: value.split(',').map(p => p.trim()).filter(Boolean) });
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
            if (isEdit) {
                await api.put(`/api/models/${encodeURIComponent(modelName)}`, { fields, rbac });
                setSuccess('Update started. It may take a moment for endpoints to refresh.');
            } else {
                await api.post('/api/models/publish', { name: modelName, fields, rbac });
                setSuccess('Publish started. It may take a moment for endpoints to appear.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save model.');
        }
    };

    return (
        <div className="p-8 text-display">
            <h1 className="text-3xl font-bold mb-6">{isEdit ? `Edit Model: ${modelName}` : 'Create a Model'}</h1>
            {error && <p className="mb-4 p-3 bg-red-900 text-red-300 rounded">{error}</p>}
            {success && <p className="mb-4 p-3 bg-green-900 text-green-300 rounded">{success}</p>}

            <form onSubmit={handleSubmit} className="space-y-6 flex gap-5">

                <div className='w-2/3'>
                    {!isEdit && (
                        <div>
                            <label className="block mb-1 text-2xl">Model Name</label>
                            <input
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                className="w-full p-2 border rounded bg-white text-black"
                                placeholder="e.g. Product"
                            />
                        </div>
                    )}
                    <div className="space-y-3 p-3 border-2 border-gray-400 rounded mt-4 bg-gray-100">
                        <h2 className="font-medium">Fields</h2>
                        {fields.map((f, idx) => (
                            <div key={idx} className="grid grid-cols-6 gap-2  items-center">
                                <input name="name" value={f.name} onChange={(e) => handleFieldChange(idx, e)} placeholder="name" className="col-span-2 p-2 border rounded bg-white text-black" />
                                <select name="type" value={f.type} onChange={(e) => handleFieldChange(idx, e)} className="col-span-1 p-2 border rounded bg-white text-black">
                                    <option value="string">String</option>
                                    <option value="number">Number</option>
                                    <option value="boolean">Boolean</option>
                                    <option value="datetime">DateTime</option>
                                </select>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" name="required" checked={!!f.required} onChange={(e) => handleFieldChange(idx, e)} />
                                    Required
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" name="unique" checked={!!f.unique} onChange={(e) => handleFieldChange(idx, e)} />
                                    Unique
                                </label>
                                <button type="button" onClick={() => handleRemoveField(idx)} className="col-span-1 px-2 py-1 bg-red-600 text-white rounded">
                                    Delete
                                </button>
                            </div>
                        ))}
                        <div className="mb-2">
                            <button type="button" onClick={handleAddField} className="px-3 py-1 bg-blue-600 text-white rounded">Add Field</button>
                        </div>
                    </div>
                </div>
                <div className='w-1/3 bg-gray-100 p-4 border-2 border-gray-500 rounded '>
                    <div>
                        <h2 className="mb-4 text-3xl">Permissions</h2>
                        {['ADMIN', 'MANAGER', 'VIEWER'].map((role) => (
                            <div key={role} className="grid grid-cols-3 mb-2">
                                <span className="col-span-1 ">{role} :</span>
                                <input className="col-span-2 p-2  border rounded w-full bg-white text-black" value={(rbac[role] || []).join(', ')} onChange={(e) => handleRbacChange(role, e)} placeholder="e.g. all or read, create" />
                            </div>
                        ))}
                    </div>

                    <button type="submit" className="mt-4 px-4 w-full py-2 bg-green-600 text-white rounded">
                        {isEdit ? 'Update Model' : 'Publish Model'}
                    </button>
                </div>

            </form>
        </div>
    );
};

export default ModelBuilder;