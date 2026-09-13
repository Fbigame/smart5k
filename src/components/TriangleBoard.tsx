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
      setSelectedShape(null);
    }
  }, [board, level]);

  const handleCellClick = (cellId: string) => {
    if (!selectedShape || DISABLED_CELLS.has(cellId)) return;
    
    // 检查这个三角形是否属于选中的形状
    const cellNum = parseInt(cellId.replace('cell-', ''));
    const shapeTriangles = SHAPES[selectedShape - 1]?.triangles || [];
    
    // 只有点击形状的一部分时才填充整个形状
    if (shapeTriangles.includes(cellNum)) {
      setBoard(prevBoard =>
        prevBoard.map(cell => {
          const id = parseInt(cell.id.replace('cell-', ''));
          return shapeTriangles.includes(id) && !cell.filled
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
                  <g key={cell.id}>
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

              {/* 虚拟形状显示 */}
              {selectedShape && SHAPES[selectedShape - 1] && !board.every(cell => 
                !SHAPES[selectedShape - 1].triangles.includes(parseInt(cell.id.replace('cell-', ''))) || cell.filled
              ) && (
                board.map(cell => {
                  const cellNum = parseInt(cell.id.replace('cell-', ''));
                  const shapeTriangles = SHAPES[selectedShape - 1]?.triangles || [];
                  
                  if (shapeTriangles.includes(cellNum) && !cell.filled) {
                    return (
                      <polygon
                        key={`virtual-${cell.id}`}
                        points={getTriangleCoords(cell, triangleSize)}
                        fill={SHAPE_COLORS[selectedShape - 1]}
                        stroke={SHAPE_COLORS[selectedShape - 1]}
                        strokeWidth="1"
                        opacity="0.3"
                        pointerEvents="none"
                      />
                    );
                  }
                  return null;
                })
              )}
            </svg>
          </div>
        </div>

        {/* 右侧：形状选择与预览 */}
        <div className="shape-section">
          <h2>Shapes</h2>
          <div className="shapes-list">
            {SHAPES.map((shape, index) => (
              <div
                key={shape.id}
                className={`shape-item ${selectedShape === shape.id ? 'active' : ''}`}
                onClick={() => handleShapeSelect(shape.id)}
                style={{ borderLeftColor: SHAPE_COLORS[index] }}
                title={shape.description}
              >
                <span className="shape-id">{shape.id}</span>
                <span className="shape-label">{shape.name}</span>
              </div>
            ))}
          </div>

          {/* 形状预览 */}
          {selectedShape && SHAPES[selectedShape - 1] && (
            <div className="shape-preview">
              <h3>{SHAPES[selectedShape - 1].description}</h3>
              <svg width="140" height="160" className="preview-board" viewBox="0 0 140 160" preserveAspectRatio="xMidYMid meet">
                {board
                  .filter(cell => SHAPES[selectedShape - 1]?.triangles.includes(parseInt(cell.id.replace('cell-', ''))))
                  .map(cell => {
                    const color = SHAPE_COLORS[selectedShape - 1];
                    return (
                      <polygon
                        key={cell.id}
                        points={getTriangleCoords(cell, 18)}
                        fill={color}
                        stroke="#333"
                        strokeWidth="0.5"
                        opacity="0.8"
                      />
                    );
                  })}
              </svg>
            </div>
          )}

          <button className="btn btn-primary shape-clear-btn" onClick={() => {
            setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined })));
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
