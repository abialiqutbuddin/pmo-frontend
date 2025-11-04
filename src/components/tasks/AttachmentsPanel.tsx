// src/components/tasks/AttachmentsPanel.tsx
import React, { useEffect, useState } from 'react';
import { BASE_URL } from '../../api';
import { attachmentsService, type AttachmentEntityType } from '../../services/attachments';
import { X, Download, FileText } from 'lucide-react';

type Attachment = {
    id: string;
    originalName: string;
    mimeType: string;
    size?: number;
    bytes?: number;
    createdAt: string;
    objectKey?: string;
};

export const AttachmentsPanel: React.FC<{
    eventId: string;
    entityType: AttachmentEntityType;
    entityId: string;
}> = ({ eventId, entityType, entityId }) => {
    const [items, setItems] = useState<Attachment[]>([]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const [preview, setPreview] = useState<Attachment | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    async function load() {
        setErr(null);
        try {
            const rows = await attachmentsService.list(eventId, entityType, entityId);
            setItems(Array.isArray(rows) ? rows : []);
        } catch (e: any) {
            setErr(e?.message || 'Failed to load attachments');
        }
    }

    useEffect(() => {
        if (!eventId || !entityId) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId, entityId]);

    async function onUpload(f: File) {
        if (!f) return;
        setBusy(true);
        setErr(null);
        try {
            await attachmentsService.upload(eventId, entityType, entityId, f);
            await load();
        } catch (e: any) {
            setErr(e?.message || 'Failed to upload');
        } finally {
            setBusy(false);
        }
    }

    function publicUrlFromObjectKey(objectKey?: string) {
        if (!objectKey) return '';
        // encode each segment to avoid problems with spaces, etc. but keep slashes
        return `${BASE_URL}/${objectKey
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`;
    }

    function humanSize(n: number) {
        if (!Number.isFinite(n)) return '—';
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    }

    const isImage = (m?: string) => !!m && m.startsWith('image/');
    const isVideo = (m?: string) => !!m && m.startsWith('video/');
    const isPdf = (m?: string) => m === 'application/pdf';

    const fileUrl = (a: Attachment) => {
        // prefer public static url (no auth required)
        if (a.objectKey) return publicUrlFromObjectKey(a.objectKey);
        // fallback to the authenticated controller if objectKey is missing
        return `${BASE_URL}/events/${eventId}/attachments/${a.id}`;
    };

    return (
        <div className="pt-2 pl-2 pr-1 pb-3 rounded-b-lg">
            <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600">
                    Upload and manage files attached to this {entityType.toLowerCase()}.
                </div>
                <label className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                    Upload
                    <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files && e.target.files[0] && onUpload(e.target.files[0])}
                        disabled={busy}
                    />
                </label>
            </div>

            {err && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2">
                    {err}
                </div>
            )}

            {/* Grid of attachment cards */}
            <div
                className={[
                    "grid gap-3",
                    "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
                    "transition-all duration-300",
                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                ].join(' ')}
            >
                {items.map((a) => {
                    const size = a.size ?? a.bytes ?? NaN;
                    const url = fileUrl(a);

                    return (
                        <button
                            key={a.id}
                            onClick={() => setPreview(a)}
                            title="Click to preview"
                            className="group text-left w-full border border-gray-200 bg-white rounded-lg p-2 hover:shadow-md transition-transform duration-200 ease-out hover:-translate-y-0.5"
                        >
                            <div className="aspect-[4/3] w-full rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                                {isImage(a.mimeType) ? (
                                    <img
                                        src={url}
                                        alt={a.originalName}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreview(a); }}
                                    />
                                ) : isVideo(a.mimeType) ? (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                        <span className="px-2 py-1 rounded bg-white/70 border">Video</span>
                                    </div>
                                ) : isPdf(a.mimeType) ? (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                        <span className="px-2 py-1 rounded bg-white/70 border">PDF</span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <FileText size={28} />
                                    </div>
                                )}
                            </div>

                            <div className="mt-2 truncate text-sm text-gray-900">{a.originalName}</div>
                            <div className="text-xs text-gray-500">{humanSize(size)}</div>
                        </button>
                    );
                })}
            </div>

            {items.length === 0 && (
                <div className="text-sm text-gray-500 mt-2">No attachments yet.</div>
            )}

            {/* Preview modal */}
            {preview && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setPreview(null)} />
                    <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl border-l border-gray-200 flex flex-col transform transition-transform duration-300 translate-x-0">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="min-w-0">
                                <div className="truncate font-medium">{preview.originalName}</div>
                                <div className="text-xs text-gray-500">
                                    {preview.mimeType} • {humanSize(preview.size ?? preview.bytes ?? NaN)}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={fileUrl(preview)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center text-sm px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                                    title="Download"
                                >
                                    <Download size={16} className="mr-1" /> Download
                                </a>
                                <button
                                    className="p-2 rounded hover:bg-gray-100"
                                    onClick={() => setPreview(null)}
                                    title="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-4 overflow-auto">
                            {isImage(preview.mimeType) ? (
                                <img
                                    src={fileUrl(preview)}
                                    alt={preview.originalName}
                                    className="max-w-full rounded-lg border border-gray-200"
                                />
                            ) : isVideo(preview.mimeType) ? (
                                <video
                                    src={fileUrl(preview)}
                                    className="w-full rounded-lg border border-gray-200"
                                    controls
                                />
                            ) : isPdf(preview.mimeType) ? (
                                <iframe
                                    src={fileUrl(preview)}
                                    className="w-full h-[70vh] rounded-lg border border-gray-200"
                                    title={preview.originalName}
                                />
                            ) : (
                                <div className="text-sm text-gray-600">
                                    Preview not available. Use Download to open the file.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
