/** Helpers για drag & drop blocks στον campaign editor. */

export const DND_BLOCK_TYPE = 'application/x-emh-block-type';
export const DND_BLOCK_ID = 'application/x-emh-block-id';

export function reorderBlocks(list, fromId, toIndex) {
  const fromIdx = list.findIndex((b) => b.id === fromId);
  if (fromIdx < 0) return list;
  let toIdx = Math.max(0, Math.min(toIndex, list.length));
  if (fromIdx === toIdx) return list;
  const copy = [...list];
  const [moved] = copy.splice(fromIdx, 1);
  if (fromIdx < toIdx) toIdx -= 1;
  copy.splice(toIdx, 0, moved);
  return copy;
}

export function insertBlockAt(list, block, index) {
  const copy = [...list];
  const idx = Math.max(0, Math.min(index, copy.length));
  copy.splice(idx, 0, block);
  return copy;
}

export function readDragPayload(dataTransfer) {
  const blockType = dataTransfer.getData(DND_BLOCK_TYPE) || dataTransfer.getData('text/plain');
  const blockId = dataTransfer.getData(DND_BLOCK_ID);
  const paletteTypes = ['header', 'text', 'image', 'cta', 'product'];
  const type = paletteTypes.includes(blockType) ? blockType : null;
  return { blockType: type, blockId: blockId || null };
}
