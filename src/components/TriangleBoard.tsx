import React, { useEffect, useMemo, useState } from 'react';
import { SHAPES } from '../utils/shapeDefinitions';
import './GameBoard.css';
import './TriangleBoard.css';

// 三角形单元格接口
interface TriangleCell {
  id: string;
  row: number;
  col: number;
  direction: 'UP' | 'DOWN';
  filled: boolean;
  shapeId?: number;
  shapeIds: number[];
}

const SHAPE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E2', '#F8B88B', '#52C0A1', '#E59866', '#AED6F1',
];

// 创建三角形棋盘
function createTriangleBoard(rows: number = 9): TriangleCell[] {
  const cells: TriangleCell[] = [];
  let id = 0;

  for (let r = 0; r < rows; r++) {
    const count = 2 * r + 1;
    for (let c = 0; c < count; c++) {
      const dir = c % 2 === 0 ? 'UP' : 'DOWN';
      cells.push({
        id: `cell-${id}`,
        row: r,
        col: c,
        direction: dir as 'UP' | 'DOWN',
        filled: false,
        shapeIds: [],
      });
      id++;
    }
  }

  return cells;
}

// 定义禁用的三角形位置
const DISABLED_CELLS = new Set<string>();

// 禁用的三角形编号：0（顶部） + 49,64,65,66（底部左侧） + 63,78,79,80（底部右侧）
[0, 49, 64, 65, 66, 63, 78, 79, 80].forEach(id => {
  DISABLED_CELLS.add(`cell-${id}`);
});

