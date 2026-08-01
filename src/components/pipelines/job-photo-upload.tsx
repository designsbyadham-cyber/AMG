'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { UploadCloud, X, Loader2, ImagePlus } from 'lucide-react';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — matches the job-photos bucket cap
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/heic',
]);

interface JobPhotoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

/**
 * Job photo attachments. Uploads to the public `job-photos` bucket
 * under `{auth.uid()}/...` (same path/RLS shape as avatars/flow-media)
 * and hands the resulting public URLs back via onChange. Optional and
 * multi-image. Removing a thumbnail drops the URL from the list; the
 * stored object is left in place (cheap, and matches the avatar flow).
 */
export function JobPhotoUpload({ value, onChange }: JobPhotoUploadProps) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Not signed in');
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];

    for (const file of Array.from(files)) {
      if (!ALLOWED_MIME.has(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: over 10 MB`);
        continue;
      }
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('job-photos')
        .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });
      if (error) {
        toast.error(`${file.name}: upload failed`);
        continue;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('job-photos').getPublicUrl(path);
      uploaded.push(publicUrl);
    }

    setUploading(false);
    if (uploaded.length) onChange([...value, ...uploaded]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/heic"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Dropzone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/40 disabled:opacity-60"
      >
        {uploading ? (
          <Loader2 className="size-6 animate-spin text-primary" />
        ) : (
          <UploadCloud className="size-6 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">
          {uploading ? 'Uploading…' : 'Add job photos'}
        </span>
        <span className="text-xs text-muted-foreground">
          PNG, JPG, WEBP up to 10&nbsp;MB · multiple allowed
        </span>
      </button>

      {/* Thumbnails */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((url, i) => (
            <div
              key={url}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Job photo ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-60"
          >
            <ImagePlus className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
