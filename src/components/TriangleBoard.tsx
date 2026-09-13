import React, { useEffect, useMemo, useRef, useState } from 'react';
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

interface ShapeActionMenuState {
  shapeId: number;
  x: number;
  y: number;
  source: 'board' | 'panel';
  anchorCellId?: string;
}

type QuickActionMode = 'none' | 'rotate' | 'flip';

export interface LevelClearRecord {
  hash: string;
  clearedAt: string;
  shapeLayouts: Array<{
    shapeId: number;
    rotation: number;
    flipped: boolean;
    triangles: number[];
  }>;
  cellStacks: Array<{
    cellId: number;
    shapeIds: number[];
  }>;
}

interface TriangleBoardProps {
  onLevelCleared?: (record: LevelClearRecord) => void;
}

const SHAPE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E2', '#F8B88B', '#52C0A1', '#E59866', '#AED6F1',
];

const getShapeOutlineColor = (hexColor: string): string => {
  const hex = hexColor.replace('#', '');
  if (hex.length !== 6) return '#1f4f7f';

  const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16)));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16)));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16)));

  const darken = (value: number) => Math.max(0, Math.round(value * 0.6));
  const toHex = (value: number) => value.toString(16).padStart(2, '0');

  return `#${toHex(darken(r))}${toHex(darken(g))}${toHex(darken(b))}`;
};

const MIRROR_SYMMETRIC_SHAPE_IDS = new Set([1, 2, 5, 6, 11]);
const LEVEL_CLEAR_RECORDS_KEY = 'triangle-level-clear-records';

function hashStringFNV1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getRowByTriangleId(triangleId: number): number {
  return Math.floor(Math.sqrt(triangleId));
}

function mirrorTriangleIdHorizontally(triangleId: number): number {
  const row = getRowByTriangleId(triangleId);
  const rowStart = row * row;
  const col = triangleId - rowStart;
  const mirroredCol = 2 * row - col;
  return rowStart + mirroredCol;
}

function buildLevelClearRecord(
  board: TriangleCell[],
  shapeRotations: Record<number, number>,
  shapeFlips: Record<number, boolean>
): LevelClearRecord {
  const shapeIdSet = new Set<number>();
  for (const cell of board) {
    for (const shapeId of cell.shapeIds) {
      shapeIdSet.add(shapeId);
    }
  }

  const shapeLayouts = [...shapeIdSet]
    .sort((a, b) => a - b)
    .map(shapeId => {
      const triangles = board
        .filter(cell => cell.shapeIds.includes(shapeId))
        .map(cell => parseInt(cell.id.replace('cell-', '')))
        .sort((a, b) => a - b);

      return {
        shapeId,
        rotation: shapeRotations[shapeId] ?? 0,
        flipped: shapeFlips[shapeId] ?? false,
        triangles,
      };
    });

  const cellStacks = board
    .filter(cell => cell.shapeIds.length > 0)
    .map(cell => ({
      cellId: parseInt(cell.id.replace('cell-', '')),
      shapeIds: [...cell.shapeIds],
    }))
    .sort((a, b) => a.cellId - b.cellId);

  const originalLayoutForHash = {
    shapeLayouts: shapeLayouts.map(item => ({
      shapeId: item.shapeId,
      triangles: [...item.triangles],
    })),
    cellStacks,
  };

  const mirroredLayoutForHash = {
    shapeLayouts: shapeLayouts.map(item => ({
      shapeId: item.shapeId,
      triangles: item.triangles
        .map(mirrorTriangleIdHorizontally)
        .sort((a, b) => a - b),
    })),
    cellStacks: cellStacks
      .map(item => ({
        cellId: mirrorTriangleIdHorizontally(item.cellId),
        shapeIds: [...item.shapeIds],
      }))
      .sort((a, b) => a.cellId - b.cellId),
  };

  const signatureA = JSON.stringify(originalLayoutForHash);
  const signatureB = JSON.stringify(mirroredLayoutForHash);
  const canonicalSignature = signatureA < signatureB ? signatureA : signatureB;
  const hash = hashStringFNV1a(canonicalSignature);

  return {
    hash,
    clearedAt: new Date().toISOString(),
    shapeLayouts,
    cellStacks,
  };
}

