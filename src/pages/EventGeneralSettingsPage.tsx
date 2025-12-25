
import React, { useEffect, useState } from 'react';
import { Page } from '../components/layout/Page';
import { Spinner } from '../components/ui/Spinner';
import { useContextStore } from '../store/contextStore';
import { api } from '../api';
import { Building2, Save } from 'lucide-react';

export const EventGeneralSettingsPage: React.FC = () => {
    const { currentEventId, currentEventName, refreshContext } = useContextStore();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formName, setFormName] = useState('');
    const [structure, setStructure] = useState<'ZONAL' | 'HIERARCHICAL'>('ZONAL');
    const [zonesEnabled, setZonesEnabled] = useState(false);

    useEffect(() => {
        if (currentEventId) loadEvent();
    }, [currentEventId]);

    async function loadEvent() {
        setLoading(true);
        try {
            const e = await api.get<any>(`/events/${currentEventId}`);
            setFormName(e.name);
            setStructure(e.structure || 'ZONAL');
            setZonesEnabled(!!e.zonesEnabled);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function save() {
        if (!currentEventId) return;
        setSaving(true);
        try {
            await api.put(`/events/${currentEventId}`, {
                name: formName,
                structure,
                zonesEnabled: structure === 'ZONAL' ? zonesEnabled : false
            });
            await refreshContext();
            alert('Settings saved');
        } catch (e: any) {
            alert(e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <Page><Spinner /></Page>;

    return (
        <Page>
            <div className="max-w-3xl">
                <h1 className="text-2xl font-bold mb-6 flex items-center">
                    <Building2 className="mr-2" />
                    Event Settings
                </h1>

                <div className="bg-white p-6 rounded-lg border shadow-sm space-y-6">

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Event Name</label>
                        <input className="w-full border rounded px-3 py-2" value={formName} onChange={e => setFormName(e.target.value)} />
                    </div>

                    {/* Structure Mode */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Structure Mode</label>
                        <div className="space-y-3">
                            <div className={`p-4 border rounded-lg cursor-pointer transition ${structure === 'ZONAL' ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => setStructure('ZONAL')}>
                                <div className="flex items-center">
                                    <input type="radio" checked={structure === 'ZONAL'} onChange={() => setStructure('ZONAL')} className="mr-3" />
                                    <div>
                                        <div className="font-semibold">Central & Zonal Departments</div>
                                        <div className="text-sm text-gray-600">Split tasks between Central Office and Geographical Zones. Enables 'Zones' management.</div>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-4 border rounded-lg cursor-pointer transition ${structure === 'HIERARCHICAL' ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'}`} onClick={() => setStructure('HIERARCHICAL')}>
                                <div className="flex items-center">
                                    <input type="radio" checked={structure === 'HIERARCHICAL'} onChange={() => setStructure('HIERARCHICAL')} className="mr-3" />
                                    <div>
                                        <div className="font-semibold">Department & Sub-Departments</div>
                                        <div className="text-sm text-gray-600">Hierarchical structure with nested departments. No concept of "Zones". Tasks are organized by department hierarchy.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Zone Toggle (Only if Zonal) */}
                    {structure === 'ZONAL' && (
                        <div className="ml-8 mt-2">
                            <label className="flex items-center">
                                <input type="checkbox" checked={zonesEnabled} onChange={e => setZonesEnabled(e.target.checked)} className="mr-2 w-4 h-4" />
                                <div>
                                    <span className="font-medium">Enable Zones</span>
                                    <p className="text-xs text-gray-500">If unchecked, acts like 'Central' only but with Zonal structure underlying.</p>
                                </div>
                            </label>
                        </div>
                    )}

                    <div className="pt-4 border-t flex justify-end">
                        <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 flex items-center">
                            <Save size={18} className="mr-2" />
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>

                </div>
            </div>
        </Page>
    );
};
