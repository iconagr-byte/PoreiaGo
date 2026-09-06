/** Convert a data: URL into a File for multipart upload. */
export async function dataUrlToFile(dataUrl, basename = 'image') {
  const value = String(dataUrl || '');
  if (!value.startsWith('data:')) {
    throw new Error('Not a data URL');
  }
  const res = await fetch(value);
  const blob = await res.blob();
  const type = blob.type || 'image/jpeg';
  let ext = 'jpg';
  if (type.includes('png')) ext = 'png';
  else if (type.includes('webp')) ext = 'webp';
  else if (type.includes('gif')) ext = 'gif';
  const name = String(basename).includes('.') ? basename : `${basename}.${ext}`;
  return new File([blob], name, { type });
}