function persistLevelClearRecord(record: LevelClearRecord): { exists: boolean } {
  try {
    const raw = window.localStorage.getItem(LEVEL_CLEAR_RECORDS_KEY);
    const existing = raw ? (JSON.parse(raw) as LevelClearRecord[]) : [];

    if (existing.some(item => item.hash === record.hash)) {
      return { exists: true };
    }

    existing.push(record);
    window.localStorage.setItem(LEVEL_CLEAR_RECORDS_KEY, JSON.stringify(existing));
    return { exists: false };
  } catch {
    // Ignore storage failures in private mode or restricted environments.
    return { exists: false };
  }
}

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

const TriangleBoard: React.FC<TriangleBoardProps> = ({ onLevelCleared }) => {
  const [board, setBoard] = useState<TriangleCell[]>([]);
  const [selectedShape, setSelectedShape] = useState<number | null>(null);
  const [, setHoveredTriangleId] = useState<number | null>(null);
  const [snappedTriangles, setSnappedTriangles] = useState<number[] | null>(null);
  const [movingShapeId, setMovingShapeId] = useState<number | null>(null);
  const [draggingShape, setDraggingShape] = useState(false);
  const [hadDragPreview, setHadDragPreview] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [panelPointerShapeId, setPanelPointerShapeId] = useState<number | null>(null);
  const [draggingFromPanel, setDraggingFromPanel] = useState(false);
  const [shapeRotations, setShapeRotations] = useState<Record<number, number>>({});
  const [shapeFlips, setShapeFlips] = useState<Record<number, boolean>>({
    3: true,
    4: true,
    7: true,
    8: true,
    12: true,
  });
  const [shapeActionMenu, setShapeActionMenu] = useState<ShapeActionMenuState | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [quickActionMode, setQuickActionMode] = useState<QuickActionMode>('none');
  const [isFinePointer, setIsFinePointer] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }

    return window.matchMedia('(pointer: fine)').matches;
  });
  const boardSvgRef = useRef<SVGSVGElement | null>(null);
  const shapeActionMenuRef = useRef<HTMLDivElement | null>(null);
  const cursorRafRef = useRef<number | null>(null);
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastBoardMoveTimeRef = useRef(0);

  // 右侧可见图形由棋盘占用状态实时推导，避免“放置后又出现”的状态不一致
  const placedShapes = useMemo(() => {
    return new Set(board.flatMap(cell => cell.shapeIds));
  }, [board]);

  useEffect(() => {
    const initialBoard = createTriangleBoard(9);
    setBoard(initialBoard);
  }, []);

  useEffect(() => {
    if (!shapeActionMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && shapeActionMenuRef.current?.contains(target)) {
        return;
      }
      setShapeActionMenu(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [shapeActionMenu]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(pointer: fine)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsFinePointer(event.matches);
    };

    setIsFinePointer(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // 检查所有允许的三角形是否都被填充（81 - 9 禁用 = 72 个允许）
    const allowed = board.filter(cell => !DISABLED_CELLS.has(cell.id));
    if (allowed.length > 0 && allowed.every(cell => cell.filled)) {
      const record = buildLevelClearRecord(board, shapeRotations, shapeFlips);
      const persistResult = persistLevelClearRecord(record);
      console.info('Level clear record:', record, 'existingSolution:', persistResult.exists);
      onLevelCleared?.(record);
      setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined, shapeIds: [] })));
      setMovingShapeId(null);
      setSelectedShape(null);
    }
  }, [board, shapeRotations, shapeFlips, onLevelCleared]);

  const getMappedTriangles = (
    shapeId: number,
    anchorTriangleId: number,
    allowOverlapShapeId?: number,
    rotationStep: number = 0,
    flipped: boolean = false
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
      let relX = sourceCenter.x - baseCenter.x;
      const relY = sourceCenter.y - baseCenter.y;

      if (flipped) {
        relX = -relX;
      }

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
    if (movingShapeId || selectedShape) return;
    if (DISABLED_CELLS.has(cellId)) return;

    const clickedCell = board.find(c => c.id === cellId);
    if (!clickedCell) return;

    const clickedTriangleId = parseInt(cellId.replace('cell-', ''));

    void clickedTriangleId;
  };

  const handleCellMouseDown = (cellId: string) => {
    if (movingShapeId) return;
    if (DISABLED_CELLS.has(cellId)) return;

    const cell = board.find(c => c.id === cellId);
    if (!cell || !cell.filled || !cell.shapeId) return;

    setMovingShapeId(cell.shapeId);
    setHoveredTriangleId(parseInt(cellId.replace('cell-', '')));
    setDraggingShape(false);
    setSnappedTriangles(null);
    setDragStartPoint(null);
    setSelectedShape(null);
  };

  const handleCellPointerDown = (event: React.PointerEvent<SVGPolygonElement>, cellId: string) => {
    if (quickActionMode !== 'none') {
      event.preventDefault();
      setShapeActionMenu(null);
      return;
    }

    setShapeActionMenu(null);
    setHadDragPreview(false);
    setDragStartPoint({ x: event.clientX, y: event.clientY });
    handleCellMouseDown(cellId);
  };

  const handleCellPointerUp = (event: React.PointerEvent<SVGPolygonElement>, cellId: string) => {
    if (quickActionMode !== 'none') {
      event.preventDefault();

      const cell = board.find(c => c.id === cellId);
      if (!cell || DISABLED_CELLS.has(cellId) || cell.shapeIds.length === 0) {
        return;
      }

      const targetShapeId = cell.shapeIds[cell.shapeIds.length - 1];
      if (!targetShapeId) {
        return;
      }

      if (quickActionMode === 'rotate') {
        rotatePlacedShapeAtCell(targetShapeId, cellId);
      } else if (!MIRROR_SYMMETRIC_SHAPE_IDS.has(targetShapeId)) {
        flipPlacedShapeAtCell(targetShapeId, cellId);
      }

      return;
    }

    if (selectedShape && draggingFromPanel) {
      const cell = board.find(c => c.id === cellId);
      if (!cell) return;

      const rotationStep = shapeRotations[selectedShape] ?? 0;
      const flipped = shapeFlips[selectedShape] ?? false;
      const clickedCenter = getTriangleCenter(cell, triangleSize);
      const bestSnap = findBestSnapPlacement(
        selectedShape,
        clickedCenter.x,
        clickedCenter.y,
        rotationStep,
        undefined,
        flipped
      );
      const mappedTriangles =
        snappedTriangles ??
        bestSnap?.mappedTriangles ??
        getMappedTriangles(selectedShape, parseInt(cellId.replace('cell-', '')), undefined, rotationStep, flipped);

      if (mappedTriangles) {
        setBoard(prevBoard =>
          prevBoard.map(item => {
            const id = parseInt(item.id.replace('cell-', ''));
            if (!mappedTriangles.includes(id)) return item;

            const nextShapeIds = item.shapeIds.includes(selectedShape)
              ? item.shapeIds
              : [...item.shapeIds, selectedShape];

            return {
              ...item,
              shapeIds: nextShapeIds,
              filled: nextShapeIds.length > 0,
              shapeId: nextShapeIds[nextShapeIds.length - 1],
            };
          })
        );
      }

      setSelectedShape(null);
      setPanelPointerShapeId(null);
      setDraggingFromPanel(false);
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
      setDragStartPoint(null);
      setShapeActionMenu(null);
      return;
    }

    if (!movingShapeId) return;

    const cell = board.find(c => c.id === cellId);
    if (!cell) return;

    const movedSincePointerDown = dragStartPoint
      ? (event.clientX - dragStartPoint.x) ** 2 + (event.clientY - dragStartPoint.y) ** 2
      : 0;
    const hasPointerMoved = movedSincePointerDown > 9;

    if (!draggingShape && hasPointerMoved && hadDragPreview) {
      setMovingShapeId(null);
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
      setDraggingShape(false);
      setHadDragPreview(false);
      setDragStartPoint(null);
      return;
    }

    if (!draggingShape && !hadDragPreview && cell.shapeIds.includes(movingShapeId)) {
      setShapeActionMenu({
        shapeId: movingShapeId,
        x: event.clientX,
        y: event.clientY,
        source: 'board',
        anchorCellId: cellId,
      });
      setMovingShapeId(null);
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
      setDraggingShape(false);
      setHadDragPreview(false);
      setDragStartPoint(null);
      return;
    }

    const rotationStep = shapeRotations[movingShapeId] ?? 0;
    const flipped = shapeFlips[movingShapeId] ?? false;
    const clickedCenter = getTriangleCenter(cell, triangleSize);
    const bestSnap = findBestSnapPlacement(
      movingShapeId,
      clickedCenter.x,
      clickedCenter.y,
      rotationStep,
      movingShapeId,
      flipped
    );
    const mappedTriangles = snappedTriangles ?? bestSnap?.mappedTriangles ?? getMappedTriangles(movingShapeId, parseInt(cellId.replace('cell-', '')), movingShapeId, rotationStep, flipped);

    if (mappedTriangles) {
      const movingId = movingShapeId;
      setBoard(prevBoard =>
        prevBoard.map(item => {
          const id = parseInt(item.id.replace('cell-', ''));
          let nextShapeIds = item.shapeIds.filter(shapeId => shapeId !== movingId);

          if (mappedTriangles.includes(id)) {
            nextShapeIds = [...nextShapeIds, movingId];
          }

          const nextTopShapeId = nextShapeIds.length > 0 ? nextShapeIds[nextShapeIds.length - 1] : undefined;
          return {
            ...item,
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
    setDraggingShape(false);
    setHadDragPreview(false);
    setDragStartPoint(null);
    setShapeActionMenu(null);
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

  const applyPlacedShapeTransformAtCell = (
    shapeId: number,
    anchorCellId: string,
    nextRotation: number,
    nextFlipped: boolean
  ): boolean => {
    const anchorCell = board.find(c => c.id === anchorCellId);
    if (!anchorCell) return false;

    const anchorCenter = getTriangleCenter(anchorCell, triangleSize);
    const bestSnap = findBestSnapPlacement(
      shapeId,
      anchorCenter.x,
      anchorCenter.y,
      nextRotation,
      shapeId,
      nextFlipped
    );

    if (!bestSnap?.mappedTriangles) return false;

    setShapeRotations(prev => ({
      ...prev,
      [shapeId]: nextRotation,
    }));

    setShapeFlips(prev => ({
      ...prev,
      [shapeId]: nextFlipped,
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

    setSnappedTriangles(null);
    setDraggingShape(false);
    setDragStartPoint(null);
    setMovingShapeId(null);
    return true;
  };

  const rotatePlacedShapeAtCell = (shapeId: number, anchorCellId: string) => {
    const nextRotation = ((shapeRotations[shapeId] ?? 0) + 1) % 6;
    const flipped = shapeFlips[shapeId] ?? false;
    applyPlacedShapeTransformAtCell(shapeId, anchorCellId, nextRotation, flipped);
  };

  const flipPlacedShapeAtCell = (shapeId: number, anchorCellId: string) => {
    const rotation = shapeRotations[shapeId] ?? 0;
    const nextFlipped = !(shapeFlips[shapeId] ?? false);
    applyPlacedShapeTransformAtCell(shapeId, anchorCellId, rotation, nextFlipped);
  };

  const handleShapeCardPointerDown = (event: React.PointerEvent<HTMLButtonElement>, shapeId: number) => {
    if (quickActionMode !== 'none') {
      event.preventDefault();
      return;
    }

    if (movingShapeId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId) === false) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    setShapeActionMenu(null);
    setPanelPointerShapeId(shapeId);
    setSelectedShape(null);
    setDraggingFromPanel(false);
    setDragStartPoint({ x: event.clientX, y: event.clientY });
    setSnappedTriangles(null);

    if (!isFinePointer) {
      // 移动端按下即进入拖拽态，避免滚动/取消导致无法跨区域拖放。
      setDraggingFromPanel(true);
      setSelectedShape(shapeId);
    }
  };

  const handleShapeCardPointerUp = (event: React.PointerEvent<HTMLButtonElement>, shapeId: number) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (quickActionMode !== 'none') {
      event.preventDefault();

      if (quickActionMode === 'rotate') {
        rotateShape(shapeId);
      } else if (!MIRROR_SYMMETRIC_SHAPE_IDS.has(shapeId)) {
        flipShape(shapeId);
      }

      setShapeActionMenu(null);
      setSelectedShape(null);
      setPanelPointerShapeId(null);
      setDraggingFromPanel(false);
      setSnappedTriangles(null);
      setDragStartPoint(null);
      return;
    }

    if (draggingFromPanel) {
      event.preventDefault();
      finalizePanelDragByClientPoint(event.clientX, event.clientY);
      return;
    }

    if (panelPointerShapeId !== shapeId) return;

    if (isFinePointer) {
      setShapeActionMenu({
        shapeId,
        x: event.clientX,
        y: event.clientY,
        source: 'panel',
      });
      setSelectedShape(null);
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
    } else {
      setSelectedShape(null);
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
    }

    setPanelPointerShapeId(null);
    setDraggingFromPanel(false);
    setDragStartPoint(null);
  };

  const handleShapeCardPointerCancel = (event: React.PointerEvent<HTMLButtonElement>, shapeId: number) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (panelPointerShapeId !== shapeId && selectedShape !== shapeId) {
      return;
    }

    clearPanelDragState();
  };

  const handleShapeMenuRotate = () => {
    if (!shapeActionMenu) return;

    const { shapeId, source, anchorCellId } = shapeActionMenu;
    if (source === 'board' && anchorCellId) {
      rotatePlacedShapeAtCell(shapeId, anchorCellId);
    } else {
      rotateShape(shapeId);
    }

    setShapeActionMenu(null);
  };

  const handleShapeMenuFlip = () => {
    if (!shapeActionMenu) return;

    const { shapeId, source, anchorCellId } = shapeActionMenu;
    if (MIRROR_SYMMETRIC_SHAPE_IDS.has(shapeId)) {
      setShapeActionMenu(null);
      return;
    }

    if (source === 'board' && anchorCellId) {
      flipPlacedShapeAtCell(shapeId, anchorCellId);
    } else {
      flipShape(shapeId);
    }

    setShapeActionMenu(null);
  };

  const clearPanelDragState = () => {
    setSelectedShape(null);
    setPanelPointerShapeId(null);
    setDraggingFromPanel(false);
    setHoveredTriangleId(null);
    setSnappedTriangles(null);
    setDragStartPoint(null);
  };

  const finalizePanelDragByClientPoint = (clientX: number, clientY: number) => {
    placeSelectedShapeByClientPoint(clientX, clientY);
    clearPanelDragState();
  };

  const placeSelectedShapeByClientPoint = (clientX: number, clientY: number): boolean => {
    if (!selectedShape || !draggingFromPanel || !boardSvgRef.current) return false;

    const rect = boardSvgRef.current.getBoundingClientRect();
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (!inside) return false;

    const mouseX = ((clientX - rect.left) / rect.width) * svgWidth;
    const mouseY = ((clientY - rect.top) / rect.height) * svgHeight;
    const rotationStep = shapeRotations[selectedShape] ?? 0;
    const flipped = shapeFlips[selectedShape] ?? false;
    const bestSnap = findBestSnapPlacement(selectedShape, mouseX, mouseY, rotationStep, undefined, flipped);
    const mappedTriangles = snappedTriangles ?? bestSnap?.mappedTriangles;
    if (!mappedTriangles) return false;

    setBoard(prevBoard =>
      prevBoard.map(item => {
        const id = parseInt(item.id.replace('cell-', ''));
        if (!mappedTriangles.includes(id)) return item;

        const nextShapeIds = item.shapeIds.includes(selectedShape)
          ? item.shapeIds
          : [...item.shapeIds, selectedShape];

        return {
          ...item,
          shapeIds: nextShapeIds,
          filled: nextShapeIds.length > 0,
          shapeId: nextShapeIds[nextShapeIds.length - 1],
        };
      })
    );

    return true;
  };

  const rotateShape = (shapeId: number) => {
    setShapeRotations(prev => ({
      ...prev,
      [shapeId]: ((prev[shapeId] ?? 0) + 1) % 6,
    }));
    setSnappedTriangles(null);
  };

  const flipShape = (shapeId: number) => {
    setShapeFlips(prev => ({
      ...prev,
      [shapeId]: !prev[shapeId],
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
    setDraggingShape(false);
    setHadDragPreview(false);
    setDragStartPoint(null);
  };

  const toggleQuickActionMode = (mode: Exclude<QuickActionMode, 'none'>) => {
    setQuickActionMode(prev => (prev === mode ? 'none' : mode));
    setShapeActionMenu(null);
    setSelectedShape(null);
    setPanelPointerShapeId(null);
    setDraggingFromPanel(false);
    setMovingShapeId(null);
    setDraggingShape(false);
    setSnappedTriangles(null);
    setDragStartPoint(null);
    setHadDragPreview(false);
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
    allowUpscale: boolean = true,
    flipped: boolean = false
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
        const flippedX = flipped ? 2 * rotateCenterX - point.x : point.x;
        if (angle === 0) return { x: flippedX, y: point.y };
        const relX = flippedX - rotateCenterX;
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
  const panelPreviewTriangleSize = triangleSize;
  const h = (triangleSize * Math.sqrt(3)) / 2;
  const svgHeight = 9 * h + 40;
  const svgWidth = 18 * triangleSize / 2 + 40;
  const activePreviewShapeId = movingShapeId ?? selectedShape;
  const panelPreviewCanvasSize = 240;
  const carryPreviewCanvasSize = 220;

  useEffect(() => {
    if (!activePreviewShapeId) {
      setCursorPosition(null);
      return;
    }

    const handleGlobalMouseMove = (event: PointerEvent) => {
      pendingCursorRef.current = { x: event.clientX, y: event.clientY };
      if (cursorRafRef.current !== null) return;

      cursorRafRef.current = window.requestAnimationFrame(() => {
        const next = pendingCursorRef.current;
        if (next) {
          setCursorPosition(prev => {
            if (prev && prev.x === next.x && prev.y === next.y) {
              return prev;
            }
            return next;
          });
        }
        cursorRafRef.current = null;
      });
    };

    window.addEventListener('pointermove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('pointermove', handleGlobalMouseMove);
      if (cursorRafRef.current !== null) {
        window.cancelAnimationFrame(cursorRafRef.current);
        cursorRafRef.current = null;
      }
      pendingCursorRef.current = null;
    };
  }, [activePreviewShapeId]);

  useEffect(() => {
    if (!panelPointerShapeId || !dragStartPoint || draggingFromPanel) return;

    const handleGlobalMove = (event: PointerEvent) => {
      const dx = event.clientX - dragStartPoint.x;
      const dy = event.clientY - dragStartPoint.y;
      if (dx * dx + dy * dy > 36) {
        setDraggingFromPanel(true);
        setSelectedShape(panelPointerShapeId);
      }
    };

    window.addEventListener('pointermove', handleGlobalMove);
    return () => window.removeEventListener('pointermove', handleGlobalMove);
  }, [panelPointerShapeId, dragStartPoint, draggingFromPanel]);

  useEffect(() => {
    if (!selectedShape || !draggingFromPanel) return;

    const handleGlobalUp = (event: PointerEvent) => {
      finalizePanelDragByClientPoint(event.clientX, event.clientY);
    };

    const handleGlobalCancel = (event: PointerEvent) => {
      finalizePanelDragByClientPoint(event.clientX, event.clientY);
    };

    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalCancel);
    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalCancel);
    };
  }, [selectedShape, draggingFromPanel, snappedTriangles, shapeRotations, board]);

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
    allowOverlapShapeId?: number,
    flipped: boolean = false
  ): { anchorId: number; mappedTriangles: number[]; score: number } | null => {
    if (cellCenters.length === 0) return null;

    let best: { anchorId: number; mappedTriangles: number[]; score: number } | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const anchor of cellCenters) {
      const mappedTriangles = getMappedTriangles(shapeId, anchor.id, allowOverlapShapeId, rotationStep, flipped);
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

    // 限制重计算频率到每帧，避免拖动时高频重算导致掉帧。
    const now = performance.now();
    if (now - lastBoardMoveTimeRef.current < 16) {
      return;
    }
    lastBoardMoveTimeRef.current = now;

    if (movingShapeId && dragStartPoint && !draggingShape) {
      const dx = event.clientX - dragStartPoint.x;
      const dy = event.clientY - dragStartPoint.y;
      if (dx * dx + dy * dy > 36) {
        setDraggingShape(true);
      }
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const mouseY = ((event.clientY - rect.top) / rect.height) * svgHeight;

    const rotationStep = shapeRotations[activePreviewShapeId] ?? 0;
    const flipped = shapeFlips[activePreviewShapeId] ?? false;
    const bestSnap = findBestSnapPlacement(
      activePreviewShapeId,
      mouseX,
      mouseY,
      rotationStep,
      movingShapeId ?? undefined,
      flipped
    );

    if (!bestSnap) {
      setHoveredTriangleId(null);
      setSnappedTriangles(null);
      return;
    }

    if (movingShapeId) {
      setHadDragPreview(true);
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
  const visiblePlacedShapeCellsByShape = Array.from({ length: 12 }).map((_, index) => {
    const shapeId = index + 1;
    const cells = board.filter(cell => {
      if (DISABLED_CELLS.has(cell.id) || cell.shapeIds.length === 0) return false;
      const topShapeId = cell.shapeIds[cell.shapeIds.length - 1];
      return topShapeId === shapeId;
    });

    return {
      shapeId,
      cells,
    };
  }).filter(item => item.cells.length > 0);

  return (
    <div className="game-container triangle-game-container">
      <div className="game-content">
        {/* 左侧：游戏棋盘 */}
        <div className="board-section">
          <div className="board-wrapper">
            <svg
              ref={boardSvgRef}
              width={displayWidth}
              height={displayHeight}
              className="triangle-board"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              onPointerMove={handleBoardMouseMove}
              onMouseLeave={handleBoardMouseLeave}
            >
              <defs>
                {Array.from({ length: 12 }).map((_, index) => {
                  const shapeId = index + 1;
                  const outlineColor = getShapeOutlineColor(SHAPE_COLORS[index]);

                  return (
                    <filter
                      key={`board-shape-outline-filter-${shapeId}`}
                      id={`board-shape-outline-${shapeId}`}
                      x="-12%"
                      y="-12%"
                      width="124%"
                      height="124%"
                      colorInterpolationFilters="sRGB"
                    >
                      <feMorphology in="SourceAlpha" operator="erode" radius="1.25" result="eroded" />
                      <feComposite in="SourceAlpha" in2="eroded" operator="out" result="ring" />
                      <feFlood floodColor={outlineColor} floodOpacity="0.9" result="ringColor" />
                      <feComposite in="ringColor" in2="ring" operator="in" result="coloredRing" />
                    </filter>
                  );
                })}
              </defs>

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
                      onPointerDown={event => handleCellPointerDown(event, cell.id)}
                      onPointerUp={event => handleCellPointerUp(event, cell.id)}
                      onClick={() => handleCellClick(cell.id)}
                      style={{
                        cursor: isDisabled
                          ? 'default'
                          : quickActionMode !== 'none'
                          ? 'pointer'
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

              {visiblePlacedShapeCellsByShape.map(item => (
                <g key={`board-outline-${item.shapeId}`} filter={`url(#board-shape-outline-${item.shapeId})`} pointerEvents="none">
                  {item.cells.map(cell => (
                    <polygon
                      key={`board-outline-cell-${item.shapeId}-${cell.id}`}
                      points={expandTrianglePoints(getTriangleCoords(cell, triangleSize), 0.55)}
                      fill="#000"
                      stroke="none"
                      strokeWidth="0"
                      opacity="1"
                    />
                  ))}
                </g>
              ))}

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
        <div
          className={`shape-section ${panelPointerShapeId ? 'drag-origin-active' : ''}`}
          onPointerUp={handleShapeSectionPointerUp}
        >
          <div className="quick-action-toolbar" role="group" aria-label="快速操作模式">
            <button
              type="button"
              className={`quick-action-btn ${quickActionMode === 'rotate' ? 'active' : ''}`}
              onClick={() => toggleQuickActionMode('rotate')}
            >
              快速旋转
            </button>
            <button
              type="button"
              className={`quick-action-btn ${quickActionMode === 'flip' ? 'active' : ''}`}
              onClick={() => toggleQuickActionMode('flip')}
            >
              快速翻转
            </button>
          </div>

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
                  onPointerDown={event => handleShapeCardPointerDown(event, idx + 1)}
                  onPointerUp={event => handleShapeCardPointerUp(event, idx + 1)}
                  onPointerCancel={event => handleShapeCardPointerCancel(event, idx + 1)}
                  onContextMenu={event => {
                    event.preventDefault();
                  }}
                  title="点击打开菜单：旋转 / 翻转"
                >
                  {(() => {
                    const outlineColor = getShapeOutlineColor(SHAPE_COLORS[idx]);
                    return (
                  <svg
                    width={panelPreviewCanvasSize}
                    height={panelPreviewCanvasSize}
                    viewBox={`0 0 ${panelPreviewCanvasSize} ${panelPreviewCanvasSize}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {shape ? (
                      <>
                        <defs>
                          <filter
                            id={`shape-outline-${shape.id}`}
                            x="-12%"
                            y="-12%"
                            width="124%"
                            height="124%"
                            colorInterpolationFilters="sRGB"
                          >
                            <feMorphology in="SourceAlpha" operator="erode" radius="1.25" result="eroded" />
                            <feComposite in="SourceAlpha" in2="eroded" operator="out" result="ring" />
                            <feFlood floodColor={outlineColor} floodOpacity="0.9" result="ringColor" />
                            <feComposite in="ringColor" in2="ring" operator="in" result="coloredRing" />
                            <feMerge>
                              <feMergeNode in="SourceGraphic" />
                              <feMergeNode in="coloredRing" />
                            </feMerge>
                          </filter>
                        </defs>
                        {getFittedPreviewPolygons(
                          shape.triangles,
                          panelPreviewTriangleSize,
                          panelPreviewCanvasSize,
                          10,
                          shapeRotations[shape.id] ?? 0,
                          false,
                          shapeFlips[shape.id] ?? false
                        ).length > 0 && (
                          <g filter={`url(#shape-outline-${shape.id})`}>
                            {getFittedPreviewPolygons(
                              shape.triangles,
                              panelPreviewTriangleSize,
                              panelPreviewCanvasSize,
                              10,
                              shapeRotations[shape.id] ?? 0,
                              false,
                              shapeFlips[shape.id] ?? false
                            ).map((points, polygonIndex) => {
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
                            })}
                          </g>
                        )}
                      </>
                    ) : null}
                  </svg>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {shapeActionMenu && (
        <div
          ref={shapeActionMenuRef}
          className="shape-action-menu"
          style={{
            left: shapeActionMenu.x,
            top: shapeActionMenu.y,
          }}
          onPointerDown={event => event.stopPropagation()}
        >
          <button type="button" className="shape-action-menu-btn" onClick={handleShapeMenuRotate}>
            旋转
          </button>
          {!MIRROR_SYMMETRIC_SHAPE_IDS.has(shapeActionMenu.shapeId) && (
            <button type="button" className="shape-action-menu-btn" onClick={handleShapeMenuFlip}>
              翻转
            </button>
          )}
        </div>
      )}

      {activePreviewShapeId && cursorPosition && isFinePointer && (
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
              const flipped = shapeFlips[shape.id] ?? false;
              return getFittedPreviewPolygons(
                shape.triangles,
                triangleSize,
                carryPreviewCanvasSize,
                8,
                rotationStep,
                false,
                flipped
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
