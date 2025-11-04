import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';

const fieldInput = (field, value, onChange) => {
    const common = { className: 'p-2 border rounded bg-white text-black w-full', value: value ?? '', onChange };
    switch (field.type) {
        case 'number': return <input type="number" {...common} />;
        case 'boolean':
            return (
                <select {...common}>
                    <option value="">(unset)</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            );
        case 'datetime': return <input type="datetime-local" {...common} />;
        default: return <input type="text" {...common} />;
    }
};

const coerceForSubmit = (field, v) => {
    if (v === '' || v === undefined || v === null) return undefined;
    if (field.type === 'number') return Number(v);
    if (field.type === 'boolean') return v === true || v === 'true';
    if (field.type === 'datetime') return new Date(v).toISOString();
    return v;
};

const ModelData = () => {
    const { name } = useParams();
    const lower = (name || '').toLowerCase();

    const [definition, setDefinition] = useState(null);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const [creating, setCreating] = useState(false);
    const [createData, setCreateData] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState('');

    const fields = useMemo(() => {
        const f = Array.isArray(definition?.json?.fields) ? definition.json.fields : [];
        // Hide system fields; show id in table but not editable on create
        return f.filter(x => !['createdAt', 'updatedAt', 'id'].includes(x.name));
    }, [definition]);

    const loadDefinition = async () => {
        try {
            const { data } = await api.get(`/api/models/${encodeURIComponent(name)}`);
            setDefinition(data);
        } catch {
            setDefinition(null);
        }
    };

    const loadRows = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/api/${lower}`);
            setRows(Array.isArray(data) ? data : []);
        } catch {
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDefinition();
        loadRows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setCreating(true);
        try {
            const payload = {};
            fields.forEach(f => {
                const v = coerceForSubmit(f, createData[f.name]);
                if (v !== undefined) payload[f.name] = v;
            });
            await api.post(`/api/${lower}`, payload);
            setCreateData({});
            await loadRows();
        } catch (err) {
            setError(err.response?.data?.message || 'Create failed.');
        } finally {
            setCreating(false);
        }
    };

    const startEdit = (row) => {
        setEditingId(row.id);
        const copy = {};
        fields.forEach(f => copy[f.name] = row[f.name] ?? '');
        setEditData(copy);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
    };

    const submitEdit = async (id) => {
        setBusyId(id);
        setError('');
        try {
            const payload = {};
            fields.forEach(f => {
                const v = coerceForSubmit(f, editData[f.name]);
                if (v !== undefined) payload[f.name] = v;
            });
            await api.put(`/api/${lower}/${id}`, payload);
            setEditingId(null);
            setEditData({});
            await loadRows();
        } catch (err) {
            setError(err.response?.data?.message || 'Update failed.');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this record?')) return;
        setBusyId(id);
        setError('');
        try {
            await api.delete(`/api/${lower}/${id}`);
            await loadRows();
        } catch (err) {
            setError(err.response?.data?.message || 'Delete failed.');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
                <h1 className="text-2xl font-bold">{name} data</h1>
                <button onClick={() => loadRows()} className="px-3 py-1 bg-gray-700 text-white rounded">Refresh</button>
            </div>

            {error && <div className="mb-3 p-3 bg-red-900 text-red-200 rounded">{error}</div>}

            {/* Create form */}
            <div className="mb-6 p-4 border rounded bg-white">
                <h2 className="font-semibold mb-3">Create {name}</h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {fields.map((f) => (
                        <div key={f.name}>
                            <label className="block text-sm mb-1">{f.name}</label>
                            {fieldInput(f, createData[f.name], (e) =>
                                setCreateData({ ...createData, [f.name]: e.target.value })
                            )}
                        </div>
                    ))}
                    <div className="col-span-full">
                        <button disabled={creating} className="px-4 py-2 bg-green-600 text-white rounded">
                            {creating ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Data table */}
            {loading ? (
                <div>Loading…</div>
            ) : rows.length === 0 ? (
                <div>No records.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-3 py-2 text-left">id</th>
                                {fields.map((f) => (
                                    <th key={f.name} className="px-3 py-2 text-left">{f.name}</th>
                                ))}
                                <th className="px-3 py-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-t align-top">
                                    <td className="px-3 py-2">{r.id}</td>
                                    {fields.map((f) => (
                                        <td key={f.name} className="px-3 py-2">
                                            {editingId === r.id ? (
                                                fieldInput(f, editData[f.name], (e) =>
                                                    setEditData({ ...editData, [f.name]: e.target.value })
                                                )
                                            ) : (
                                                String(r[f.name] ?? '')
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {editingId === r.id ? (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => submitEdit(r.id)}
                                                    disabled={busyId === r.id}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                                                >
                                                    {busyId === r.id ? 'Saving…' : 'Save'}
                                                </button>
                                                <button onClick={cancelEdit} className="px-3 py-1 bg-gray-500 text-white rounded">Cancel</button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button onClick={() => startEdit(r)} className="px-3 py-1 bg-yellow-500 text-white rounded">Edit</button>
                                                <button
                                                    onClick={() => handleDelete(r.id)}
                                                    disabled={busyId === r.id}
                                                    className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                                                >
                                                    {busyId === r.id ? 'Deleting…' : 'Delete'}
                                                </button>
                                            </div>
                                        )}
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

export default ModelData;