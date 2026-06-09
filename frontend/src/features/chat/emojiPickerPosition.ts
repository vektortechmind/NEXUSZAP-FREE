export type RectLike = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">;

export type PopupPosition = { left: number; top: number };

export function getViewportAwarePopupPosition(input: {
  anchorRect: RectLike;
  popupWidth: number;
  popupHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
  offset?: number;
}): PopupPosition {
  const margin = input.margin ?? 8;
  const offset = input.offset ?? 8;
  const centeredLeft = input.anchorRect.left + input.anchorRect.width / 2 - input.popupWidth / 2;
  const maxLeft = input.viewportWidth - input.popupWidth - margin;
  const left = Math.max(margin, Math.min(centeredLeft, maxLeft));

  const belowTop = input.anchorRect.bottom + offset;
  const aboveTop = input.anchorRect.top - input.popupHeight - offset;
  const hasRoomBelow = belowTop + input.popupHeight + margin <= input.viewportHeight;
  const hasRoomAbove = aboveTop >= margin;
  const preferredTop = hasRoomBelow || !hasRoomAbove ? belowTop : aboveTop;
  const maxTop = input.viewportHeight - input.popupHeight - margin;
  const top = Math.max(margin, Math.min(preferredTop, maxTop));

  return { left, top };
}
