// src/components/tasks/AttachmentsPanel.tsx
import React, { useEffect, useState } from 'react';
import { BASE_URL } from '../../api';
import { attachmentsService, type AttachmentEntityType } from '../../services/attachments';
import { X, Download, FileText, FileIcon } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { MediaViewer } from '../ui/MediaViewer';

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
    readOnly?: boolean;
    memberMap?: Record<string, { name: string; avatar?: string }>;
    // backward compat (optional)
    memberNameById?: Record<string, string>;
    variant?: 'grid' | 'row' | 'list' | 'compact';
}> = ({ eventId, entityType, entityId, readOnly = false, memberMap = {}, memberNameById = {}, variant = 'grid' }) => {
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

    // ... helper functions omitted for brevity ...
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
        <div className="pt-2 pr-1 pb-3 rounded-b-lg">
            {variant !== 'row' && (
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">
                        {readOnly ? 'Attached files' : `Upload and manage files attached to this ${entityType.toLowerCase()}.`}
                    </h3>
                    {!readOnly && (
                        <label className="inline-flex items-center px-3 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
                            Upload
                            <input
                                type="file"
                                className="hidden"
                                onChange={(e) => e.target.files && e.target.files[0] && onUpload(e.target.files[0])}
                                disabled={busy}
                            />
                        </label>
                    )}
                </div>
            )}

            {err && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2">
                    {err}
                </div>
            )}

            {/* Grid/Row/List/Compact of attachment cards */}
            <div
                className={[
                    variant === 'grid'
                        ? "grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
                        : variant === 'row'
                            ? "flex gap-3 overflow-x-auto pb-2 snap-x"
                            : variant === 'compact'
                                ? "flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1"
                                : "flex flex-col gap-2", // list
                    "transition-all duration-300",
                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                ].join(' ')}
            >
                {items.map((a) => {
                    const size = a.size ?? a.bytes ?? NaN;
                    const url = fileUrl(a);

                    // Resolve user info
                    const creatorId = (a as any).createdBy;
                    const creatorName = creatorId ? (memberMap[creatorId]?.name || memberNameById[creatorId]) : undefined;
                    const creatorAvatar = creatorId ? memberMap[creatorId]?.avatar : undefined;

                    if (variant === 'list') {
                        return (
                            <button
                                key={a.id}
                                onClick={() => setPreview(a)}
                                className="group w-full flex items-center gap-3 p-2 rounded-lg border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all text-left"
                            >
                                <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded bg-gray-50 border border-gray-100">
                                    {isImage(a.mimeType) ? (
                                        <img src={url} alt="" className="w-full h-full object-cover rounded" />
                                    ) : (
                                        <FileIcon size={20} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{a.originalName}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                        <span>{humanSize(size)}</span>
                                        <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                                        <span>{new Date(a.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                                {creatorId && (
                                    <div className="shrink-0 flex items-center gap-2 pl-2 border-l border-gray-100">
                                        <div className="text-right hidden sm:block">
                                            <div className="text-[10px] text-gray-400">Uploaded by</div>
                                            <div className="text-xs font-medium text-gray-700 max-w-[80px] truncate">{creatorName?.split(' ')[0] || 'Unknown'}</div>
                                        </div>
                                        <UserAvatar nameOrEmail={creatorName || 'Unknown'} imageUrl={creatorAvatar} size={28} />
                                    </div>
                                )}
                            </button>
                        );
                    }

                    const isCompact = variant === 'compact';

                    return (
                        <button
                            key={a.id}
                            onClick={() => setPreview(a)}
                            title={isCompact ? `${a.originalName} (${humanSize(size)})` : "Click to preview"}
                            className={[
                                "group text-left border border-gray-200 bg-white rounded-lg hover:shadow-md transition-transform duration-200 ease-out hover:-translate-y-0.5",
                                isCompact ? "w-[60px] p-1" : "p-2",
                                variant === 'row' ? "min-w-[140px] w-[140px] snap-start" : variant === 'grid' ? "w-full" : ""
                            ].join(' ')}
                        >
                            <div className={[
                                "rounded-md overflow-hidden bg-gray-100 flex items-center justify-center relative",
                                isCompact ? "aspect-square w-full" : "aspect-[4/3] w-full"
                            ].join(' ')}>
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
                                        {isCompact ? <FileIcon size={20} /> : <span className="px-2 py-1 rounded bg-white/70 border">Video</span>}
                                    </div>
                                ) : isPdf(a.mimeType) ? (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                        {isCompact ? <FileText size={20} /> : <span className="px-2 py-1 rounded bg-white/70 border">PDF</span>}
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <FileText size={isCompact ? 20 : 28} />
                                    </div>
                                )}
                            </div>

                            <div className={[
                                "mt-1 truncate text-gray-900",
                                isCompact ? "text-[9px] text-center" : "text-sm mt-2"
                            ].join(' ')}>
                                {a.originalName}
                            </div>

                            {!isCompact && (
                                <>
                                    <div className="flex justify-between items-center mt-1">
                                        <div className="text-xs text-gray-500">{humanSize(size)}</div>
                                        {creatorName && (
                                            <div className="text-xs text-gray-400 truncate max-w-[80px]" title={`Uploaded by ${creatorName}`}>
                                                by {creatorName.split(' ')[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-1">
                                        {new Date(a.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            {items.length === 0 && (
                <div className="text-sm text-gray-500 mt-2">No attachments yet.</div>
            )}

            {/* Preview modal */}
            {preview && (
                <MediaViewer
                    url={fileUrl(preview)}
                    name={preview.originalName}
                    mimeType={preview.mimeType}
                    size={humanSize(preview.size ?? preview.bytes ?? NaN)}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>
    );
};
