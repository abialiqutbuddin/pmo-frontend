import React, { useMemo, useState } from 'react';
import { BASE_URL } from '../../api';

function initialsFrom(nameOrEmail: string) {
  if (!nameOrEmail) return 'NA';
  const str = nameOrEmail.trim();
  const parts = str.includes('@') ? str.split('@')[0].split(/[._\s-]+/) : str.split(/[\s]+/);
  const first = (parts[0] || '').charAt(0).toUpperCase();
  const second = (parts[1] || '').charAt(0).toUpperCase();
  return (first + second) || first || 'NA';
}

export const UserAvatar: React.FC<{
  nameOrEmail: string;
  imageUrl?: string | null;
  itsId?: string | null;
  size?: number; // px
  className?: string;
}> = ({ nameOrEmail, imageUrl, itsId, size = 36, className }) => {
  // Track which source we're trying so we can fall back and log failures
  const [srcIndex, setSrcIndex] = useState(0);
  const initials = useMemo(() => initialsFrom(nameOrEmail), [nameOrEmail]);
  const style: React.CSSProperties = { width: size, height: size, minWidth: size, minHeight: size };

  const itsUrlFrom = (id: string) => `https://followup.qardanhasana.in/assets/img/mumin_photos/${id}.jpg`;

  const sources = useMemo(() => {
    const arr: string[] = [];
    // Always prefer ITS photo first when ITS id is available
    if (itsId) arr.push(itsUrlFrom(itsId));
    // Then consider imageUrl if provided
    if (imageUrl) {
      if (/^\d{7,8}$/.test(imageUrl)) {
        // Numeric looks like ITS id
        arr.push(itsUrlFrom(imageUrl));
      } else if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) {
        arr.push(imageUrl);
      } else {
        const trimmed = imageUrl.replace(/^\/+/, '');
        arr.push(`${BASE_URL}/${trimmed}`);
      }
    }
    return arr;
  }, [imageUrl, itsId]);
  const src = sources[srcIndex] || null;
  const basePrefix = (BASE_URL || '').replace(/\/$/, '');
  const isLocal = !!(src && basePrefix && src.startsWith(basePrefix));
  const isLinkMode = !!(src && !isLocal); // only apply letterbox/contain for external link images (ITS or absolute)

  const handleError = () => {
    if (src) {
      // Log which URL failed, helps debug ITS images or relative paths
      // eslint-disable-next-line no-console
      console.warn('[UserAvatar] image load failed:', src, { nameOrEmail, itsId });
    }
    // Try next source if available, else render initials
    setSrcIndex((i) => i + 1);
  };

  if (src) {
    return (
      <div
        style={style}
        className={`relative rounded-full overflow-hidden border border-white/10 flex-shrink-0 ${className || ''}`}
        title={nameOrEmail}
      >
        {isLinkMode ? (
          <>
            {/* blurred background to create side bars when letterboxing */}
            <img
              src={src}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
              onError={handleError}
            />
            {/* contained foreground (zoomed out) */}
            <img
              src={src}
              alt={nameOrEmail}
              className="relative w-full h-full object-contain"
              onError={handleError}
            />
          </>
        ) : (
          <img
            src={src}
            alt={nameOrEmail}
            className="w-full h-full object-cover"
            onError={handleError}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={style}
      className={`rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold flex-shrink-0 ${className || ''}`}
      title={nameOrEmail}
    >
      {initials}
    </div>
  );
};