const TriangleBoard: React.FC = () => {
  const [board, setBoard] = useState<TriangleCell[]>([]);
  const [selectedShape, setSelectedShape] = useState<number | null>(null);
  const [, setHoveredTriangleId] = useState<number | null>(null);
  const [snappedTriangles, setSnappedTriangles] = useState<number[] | null>(null);
  const [movingShapeId, setMovingShapeId] = useState<number | null>(null);
  const [shapeRotations, setShapeRotations] = useState<Record<number, number>>({});
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [level, setLevel] = useState(1);
  const [filledCount, setFilledCount] = useState(0);

  // 右侧可见图形由棋盘占用状态实时推导，避免“放置后又出现”的状态不一致
  const placedShapes = useMemo(() => {
    return new Set(board.flatMap(cell => cell.shapeIds));
  }, [board]);

  useEffect(() => {
    const initialBoard = createTriangleBoard(9);
    setBoard(initialBoard);
  }, []);

  useEffect(() => {
    const filled = board.filter(cell => !DISABLED_CELLS.has(cell.id) && cell.filled).length;
    setFilledCount(filled);

    // 检查所有允许的三角形是否都被填充（81 - 9 禁用 = 72 个允许）
    const allowed = board.filter(cell => !DISABLED_CELLS.has(cell.id));
    if (allowed.length > 0 && allowed.every(cell => cell.filled)) {
      alert(`🎉 Level ${level} Complete!`);
      setLevel(level + 1);
      setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined, shapeIds: [] })));
      setMovingShapeId(null);
      setSelectedShape(null);
    }
  }, [board, level]);

  const getMappedTriangles = (
    shapeId: number,
    anchorTriangleId: number,
    allowOverlapShapeId?: number,
    rotationStep: number = 0
  ): number[] | null => {
    const shape = SHAPES.find(s => s.id === shapeId);
    if (!shape || shape.triangles.length === 0) return null;

    const sourceCells = shape.triangles
      .map(triangleId => board.find(c => c.id === `cell-${triangleId}`))
      .filter((cell): cell is TriangleCell => Boolean(cell));

    if (sourceCells.length !== shape.triangles.length) {
      return null;
    }

    const baseCellRef = sourceCells[0];
    const anchorCell = board.find(c => c.id === `cell-${anchorTriangleId}`);
    if (!baseCellRef || !anchorCell) return null;

    const normalizedRotation = ((rotationStep % 6) + 6) % 6;
    const angle = (normalizedRotation * Math.PI) / 3;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const baseCenter = getTriangleCenter(baseCellRef, triangleSize);
    const anchorCenter = getTriangleCenter(anchorCell, triangleSize);
    const candidates = board.filter(cell => !DISABLED_CELLS.has(cell.id));
    const usedCellIds = new Set<string>();
    const mappedTriangles: number[] = [];
    const snapDistance = triangleSize * 0.55;
    const snapDistanceSquared = snapDistance * snapDistance;

    for (const sourceCell of sourceCells) {
      const sourceCenter = getTriangleCenter(sourceCell, triangleSize);
      const relX = sourceCenter.x - baseCenter.x;
      const relY = sourceCenter.y - baseCenter.y;

      const rotatedRelX = relX * cosA - relY * sinA;
      const rotatedRelY = relX * sinA + relY * cosA;

      const targetX = anchorCenter.x + rotatedRelX;
      const targetY = anchorCenter.y + rotatedRelY;

      let nearestCell: TriangleCell | null = null;
      let minDistanceSquared = Number.POSITIVE_INFINITY;

      for (const candidate of candidates) {
        if (usedCellIds.has(candidate.id)) continue;

        const candidateCenter = getTriangleCenter(candidate, triangleSize);
        const dx = candidateCenter.x - targetX;
        const dy = candidateCenter.y - targetY;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < minDistanceSquared) {
          minDistanceSquared = distanceSquared;
          nearestCell = candidate;
        }
      }

      if (!nearestCell || minDistanceSquared > snapDistanceSquared) {
        return null;
      }

      usedCellIds.add(nearestCell.id);
      mappedTriangles.push(parseInt(nearestCell.id.replace('cell-', '')));
    }

    for (const triangleId of mappedTriangles) {
      const targetCell = board.find(c => c.id === `cell-${triangleId}`);
      if (!targetCell) return null;

      if (allowOverlapShapeId) {
        // 移动时仍允许与其他形状重叠，因此这里不拦截。
        void allowOverlapShapeId;
      }
    }

    return mappedTriangles;
  };

  const handleCellClick = (cellId: string) => {
    if (DISABLED_CELLS.has(cellId)) return;

    const clickedCell = board.find(c => c.id === cellId);
    if (!clickedCell) return;

    const clickedTriangleId = parseInt(cellId.replace('cell-', ''));

    // 移动端友好：拾取后可直接点目标格放下（无需拖拽释放）
    if (movingShapeId) {
      const rotationStep = shapeRotations[movingShapeId] ?? 0;
      const clickedCenter = getTriangleCenter(clickedCell, triangleSize);
      const bestSnap = findBestSnapPlacement(
        movingShapeId,
        clickedCenter.x,
        clickedCenter.y,
        rotationStep,
        movingShapeId
      );
      const mappedTriangles = snappedTriangles ?? bestSnap?.mappedTriangles ?? getMappedTriangles(movingShapeId, clickedTriangleId, movingShapeId, rotationStep);

      if (mappedTriangles) {
        const movingId = movingShapeId;
        setBoard(prevBoard =>
          prevBoard.map(cell => {
            const id = parseInt(cell.id.replace('cell-', ''));
            let nextShapeIds = cell.shapeIds.filter(shapeId => shapeId !== movingId);

            if (mappedTriangles.includes(id)) {
              nextShapeIds = [...nextShapeIds, movingId];
            }

            const nextTopShapeId = nextShapeIds.length > 0 ? nextShapeIds[nextShapeIds.length - 1] : undefined;
            return {
              ...cell,
              shapeIds: nextShapeIds,
              filled: nextShapeIds.length > 0,
              shapeId: nextTopShapeId,
            };
          })
        );
      }

      setMovingShapeId(null);
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
      return;
    }

    // 只有当从右侧选中了一个已定义的形状时，才能放置
    if (!selectedShape || !SHAPES.find(s => s.id === selectedShape)) return;

    const rotationStep = shapeRotations[selectedShape] ?? 0;
    const clickedCenter = getTriangleCenter(clickedCell, triangleSize);
    const bestSnap = findBestSnapPlacement(
      selectedShape,
      clickedCenter.x,
      clickedCenter.y,
      rotationStep
    );
    const mappedTriangles = snappedTriangles ?? bestSnap?.mappedTriangles ?? getMappedTriangles(selectedShape, clickedTriangleId, undefined, rotationStep);
    if (mappedTriangles) {
      setBoard(prevBoard =>
        prevBoard.map(cell => {
          const id = parseInt(cell.id.replace('cell-', ''));
          if (!mappedTriangles.includes(id)) return cell;

          const nextShapeIds = cell.shapeIds.includes(selectedShape)
            ? cell.shapeIds
            : [...cell.shapeIds, selectedShape];

          return {
            ...cell,
            shapeIds: nextShapeIds,
            filled: nextShapeIds.length > 0,
            shapeId: nextShapeIds[nextShapeIds.length - 1],
          };
        })
      );
      // 放置成功后，清除选择
      setSelectedShape(null);
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
    }
  };

  const handleCellMouseDown = (cellId: string) => {
    if (DISABLED_CELLS.has(cellId)) return;

    const cell = board.find(c => c.id === cellId);
    if (!cell || !cell.filled || !cell.shapeId) return;

    setMovingShapeId(cell.shapeId);
    setHoveredTriangleId(parseInt(cellId.replace('cell-', '')));
    setSnappedTriangles(null);
    setSelectedShape(null);
  };

  const removeShapeFromBoard = (shapeId: number) => {
    setBoard(prevBoard =>
      prevBoard.map(cell => {
        if (!cell.shapeIds.includes(shapeId)) {
          return cell;
        }

        const nextShapeIds = cell.shapeIds.filter(id => id !== shapeId);
        const nextTopShapeId = nextShapeIds.length > 0 ? nextShapeIds[nextShapeIds.length - 1] : undefined;

        return {
          ...cell,
          shapeIds: nextShapeIds,
          filled: nextShapeIds.length > 0,
          shapeId: nextTopShapeId,
        };
      })
    );
  };

  const rotatePlacedShapeAtCell = (shapeId: number, anchorCellId: string) => {
    const anchorCell = board.find(c => c.id === anchorCellId);
    if (!anchorCell) return;

    const nextRotation = ((shapeRotations[shapeId] ?? 0) + 1) % 6;
    const anchorCenter = getTriangleCenter(anchorCell, triangleSize);
    const bestSnap = findBestSnapPlacement(
      shapeId,
      anchorCenter.x,
      anchorCenter.y,
      nextRotation,
      shapeId
    );

    if (!bestSnap?.mappedTriangles) return;

    setShapeRotations(prev => ({
      ...prev,
      [shapeId]: nextRotation,
    }));

    setBoard(prevBoard =>
      prevBoard.map(cell => {
        const id = parseInt(cell.id.replace('cell-', ''));
        let nextShapeIds = cell.shapeIds.filter(idValue => idValue !== shapeId);

        if (bestSnap.mappedTriangles.includes(id)) {
          nextShapeIds = [...nextShapeIds, shapeId];
        }

        const nextTopShapeId = nextShapeIds.length > 0 ? nextShapeIds[nextShapeIds.length - 1] : undefined;
        return {
          ...cell,
          shapeIds: nextShapeIds,
          filled: nextShapeIds.length > 0,
          shapeId: nextTopShapeId,
        };
      })
    );

    setSnappedTriangles(bestSnap.mappedTriangles);
    setMovingShapeId(shapeId);
  };

  const handleShapeSelect = (shapeId: number) => {
    if (movingShapeId) return;

    if (selectedShape === shapeId) {
      rotateShape(shapeId);
      return;
    }

    setSelectedShape(shapeId);
  };

  const rotateShape = (shapeId: number) => {
    setShapeRotations(prev => ({
      ...prev,
      [shapeId]: ((prev[shapeId] ?? 0) + 1) % 6,
    }));
    setSnappedTriangles(null);
  };

  const handleShapeSectionPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!movingShapeId) return;

    event.preventDefault();
    event.stopPropagation();
    removeShapeFromBoard(movingShapeId);
    setMovingShapeId(null);
    setHoveredTriangleId(null);
    setSnappedTriangles(null);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'r' || event.key === 'R') && selectedShape) {
        rotateShape(selectedShape);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShape]);

  const getTriangleCoords = (cell: TriangleCell, size: number = 35): string => {
    const h = (size * Math.sqrt(3)) / 2;
    const rowY = cell.row * h;
    const offsetX = (10 - cell.row - 1) * (size / 2);
    const colX = offsetX + cell.col * (size / 2);

    if (cell.direction === 'UP') {
      return `${colX},${rowY} ${colX - size / 2},${rowY + h} ${colX + size / 2},${rowY + h}`;
    } else {
      return `${colX - size / 2},${rowY} ${colX + size / 2},${rowY} ${colX},${rowY + h}`;
    }
  };

  const getTriangleCenter = (cell: TriangleCell, size: number = 35): { x: number; y: number } => {
    const points = getTriangleCoords(cell, size)
      .split(' ')
      .map(c => c.split(',').map(Number));

    return {
      x: (points[0][0] + points[1][0] + points[2][0]) / 3,
      y: (points[0][1] + points[1][1] + points[2][1]) / 3,
    };
  };

  const expandTrianglePoints = (points: string, expandBy: number = 0.5): string => {
    const vertices = points.split(' ').map(point => {
      const [x, y] = point.split(',').map(Number);
      return { x, y };
    });

    const centerX = (vertices[0].x + vertices[1].x + vertices[2].x) / 3;
    const centerY = (vertices[0].y + vertices[1].y + vertices[2].y) / 3;

    return vertices
      .map(vertex => {
        const dx = vertex.x - centerX;
        const dy = vertex.y - centerY;
        const length = Math.hypot(dx, dy) || 1;
        const nx = dx / length;
        const ny = dy / length;
        return `${vertex.x + nx * expandBy},${vertex.y + ny * expandBy}`;
      })
      .join(' ');
  };

  // 为预览计算三角形坐标的函数 - 基于相对位置
  const getPreviewTriangleCoords = (cell: TriangleCell, baseCell: TriangleCell, size: number = 50, centerX: number = 100, centerY: number = 125): string => {
    const h = (size * Math.sqrt(3)) / 2;
    
    // 计算相对于基准三角形的偏移
    const rowDiff = cell.row - baseCell.row;
    const colDiff = cell.col - baseCell.col;
    
    // 计算offsetX的变化：当row变化时，offsetX会改变
    const offsetXBase = (10 - baseCell.row - 1) * (size / 2);
    const offsetXCell = (10 - cell.row - 1) * (size / 2);
    const offsetXDiff = offsetXCell - offsetXBase;
    
    const rowY = rowDiff * h + centerY;
    const colX = colDiff * (size / 2) + offsetXDiff + centerX;

    if (cell.direction === 'UP') {
      return `${colX},${rowY} ${colX - size / 2},${rowY + h} ${colX + size / 2},${rowY + h}`;
    } else {
      return `${colX - size / 2},${rowY} ${colX + size / 2},${rowY} ${colX},${rowY + h}`;
    }
  };

  const getFittedPreviewPolygons = (
    triangleIds: number[],
    size: number,
    canvasSize: number,
    padding: number,
    rotationStep: number = 0,
    allowUpscale: boolean = true
  ): string[] => {
    const shapeCells = triangleIds
      .map(triangleId => board.find(c => c.id === `cell-${triangleId}`))
      .filter((cell): cell is TriangleCell => Boolean(cell));

    if (shapeCells.length !== triangleIds.length || shapeCells.length === 0) {
      return [];
    }

    const baseCell = shapeCells[0];
    const rawPolygons = shapeCells.map(cell =>
      getPreviewTriangleCoords(cell, baseCell, size, 0, 0)
    );

    const parsedPolygons = rawPolygons.map(poly =>
      poly.split(' ').map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      })
    );

    const rawPoints = parsedPolygons.flat();
    const originMinX = Math.min(...rawPoints.map(p => p.x));
    const originMaxX = Math.max(...rawPoints.map(p => p.x));
    const originMinY = Math.min(...rawPoints.map(p => p.y));
    const originMaxY = Math.max(...rawPoints.map(p => p.y));
    const rotateCenterX = (originMinX + originMaxX) / 2;
    const rotateCenterY = (originMinY + originMaxY) / 2;
    const angle = (((rotationStep % 6) + 6) % 6) * (Math.PI / 3);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const rotatedPolygons = parsedPolygons.map(points =>
      points.map(point => {
        if (angle === 0) return point;
        const relX = point.x - rotateCenterX;
        const relY = point.y - rotateCenterY;
        return {
          x: relX * cosA - relY * sinA + rotateCenterX,
          y: relX * sinA + relY * cosA + rotateCenterY,
        };
      })
    );

    const rotatedPoints = rotatedPolygons.flat();

    const minX = Math.min(...rotatedPoints.map(p => p.x));
    const maxX = Math.max(...rotatedPoints.map(p => p.x));
    const minY = Math.min(...rotatedPoints.map(p => p.y));
    const maxY = Math.max(...rotatedPoints.map(p => p.y));

    const rawWidth = Math.max(maxX - minX, 1);
    const rawHeight = Math.max(maxY - minY, 1);
    const available = Math.max(canvasSize - padding * 2, 1);
    const fitScale = Math.min(available / rawWidth, available / rawHeight);
    const scale = allowUpscale ? fitScale : Math.min(fitScale, 1);

    const fittedWidth = rawWidth * scale;
    const fittedHeight = rawHeight * scale;
    const offsetX = padding + (available - fittedWidth) / 2;
    const offsetY = padding + (available - fittedHeight) / 2;

    return rotatedPolygons.map(points => {
      const transformed = points.map(({ x, y }) => {
        const tx = (x - minX) * scale + offsetX;
        const ty = (y - minY) * scale + offsetY;
        return `${tx},${ty}`;
      });

      return transformed.join(' ');
    });
  };

  const triangleSize = 65; // 三角形的边长
  const panelPreviewScale = 0.62;
  const panelPreviewTriangleSize = triangleSize * panelPreviewScale;
  const h = (triangleSize * Math.sqrt(3)) / 2;
  const svgHeight = 9 * h + 40;
  const svgWidth = 18 * triangleSize / 2 + 40;
  const activePreviewShapeId = movingShapeId ?? selectedShape;
  const panelPreviewCanvasSize = 140;
  const carryPreviewCanvasSize = 220;

  useEffect(() => {
    if (!activePreviewShapeId) {
      setCursorPosition(null);
      return;
    }

    const handleGlobalMouseMove = (event: PointerEvent) => {
      setCursorPosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('pointermove', handleGlobalMouseMove);
    return () => window.removeEventListener('pointermove', handleGlobalMouseMove);
  }, [activePreviewShapeId]);

  const cellCenters = useMemo(() => {
    return board
      .filter(cell => !DISABLED_CELLS.has(cell.id))
      .map(cell => {
        const center = getTriangleCenter(cell, triangleSize);
        return {
          id: parseInt(cell.id.replace('cell-', '')),
          x: center.x,
          y: center.y,
        };
      });
  }, [board]);

  const centerById = useMemo(() => {
    const result = new Map<number, { x: number; y: number }>();
    for (const cell of cellCenters) {
      result.set(cell.id, { x: cell.x, y: cell.y });
    }
    return result;
  }, [cellCenters]);

  const findBestSnapPlacement = (
    shapeId: number,
    mouseX: number,
    mouseY: number,
    rotationStep: number,
    allowOverlapShapeId?: number
  ): { anchorId: number; mappedTriangles: number[]; score: number } | null => {
    if (cellCenters.length === 0) return null;

    let best: { anchorId: number; mappedTriangles: number[]; score: number } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const anchor of cellCenters) {
      const mappedTriangles = getMappedTriangles(shapeId, anchor.id, allowOverlapShapeId, rotationStep);
      if (!mappedTriangles || mappedTriangles.length === 0) continue;

      let sumX = 0;
      let sumY = 0;
      let valid = true;
      for (const triangleId of mappedTriangles) {
        const center = centerById.get(triangleId);
        if (!center) {
          valid = false;
          break;
        }
        sumX += center.x;
        sumY += center.y;
      }

      if (!valid) continue;

      const centroidX = sumX / mappedTriangles.length;
      const centroidY = sumY / mappedTriangles.length;
      const dx = centroidX - mouseX;
      const dy = centroidY - mouseY;
      const score = dx * dx + dy * dy;

      if (score < bestScore) {
        bestScore = score;
        best = { anchorId: anchor.id, mappedTriangles, score };
      }
    }

    return best;
  };

  const getTrianglesSignature = (triangles: number[]) => {
    return [...triangles].sort((a, b) => a - b).join('-');
  };

  const getPlacementScoreAtMouse = (triangles: number[], mouseX: number, mouseY: number): number | null => {
    if (triangles.length === 0) return null;

    let sumX = 0;
    let sumY = 0;
    for (const triangleId of triangles) {
      const center = centerById.get(triangleId);
      if (!center) return null;
      sumX += center.x;
      sumY += center.y;
    }

    const centroidX = sumX / triangles.length;
    const centroidY = sumY / triangles.length;
    const dx = centroidX - mouseX;
    const dy = centroidY - mouseY;
    return dx * dx + dy * dy;
  };

  const handleBoardMouseMove = (event: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>) => {
    if (!activePreviewShapeId || cellCenters.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const mouseY = ((event.clientY - rect.top) / rect.height) * svgHeight;

    const rotationStep = shapeRotations[activePreviewShapeId] ?? 0;
    const bestSnap = findBestSnapPlacement(
      activePreviewShapeId,
      mouseX,
      mouseY,
      rotationStep,
      movingShapeId ?? undefined
    );

    if (!bestSnap) {
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
      return;
    }

    if (!snappedTriangles) {
      setHoveredTriangleId(bestSnap.anchorId);
      setSnappedTriangles(bestSnap.mappedTriangles);
      return;
    }

    const prevSig = getTrianglesSignature(snappedTriangles);
    const nextSig = getTrianglesSignature(bestSnap.mappedTriangles);
    if (prevSig === nextSig) {
      setHoveredTriangleId(bestSnap.anchorId);
      return;
    }

    const currentScore = getPlacementScoreAtMouse(snappedTriangles, mouseX, mouseY);
    if (currentScore === null) {
      setHoveredTriangleId(bestSnap.anchorId);
      setSnappedTriangles(bestSnap.mappedTriangles);
      return;
    }

    // 吸附阻尼：新候选需要明显更优才切换，减少边缘抖动。
    const hysteresis = triangleSize * triangleSize * 0.35;
    if (bestSnap.score + hysteresis < currentScore) {
      setHoveredTriangleId(bestSnap.anchorId);
      setSnappedTriangles(bestSnap.mappedTriangles);
    }
  };

  const handleBoardMouseLeave = () => {
    setHoveredTriangleId(null);
    setSnappedTriangles(null);
  };

  // 限制最大尺寸，占用左侧2/3空间
  const displayWidth = Math.min(svgWidth, 800);
  const displayHeight = Math.min(svgHeight, 900);

  return (
    <div className="game-container triangle-game-container">
      <div className="game-header">
        <h1>Triangle Fill Game</h1>
        <div className="stats">
          <span>Level: {level}</span>
          <span>Filled: {filledCount}/72</span>
        </div>
      </div>

      <div className="game-content">
        {/* 左侧：游戏棋盘 */}
        <div className="board-section">
          <div className="board-wrapper">
            <svg
              width={displayWidth}
              height={displayHeight}
              className="triangle-board"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              onPointerMove={handleBoardMouseMove}
              onMouseLeave={handleBoardMouseLeave}
            >
              {board.map(cell => {
                const isDisabled = DISABLED_CELLS.has(cell.id);
                const topShapeId = cell.shapeIds.length > 0 ? cell.shapeIds[cell.shapeIds.length - 1] : undefined;
                let fill: string;

                if (isDisabled) {
                  // 禁用的三角形完全透明
                  fill = 'transparent';
                } else if (cell.shapeIds.length > 0) {
                  fill = SHAPE_COLORS[topShapeId ? topShapeId - 1 : 0];
                } else {
                  fill = '#fff';
                }

                return (
                  <g key={cell.id}>
                    <polygon
                      points={expandTrianglePoints(getTriangleCoords(cell, triangleSize), 0.55)}
                      fill={fill}
                      stroke="none"
                      strokeWidth="0"
                      className="triangle-cell"
                      onPointerDown={() => handleCellMouseDown(cell.id)}
                      onDoubleClick={() => {
                        const shapeId = cell.shapeIds[cell.shapeIds.length - 1];
                        if (!shapeId || selectedShape) return;
                        rotatePlacedShapeAtCell(shapeId, cell.id);
                      }}
                      onClick={() => handleCellClick(cell.id)}
                      style={{
                        cursor: isDisabled
                          ? 'default'
                          : movingShapeId
                          ? 'grabbing'
                          : cell.shapeIds.length > 0
                          ? 'grab'
                          : selectedShape
                          ? 'pointer'
                          : 'default',
                        pointerEvents: isDisabled ? 'none' : 'auto',
                      }}
                    />
                  </g>
                );
              })}

              {/* 虚拟形状显示 - 跟随鼠标 */}
              {activePreviewShapeId && snappedTriangles && SHAPES.find(s => s.id === activePreviewShapeId) && (
                (() => {
                  const shapeId = activePreviewShapeId;
                  const mappedTriangles = snappedTriangles;
                  if (!mappedTriangles) return null;

                  return mappedTriangles.map(triangleId => {
                    const cell = board.find(c => c.id === `cell-${triangleId}`);
                    if (!cell) return null;
                    
                    return (
                      <polygon
                        key={`follow-${triangleId}`}
                        points={expandTrianglePoints(getTriangleCoords(cell, triangleSize), 0.55)}
                        fill={SHAPE_COLORS[shapeId - 1]}
                        stroke="none"
                        strokeWidth="0"
                        opacity="0.4"
                        pointerEvents="none"
                      />
                    );
                  });
                })()
              )}
            </svg>
          </div>
        </div>

        {/* 右侧：形状选择与预览 */}
        <div className="shape-section" onPointerUp={handleShapeSectionPointerUp}>
          <h2 className="shape-title">Shapes</h2>
          <div className="shapes-grid">
            {/* 显示12个形状的预览网格 */}
            {Array.from({ length: 12 }).map((_, idx) => {
              const shape = SHAPES.find(s => s.id === idx + 1);
              const isSelected = selectedShape === idx + 1;
              const isPlaced = placedShapes.has(idx + 1);
              
              // 隐藏未定义的形状（不在SHAPES中的形状）
              if (!shape) {
                return null;
              }
              
              // 隐藏已放置的形状
              if (isPlaced) {
                return null;
              }
              
              return (
                <button
                  key={idx + 1}
                  type="button"
                  className={`shape-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleShapeSelect(idx + 1)}
                  onContextMenu={event => {
                    event.preventDefault();
                    rotateShape(idx + 1);
                  }}
                  title="左键选中，再次点击旋转；右键也可旋转"
                >
                  <svg
                    width={panelPreviewCanvasSize}
                    height={panelPreviewCanvasSize}
                    viewBox={`0 0 ${panelPreviewCanvasSize} ${panelPreviewCanvasSize}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {shape ? (
                      <>
                        {getFittedPreviewPolygons(
                          shape.triangles,
                          panelPreviewTriangleSize,
                          panelPreviewCanvasSize,
                          10,
                          shapeRotations[shape.id] ?? 0
                        ).map(
                          (points, polygonIndex) => {
                            const color = SHAPE_COLORS[idx];
                            return (
                              <polygon
                                key={`${shape.id}-${polygonIndex}`}
                                points={expandTrianglePoints(points, 0.45)}
                                fill={color}
                                stroke="none"
                                strokeWidth="0"
                                opacity="0.95"
                              />
                            );
                          }
                        )}
                      </>
                    ) : null}
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="game-footer">
        <button className="btn btn-primary" onClick={() => {
          setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined, shapeIds: [] })));
          setSelectedShape(null);
          setMovingShapeId(null);
          setHoveredTriangleId(null);
          setSnappedTriangles(null);
        }}>
          Clear Board
        </button>
      </div>

      {activePreviewShapeId && cursorPosition && (
        <div
          className="floating-shape-preview"
          style={{
            left: cursorPosition.x,
            top: cursorPosition.y,
          }}
        >
          <svg
            width={carryPreviewCanvasSize}
            height={carryPreviewCanvasSize}
            viewBox={`0 0 ${carryPreviewCanvasSize} ${carryPreviewCanvasSize}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {(() => {
              const shape = SHAPES.find(s => s.id === activePreviewShapeId);
              if (!shape) return null;

              const rotationStep = shapeRotations[shape.id] ?? 0;
              return getFittedPreviewPolygons(
                shape.triangles,
                triangleSize,
                carryPreviewCanvasSize,
                8,
                rotationStep,
                false
              ).map((points, polygonIndex) => (
                <polygon
                  key={`cursor-preview-${shape.id}-${polygonIndex}`}
                  points={expandTrianglePoints(points, 0.45)}
                  fill={SHAPE_COLORS[activePreviewShapeId - 1]}
                  stroke="none"
                  strokeWidth="0"
                  opacity="0.7"
                />
              ));
            })()}
          </svg>
        </div>
      )}
    </div>
  );
};

export default TriangleBoard;
