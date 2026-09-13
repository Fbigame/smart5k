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
  const [hoveredTriangleId, setHoveredTriangleId] = useState<number | null>(null);
  const [movingShapeId, setMovingShapeId] = useState<number | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [level, setLevel] = useState(1);
  const [filledCount, setFilledCount] = useState(0);

  // 右侧可见图形由棋盘占用状态实时推导，避免“放置后又出现”的状态不一致
  const placedShapes = useMemo(() => {
    return new Set(
      board
        .filter(cell => cell.filled && cell.shapeId !== undefined)
        .map(cell => cell.shapeId as number)
    );
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
      setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined })));
      setMovingShapeId(null);
      setSelectedShape(null);
    }
  }, [board, level]);

  const getMappedTriangles = (
    shapeId: number,
    anchorTriangleId: number,
    allowOverlapShapeId?: number
  ): number[] | null => {
    const shape = SHAPES.find(s => s.id === shapeId);
    if (!shape || shape.triangles.length === 0) return null;

    const baseCellRef = board.find(c => c.id === `cell-${shape.triangles[0]}`);
    const anchorCell = board.find(c => c.id === `cell-${anchorTriangleId}`);
    if (!baseCellRef || !anchorCell) return null;

    const relativePositions = shape.triangles
      .map(triangleId => board.find(c => c.id === `cell-${triangleId}`))
      .filter((cell): cell is TriangleCell => Boolean(cell))
      .map(cell => ({
        row: cell.row - baseCellRef.row,
        col: cell.col - baseCellRef.col,
        direction: cell.direction,
      }));

    if (relativePositions.length !== shape.triangles.length) {
      return null;
    }

    const mappedTriangles: number[] = [];
    for (const relPos of relativePositions) {
      const targetRow = anchorCell.row + relPos.row;
      const targetCol = anchorCell.col + relPos.col;

      const targetCell = board.find(
        c => c.row === targetRow && c.col === targetCol && c.direction === relPos.direction
      );

      if (!targetCell || DISABLED_CELLS.has(targetCell.id)) {
        return null;
      }

      if (
        targetCell.filled &&
        (!allowOverlapShapeId || targetCell.shapeId !== allowOverlapShapeId)
      ) {
        return null;
      }

      mappedTriangles.push(parseInt(targetCell.id.replace('cell-', '')));
    }

    return mappedTriangles;
  };

  const handleCellClick = (cellId: string) => {
    if (movingShapeId) return;
    if (DISABLED_CELLS.has(cellId)) return;

    const clickedCell = board.find(c => c.id === cellId);
    if (!clickedCell) return;

    const clickedTriangleId = parseInt(cellId.replace('cell-', ''));

    if (clickedCell.filled) {
      return;
    }

    // 只有当从右侧选中了一个已定义的形状时，才能放置
    if (!selectedShape || !SHAPES.find(s => s.id === selectedShape)) return;

    const mappedTriangles = getMappedTriangles(selectedShape, clickedTriangleId);
    if (mappedTriangles) {
      setBoard(prevBoard =>
        prevBoard.map(cell => {
          const id = parseInt(cell.id.replace('cell-', ''));
          return mappedTriangles.includes(id)
            ? { ...cell, filled: true, shapeId: selectedShape }
            : cell;
        })
      );
      // 放置成功后，清除选择
      setSelectedShape(null);
      setHoveredTriangleId(null);
    }
  };

  const handleCellMouseDown = (cellId: string) => {
    if (DISABLED_CELLS.has(cellId)) return;

    const cell = board.find(c => c.id === cellId);
    if (!cell || !cell.filled || !cell.shapeId) return;

    setMovingShapeId(cell.shapeId);
    setHoveredTriangleId(parseInt(cellId.replace('cell-', '')));
    setSelectedShape(null);
  };

  const handleCellMouseUp = (cellId: string) => {
    if (!movingShapeId || DISABLED_CELLS.has(cellId)) return;

    const targetTriangleId = parseInt(cellId.replace('cell-', ''));
    const mappedTriangles = getMappedTriangles(movingShapeId, targetTriangleId, movingShapeId);

    if (mappedTriangles) {
      const movingId = movingShapeId;
      setBoard(prevBoard =>
        prevBoard.map(cell => {
          const id = parseInt(cell.id.replace('cell-', ''));
          if (cell.shapeId === movingId && !mappedTriangles.includes(id)) {
            return { ...cell, filled: false, shapeId: undefined };
          }

          if (mappedTriangles.includes(id)) {
            return { ...cell, filled: true, shapeId: movingId };
          }

          return cell;
        })
      );
    }

    setMovingShapeId(null);
    setHoveredTriangleId(null);
  };

  useEffect(() => {
    const cancelMove = () => {
      setMovingShapeId(null);
      setHoveredTriangleId(null);
    };

    window.addEventListener('mouseup', cancelMove);
    return () => window.removeEventListener('mouseup', cancelMove);
  }, []);

  const handleShapeSelect = (shapeId: number) => {
    setSelectedShape(selectedShape === shapeId ? null : shapeId);
  };

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

  const triangleSize = 65; // 三角形的边长
  const h = (triangleSize * Math.sqrt(3)) / 2;
  const svgHeight = 9 * h + 40;
  const svgWidth = 18 * triangleSize / 2 + 40;
  const activePreviewShapeId = movingShapeId ?? selectedShape;

  useEffect(() => {
    if (!activePreviewShapeId) {
      setCursorPosition(null);
      return;
    }

    const handleGlobalMouseMove = (event: MouseEvent) => {
      setCursorPosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove);
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

  const handleBoardMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!activePreviewShapeId || cellCenters.length === 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * svgWidth;
    const mouseY = ((event.clientY - rect.top) / rect.height) * svgHeight;

    let nearestId = cellCenters[0].id;
    let minDist = Number.POSITIVE_INFINITY;

    for (const cell of cellCenters) {
      const dx = cell.x - mouseX;
      const dy = cell.y - mouseY;
      const dist = dx * dx + dy * dy;

      if (dist < minDist) {
        minDist = dist;
        nearestId = cell.id;
      }
    }

    setHoveredTriangleId(nearestId);
  };

  const handleBoardMouseLeave = () => {
    setHoveredTriangleId(null);
  };

  // 限制最大尺寸，占用左侧2/3空间
  const displayWidth = Math.min(svgWidth, 800);
  const displayHeight = Math.min(svgHeight, 900);

  return (
    <div className="game-container">
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
              onMouseMove={handleBoardMouseMove}
              onMouseLeave={handleBoardMouseLeave}
            >
              {board.map(cell => {
                const isDisabled = DISABLED_CELLS.has(cell.id);
                let fill: string;
                let stroke: string;

                if (isDisabled) {
                  // 禁用的三角形完全透明
                  fill = 'transparent';
                  stroke = 'transparent';
                } else if (cell.filled) {
                  fill = SHAPE_COLORS[cell.shapeId ? cell.shapeId - 1 : 0];
                  stroke = '#ddd';
                } else {
                  fill = '#fff';
                  stroke = '#999';
                }

                // 计算三角形中心用于显示编号
                const coords = getTriangleCoords(cell, triangleSize).split(' ');
                const points = coords.map(c => c.split(',').map(Number));
                const centerX = (points[0][0] + points[1][0] + points[2][0]) / 3;
                const centerY = (points[0][1] + points[1][1] + points[2][1]) / 3;
                const cellNum = parseInt(cell.id.replace('cell-', ''));

                return (
                  <g key={cell.id}>
                    <polygon
                      points={getTriangleCoords(cell, triangleSize)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={cell.filled || isDisabled ? '0.5' : '1'}
                      className="triangle-cell"
                      onMouseDown={() => handleCellMouseDown(cell.id)}
                      onMouseUp={() => handleCellMouseUp(cell.id)}
                      onClick={() => handleCellClick(cell.id)}
                      style={{
                        cursor: isDisabled
                          ? 'default'
                          : movingShapeId
                          ? 'grabbing'
                          : cell.filled
                          ? 'grab'
                          : selectedShape
                          ? 'pointer'
                          : 'default',
                        pointerEvents: isDisabled ? 'none' : 'auto',
                      }}
                    />
                    <text
                      x={centerX}
                      y={centerY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill={isDisabled ? '#888' : '#333'}
                      pointerEvents="none"
                      style={{ userSelect: 'none' }}
                    >
                      {cellNum}
                    </text>
                  </g>
                );
              })}

              {/* 虚拟形状显示 - 跟随鼠标 */}
              {activePreviewShapeId && hoveredTriangleId !== null && SHAPES.find(s => s.id === activePreviewShapeId) && (
                (() => {
                  const shapeId = activePreviewShapeId;
                  const mappedTriangles = getMappedTriangles(shapeId, hoveredTriangleId, movingShapeId ?? undefined);
                  if (!mappedTriangles) return null;

                  return mappedTriangles.map(triangleId => {
                    const cell = board.find(c => c.id === `cell-${triangleId}`);
                    if (!cell) return null;
                    
                    return (
                      <polygon
                        key={`follow-${triangleId}`}
                        points={getTriangleCoords(cell, triangleSize)}
                        fill={SHAPE_COLORS[shapeId - 1]}
                        stroke={SHAPE_COLORS[shapeId - 1]}
                        strokeWidth="2"
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
        <div className="shape-section">
          <div className="shapes-grid">
            <h2 style={{ gridColumn: '1 / -1', marginBottom: '10px' }}>Shapes</h2>
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
                <svg
                  key={idx + 1}
                  width="160"
                  height="180"
                  viewBox="0 0 200 250"
                  preserveAspectRatio="xMidYMid meet"
                  onClick={() => handleShapeSelect(idx + 1)}
                  style={{
                    cursor: 'pointer',
                    filter: isSelected ? `drop-shadow(0 0 8px ${SHAPE_COLORS[idx]})` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {shape ? (
                    <>
                      {(() => {
                        const shapeTriangleIds = shape.triangles;
                        const baseCell = board.find(c => c.id === `cell-${shapeTriangleIds[0]}`);
                        if (!baseCell) return null;
                        
                        return board
                          .filter(cell => shapeTriangleIds.includes(parseInt(cell.id.replace('cell-', ''))))
                          .map(cell => {
                            const color = SHAPE_COLORS[idx];
                            return (
                              <polygon
                                key={cell.id}
                                points={getPreviewTriangleCoords(cell, baseCell, 75, 100, 95)}
                                fill={color}
                                stroke={isSelected ? SHAPE_COLORS[idx] : '#666'}
                                strokeWidth={isSelected ? "2" : "1"}
                                opacity="0.95"
                              />
                            );
                          });
                      })()}
                    </>
                  ) : null}
                </svg>
              );
            })}
          </div>
          <button className="btn btn-primary shape-clear-btn" onClick={() => {
            setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined })));
            setSelectedShape(null);
            setMovingShapeId(null);
            setHoveredTriangleId(null);
          }}>
            Clear Board
          </button>
        </div>
      </div>

      <div className="game-footer">
      </div>

      {activePreviewShapeId && cursorPosition && (
        <div
          className="floating-shape-preview"
          style={{
            left: cursorPosition.x + 16,
            top: cursorPosition.y + 16,
          }}
        >
          <svg width="120" height="120" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
            {(() => {
              const shape = SHAPES.find(s => s.id === activePreviewShapeId);
              if (!shape) return null;

              const shapeCells = shape.triangles
                .map(triangleId => board.find(c => c.id === `cell-${triangleId}`))
                .filter((cell): cell is TriangleCell => Boolean(cell));

              if (shapeCells.length !== shape.triangles.length) {
                return null;
              }

              const baseCell = shapeCells[0];
              return shapeCells.map(cell => (
                <polygon
                  key={`cursor-preview-${cell.id}`}
                  points={getPreviewTriangleCoords(cell, baseCell, 30, 60, 38)}
                  fill={SHAPE_COLORS[activePreviewShapeId - 1]}
                  stroke={SHAPE_COLORS[activePreviewShapeId - 1]}
                  strokeWidth="1.5"
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
