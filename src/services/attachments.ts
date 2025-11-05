// frontend/src/services/attachments.ts
import { api, BASE_URL } from '../api';
import { useAuthStore } from '../store/authStore';

export type AttachmentEntityType = 'Task' | 'Feedback' | 'Message';

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size?: number;
  bytes?: number;
  createdAt: string;
  objectKey?: string;
}

export const attachmentsService = {
  list: (eventId: string, entityType: AttachmentEntityType, entityId: string) =>
    api.get<Attachment[]>(`/events/${eventId}/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`),
  upload: (eventId: string, entityType: AttachmentEntityType, entityId: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('entityType', entityType);
    fd.append('entityId', entityId);
    return api.post<void>(`/events/${eventId}/attachments/upload`, fd);
  },
  remove: (eventId: string, id: string) => api.delete<void>(`/events/${eventId}/attachments/${encodeURIComponent(id)}`),
  uploadWithProgress: (eventId: string, entityType: AttachmentEntityType, entityId: string, file: File, onProgress?: (pct: number) => void) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/events/${encodeURIComponent(eventId)}/attachments/upload`);
      const token = useAuthStore.getState().accessToken;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress?.(pct);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(xhr.responseText || `Upload failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entityType', entityType);
      fd.append('entityId', entityId);
      xhr.send(fd);
    });
  },
};
