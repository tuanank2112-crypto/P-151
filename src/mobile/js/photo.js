// Photo compression and picker (plan 11, SPEC-P01 §8). The API takes JPG/PNG/WEBP up to 5 MB, at most 5 per ticket.
import { ApiError } from './api.js?v=19';
import { el, icon, toast } from './ui.js?v=19';

export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.82;
export const MAX_PHOTOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back to <img>, e.g. older Safari */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Any image the browser can decode → JPEG Blob, longest edge ≤ PHOTO_MAX_EDGE, under 5 MB. */
export async function compressImage(file) {
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new ApiError('Không đọc được ảnh này, hãy chọn ảnh JPG/PNG', { kind: 'invalid' });
  }
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source.close) source.close();
  let blob = await toJpeg(canvas, PHOTO_QUALITY);
  if (blob && blob.size > MAX_BYTES) blob = await toJpeg(canvas, 0.6);
  if (!blob || blob.size > MAX_BYTES) throw new ApiError('Ảnh quá lớn sau khi nén', { kind: 'invalid' });
  return blob;
}

/** multipart body for POST …/photos: field `files`, one entry per photo. */
export function photoFormData(blobs) {
  const form = new FormData();
  blobs.forEach((blob, i) => form.append('files', blob, `photo-${i + 1}.jpg`));
  return form;
}

/**
 * Picker in the portal ".drop" box: a camera button, a library button and a preview row of ".thumb" squares.
 * Photos are compressed as soon as they are picked. `room()` = how many more photos the ticket can take;
 * `onChange(count)` runs after every add/remove (the resident form summary shows the count).
 */
export function photoPicker({ room = () => MAX_PHOTOS, onChange = null } = {}) {
  const picked = []; // { blob, url }
  const grid = el('div', { class: 'photos' });
  const counter = el('span', { class: 'drop-hint' });
  const camera = el('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, class: 'sr' });
  const library = el('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr' });
  const cameraBtn = el('button', { type: 'button', class: 'btn primary', onclick: () => camera.click() }, icon('camera'), 'Chụp ảnh');
  const libraryBtn = el('button', { type: 'button', class: 'btn', onclick: () => library.click() }, icon('image'), 'Chọn ảnh');
  const drop = el('div', { class: 'drop' },
    el('span', { class: 'drop-icon' }, icon('upload')),
    el('div', { class: 'photo-actions' }, cameraBtn, libraryBtn),
    counter, camera, library);
  const root = el('div', { class: 'picker' }, grid, drop);

  const refresh = () => {
    root.dataset.dirty = picked.length ? '1' : ''; // photos not sent yet: the periodic refresh must not redraw
    grid.replaceChildren(...picked.map((p, i) => el('div', { class: 'ph thumb' },
      el('img', { src: p.url, alt: `Ảnh ${i + 1}` }),
      el('button', { type: 'button', class: 'x', 'aria-label': `Bỏ ảnh ${i + 1}`, onclick: () => remove(i) }, '×'))));
    grid.hidden = picked.length === 0;
    const left = Math.max(0, room() - picked.length);
    counter.textContent = left ? `Còn ${left} ảnh · ảnh tự nén trước khi gửi` : `Đã đủ ${MAX_PHOTOS} ảnh`;
    cameraBtn.disabled = libraryBtn.disabled = left <= 0;
    if (onChange) onChange(picked.length);
  };
  const remove = (i) => {
    URL.revokeObjectURL(picked[i].url);
    picked.splice(i, 1);
    refresh();
  };
  const onPick = async (input) => {
    const files = [...input.files];
    input.value = '';
    for (const file of files) {
      if (picked.length >= room()) {
        toast(`Tối đa ${MAX_PHOTOS} ảnh cho một phản ánh`, 'warn');
        break;
      }
      try {
        const blob = await compressImage(file);
        picked.push({ blob, url: URL.createObjectURL(blob) });
      } catch (error) {
        toast(error.message, 'error');
      }
    }
    refresh();
  };
  camera.addEventListener('change', () => onPick(camera));
  library.addEventListener('change', () => onPick(library));
  refresh();

  return {
    node: root,
    blobs: () => picked.map((p) => p.blob),
    hasPhotos: () => picked.length > 0,
    clear: () => { picked.forEach((p) => URL.revokeObjectURL(p.url)); picked.length = 0; refresh(); },
  };
}
