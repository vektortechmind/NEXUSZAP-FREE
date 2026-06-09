export type Point = { x: number; y: number };

export function getViewportAwareMenuPosition(input: {
  position: Point;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}): Point {
  const margin = input.margin ?? 8;
  const menuWidth = input.menuWidth || 176;
  const menuHeight = input.menuHeight || 200;
  let { x, y } = input.position;

  if (x + menuWidth + margin > input.viewportWidth) {
    x = input.viewportWidth - menuWidth - margin;
  }
  if (y + menuHeight + margin > input.viewportHeight) {
    y = input.position.y - menuHeight;
  }
  if (x < margin) x = margin;
  if (y < margin) y = margin;

  return { x, y };
}
