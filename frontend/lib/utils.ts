export function formatBytes(bytes: number | bigint | string, decimals = 2): string {
  const n = typeof bytes === 'bigint' ? Number(bytes) : Number(bytes);
  if (n === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export function getMimeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar')) return '🗜️';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('text')) return '📃';
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('typescript')) return '💻';
  return '📁';
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
export function validateFileSize(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `File "${file.name}" exceeds the 5 GB limit`;
  return null;
}
