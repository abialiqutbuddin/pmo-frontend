import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink } from 'lucide-react';

interface MediaViewerProps {
    url: string;
    name: string;
    mimeType: string;
    size?: number | string; // formatted size string or bytes
    onClose: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ url, name, mimeType, onClose }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Trigger animation
        requestAnimationFrame(() => setMounted(true));

        // Lock body scroll
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isPdf = mimeType === 'application/pdf';

    const content = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity duration-300 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            {/* Content Container */}
            <div
                className={`relative w-full h-full md:max-w-5xl md:max-h-[90vh] flex flex-col transition-all duration-300 ease-out transform ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 text-white bg-black/50 md:bg-transparent absolute top-0 left-0 right-0 z-10 md:static">
                    <div className="min-w-0 pr-4">
                        <h3 className="font-medium text-base truncate" title={name}>{name}</h3>
                        <p className="text-xs text-white/70">{mimeType}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href={url}
                            download={name}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                            title="Download / Open Original"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Download size={20} />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Media */}
                <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
                    {isImage ? (
                        <img
                            src={url}
                            alt={name}
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
                        />
                    ) : isVideo ? (
                        <video
                            src={url}
                            controls
                            autoPlay
                            className="max-w-full max-h-full shadow-2xl rounded-sm bg-black"
                        />
                    ) : isPdf ? (
                        <iframe
                            src={url}
                            className="w-full h-full bg-white rounded shadow-2xl"
                            title={name}
                        />
                    ) : (
                        <div className="text-center text-white/80 p-8 bg-white/10 rounded-xl backdrop-blur">
                            <p className="mb-4 text-lg">Preview not available for this file type.</p>
                            <a
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded hover:bg-white/90 font-medium transition-colors"
                            >
                                <ExternalLink size={16} /> Open External
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};
