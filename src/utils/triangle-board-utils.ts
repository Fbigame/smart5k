export interface TriangleCell {
  id: string;
  row: number;
  col: number;
  direction: 'UP' | 'DOWN';
  filled: boolean;
  shapeId?: number;
}

export function createTriangleBoard(rows: number = 9): TriangleCell[] {
  const cells: TriangleCell[] = [];
  let id = 0;

  for (let r = 0; r < rows; r++) {
    const count = 2 * r + 1;
    
    // 跳过第0行（移除顶部1个三角）
    if (r === 0) continue;

    for (let c = 0; c < count; c++) {
      // 跳过最后两行的边角三角（左下角和右下角各4个）
      if (r >= 7) {
        // 第7行(15个): 跳过最左2个和最右2个
        // 第8行(17个): 跳过最左2个和最右2个
        if (c < 2 || c >= count - 2) {
          continue;
        }
      }

      const dir = c % 2 === 0 ? 'UP' : 'DOWN';
      cells.push({
        id: `cell-${id}`,
        row: r,
        col: c,
        direction: dir as 'UP' | 'DOWN',
        filled: false,
      });
      id++;
    }
  }

  return cells;
}
