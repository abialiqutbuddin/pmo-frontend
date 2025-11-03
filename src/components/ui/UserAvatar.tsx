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

type Props = {
  nameOrEmail: string;
  imageUrl?: string | null;
  itsId?: string | null;
  size?: number; // px
  className?: string;
};

export const UserAvatar: React.FC<Props> = ({ nameOrEmail, imageUrl, itsId, size = 36, className }) => {
  // Track which source we're trying so we can fall back and log failures
  const [srcIndex, setSrcIndex] = useState(0);
  const initials = useMemo(() => initialsFrom(nameOrEmail), [nameOrEmail]);
  const style: React.CSSProperties = { width: size, height: size, minWidth: size, minHeight: size };

  const itsUrlFrom = (id: string) => `${BASE_URL}/media/avatar/its/${id}`;

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
        if (imageUrl.startsWith('data:')) arr.push(imageUrl);
        else arr.push(`${BASE_URL}/media/proxy?url=${encodeURIComponent(imageUrl)}`);
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
        <img
          src={src}
          alt={nameOrEmail}
          className="w-full h-full object-cover"
          onError={handleError}
          loading="lazy"
          decoding="async"
          crossOrigin={isLocal ? undefined : 'anonymous'}
          referrerPolicy={!isLocal ? 'no-referrer' : undefined}
        />
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

export default React.memo(UserAvatar, (prev, next) => (
  prev.nameOrEmail === next.nameOrEmail &&
  prev.imageUrl === next.imageUrl &&
  prev.itsId === next.itsId &&
  prev.size === next.size &&
  prev.className === next.className
));
