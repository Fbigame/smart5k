import React, { useState, useEffect } from 'react';
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
  const [placedShapes, setPlacedShapes] = useState<Set<number>>(new Set());
  const [movingShapeId, setMovingShapeId] = useState<number | null>(null);
  const [level, setLevel] = useState(1);
  const [filledCount, setFilledCount] = useState(0);

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
      setPlacedShapes(new Set());
      setMovingShapeId(null);
      setSelectedShape(null);
    }

    // 追踪已完整放置的形状
    const newPlacedShapes = new Set<number>();
    for (let shapeId = 1; shapeId <= 12; shapeId++) {
      const shape = SHAPES.find(s => s.id === shapeId);
      if (!shape) continue;
      
      // 检查该形状的所有三角形是否都被填充
      const allTrianglesFilled = shape.triangles.every(triangleId => {
        const cell = board.find(c => c.id === `cell-${triangleId}`);
        return cell && cell.filled && cell.shapeId === shapeId;
      });
      
      if (allTrianglesFilled) {
        newPlacedShapes.add(shapeId);
      }
    }
    setPlacedShapes(newPlacedShapes);
  }, [board, level]);

  const handleCellClick = (cellId: string) => {
    if (DISABLED_CELLS.has(cellId)) return;
    
    const clickedCell = board.find(c => c.id === cellId);
    if (!clickedCell) return;
    
    const clickedTriangleId = parseInt(cellId.replace('cell-', ''));
    
    // 如果点击的是已放置的形状，进入移动模式
    if (clickedCell.filled && clickedCell.shapeId) {
      setMovingShapeId(clickedCell.shapeId);
      setSelectedShape(clickedCell.shapeId);
      setHoveredTriangleId(clickedTriangleId);
      return;
    }
    
    // 如果正在移动一个形状，处理移动
    if (movingShapeId && hoveredTriangleId !== null) {
      const shapeTriangles = SHAPES[movingShapeId - 1]?.triangles || [];
      const baseCellRef = board.find(c => c.id === `cell-${shapeTriangles[0]}`);
      const hoveredCell = board.find(c => c.id === `cell-${hoveredTriangleId}`);
      
      if (!baseCellRef || !hoveredCell) return;
      
      // 计算相对位置
      const relativePositions: Array<{row: number; col: number; direction: 'UP' | 'DOWN'}> = [];
      for (const triangleId of shapeTriangles) {
        const cell = board.find(c => c.id === `cell-${triangleId}`);
        if (cell) {
          relativePositions.push({
            row: cell.row - baseCellRef.row,
            col: cell.col - baseCellRef.col,
            direction: cell.direction
          });
        }
      }
      
      // 应用相对位置到鼠标悬停位置
      const mappedTriangles: number[] = [];
      let allValid = true;
      
      for (const relPos of relativePositions) {
        const targetRow = hoveredCell.row + relPos.row;
        const targetCol = hoveredCell.col + relPos.col;
        
        const targetCell = board.find(c => 
          c.row === targetRow && 
          c.col === targetCol && 
          c.direction === relPos.direction
        );
        
        if (!targetCell || DISABLED_CELLS.has(targetCell.id)) {
          allValid = false;
          break;
        }
        
        // 允许覆盖同一个形状的旧位置，但不允许覆盖其他形状
        if (targetCell.filled && targetCell.shapeId !== movingShapeId) {
          allValid = false;
          break;
        }
        
        mappedTriangles.push(parseInt(targetCell.id.replace('cell-', '')));
      }
      
      if (allValid) {
        setBoard(prevBoard =>
          prevBoard.map(cell => {
            const id = parseInt(cell.id.replace('cell-', ''));
            // 清除该形状的旧位置
            if (cell.shapeId === movingShapeId && !mappedTriangles.includes(id)) {
              return { ...cell, filled: false, shapeId: undefined };
            }
            // 填充新位置
            if (mappedTriangles.includes(id)) {
              return { ...cell, filled: true, shapeId: movingShapeId };
            }
            return cell;
          })
        );
        setMovingShapeId(null);
        setSelectedShape(null);
      }
      return;
    }
    
    // 正常放置新形状
    if (!selectedShape || !hoveredTriangleId) return;
    
    // 获取基准三角形
    const shapeTriangles = SHAPES[selectedShape - 1]?.triangles || [];
    const baseCellRef = board.find(c => c.id === `cell-${shapeTriangles[0]}`);
    const hoveredCell = board.find(c => c.id === `cell-${hoveredTriangleId}`);
    
    if (!baseCellRef || !hoveredCell) return;
    
    // 计算相对位置
    const relativePositions: Array<{row: number; col: number; direction: 'UP' | 'DOWN'}> = [];
    for (const triangleId of shapeTriangles) {
      const cell = board.find(c => c.id === `cell-${triangleId}`);
      if (cell) {
        relativePositions.push({
          row: cell.row - baseCellRef.row,
          col: cell.col - baseCellRef.col,
          direction: cell.direction
        });
      }
    }
    
    // 应用相对位置到鼠标悬停位置
    const mappedTriangles: number[] = [];
    let allValid = true;
    
    for (const relPos of relativePositions) {
      const targetRow = hoveredCell.row + relPos.row;
      const targetCol = hoveredCell.col + relPos.col;
      
      const targetCell = board.find(c => 
        c.row === targetRow && 
        c.col === targetCol && 
        c.direction === relPos.direction
      );
      
if (!targetCell || DISABLED_CELLS.has(targetCell.id)) {
                      allValid = false;
                      break;
                    }
                    
                    // 允许覆盖同一个形状的旧位置，但不允许覆盖其他形状
                    if (targetCell.filled && targetCell.shapeId !== selectedShape) {
        allValid = false;
        break;
      }
      
      mappedTriangles.push(parseInt(targetCell.id.replace('cell-', '')));
    }
    
    if (allValid) {
      setBoard(prevBoard =>
        prevBoard.map(cell => {
          const id = parseInt(cell.id.replace('cell-', ''));
          return mappedTriangles.includes(id)
            ? { ...cell, filled: true, shapeId: selectedShape }
            : cell;
        })
      );
    }
  };

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

  const triangleSize = 65; // 三角形的边长
  const h = (triangleSize * Math.sqrt(3)) / 2;
  const svgHeight = 9 * h + 40;
  const svgWidth = 18 * triangleSize / 2 + 40;

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
            <svg width={displayWidth} height={displayHeight} className="triangle-board" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
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
                  <g 
                    key={cell.id}
                    onMouseEnter={() => {
                      if (selectedShape) {
                        setHoveredTriangleId(parseInt(cell.id.replace('cell-', '')));
                      }
                    }}
                    onMouseLeave={() => setHoveredTriangleId(null)}
                  >
                    <polygon
                      points={getTriangleCoords(cell, triangleSize)}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={cell.filled || isDisabled ? '0.5' : '1'}
                      className="triangle-cell"
                      onClick={() => handleCellClick(cell.id)}
                      style={{ cursor: !isDisabled && selectedShape && !cell.filled ? 'pointer' : 'default', pointerEvents: isDisabled ? 'none' : 'auto' }}
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
              {selectedShape && hoveredTriangleId !== null && SHAPES[selectedShape - 1] && (
                (() => {
                  const baseCell = board.find(c => c.id === `cell-${hoveredTriangleId}`);
                  if (!baseCell) return null;
                  
                  const shapeTriangles = SHAPES[selectedShape - 1].triangles;
                  const baseCellRef = board.find(c => c.id === `cell-${shapeTriangles[0]}`);
                  if (!baseCellRef) return null;
                  
                  // 计算相对位置
                  const relativePositions: Array<{row: number; col: number; direction: 'UP' | 'DOWN'}> = [];
                  for (const triangleId of shapeTriangles) {
                    const cell = board.find(c => c.id === `cell-${triangleId}`);
                    if (cell) {
                      relativePositions.push({
                        row: cell.row - baseCellRef.row,
                        col: cell.col - baseCellRef.col,
                        direction: cell.direction
                      });
                    }
                  }
                  
                  // 应用相对位置到当前鼠标悬停位置
                  const mappedTriangles: number[] = [];
                  let allValid = true;
                  
                  for (const relPos of relativePositions) {
                    const targetRow = baseCell.row + relPos.row;
                    const targetCol = baseCell.col + relPos.col;
                    
                    const targetCell = board.find(c => 
                      c.row === targetRow && 
                      c.col === targetCol && 
                      c.direction === relPos.direction
                    );
                    
                    if (!targetCell || DISABLED_CELLS.has(targetCell.id)) {
                      allValid = false;
                      break;
                    }
                    
                    // 允许覆盖同一个形状的旧位置，但不允许覆盖其他形状
                    if (targetCell.filled && targetCell.shapeId !== selectedShape) {
                      allValid = false;
                      break;
                    }
                    
                    mappedTriangles.push(parseInt(targetCell.id.replace('cell-', '')));
                  }
                  
                  if (!allValid) return null;
                  
                  return mappedTriangles.map(triangleId => {
                    const cell = board.find(c => c.id === `cell-${triangleId}`);
                    if (!cell) return null;
                    
                    return (
                      <polygon
                        key={`follow-${triangleId}`}
                        points={getTriangleCoords(cell, triangleSize)}
                        fill={SHAPE_COLORS[selectedShape - 1]}
                        stroke={SHAPE_COLORS[selectedShape - 1]}
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
              
              // 隐藏已放置的形状
              if (isPlaced) {
                return null;
              }
              
              return (
                <svg
                  key={idx + 1}
                  width="90"
                  height="110"
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
                      {board
                        .filter(cell => shape.triangles.includes(parseInt(cell.id.replace('cell-', ''))))
                        .map(cell => {
                          const color = SHAPE_COLORS[idx];
                          return (
                            <polygon
                              key={cell.id}
                              points={getTriangleCoords(cell, 30)}
                              fill={color}
                              stroke={isSelected ? SHAPE_COLORS[idx] : '#999'}
                              strokeWidth={isSelected ? "1.5" : "0.5"}
                              opacity="0.95"
                            />
                          );
                        })}
                    </>
                  ) : (
                    <text x="100" y="125" textAnchor="middle" fontSize="48" fill="#ddd">
                      ?
                    </text>
                  )}
                </svg>
              );
            })}
          </div>
          <button className="btn btn-primary shape-clear-btn" onClick={() => {
            setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined })));
            setPlacedShapes(new Set());
            setSelectedShape(null);
          }}>
            Clear Board
          </button>
        </div>
      </div>

      <div className="game-footer">
      </div>
    </div>
  );
};

export default TriangleBoard;
