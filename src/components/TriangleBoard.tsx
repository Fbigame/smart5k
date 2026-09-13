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
    
    const cellNum = parseInt(cellId.replace('cell-', ''));
    const validPlacements = getValidPlacements(selectedShape);
    
    // 查找包含这个三角形的有效放置
    for (const placement of validPlacements) {
      if (placement.includes(cellNum)) {
        // 填充这个放置中的所有三角形
        setBoard(prevBoard =>
          prevBoard.map(cell => {
            const id = parseInt(cell.id.replace('cell-', ''));
            return placement.includes(id) && !cell.filled
              ? { ...cell, filled: true, shapeId: selectedShape }
              : cell;
          })
        );
        return;
      }
    }
  };

  const handleShapeSelect = (shapeId: number) => {
    setSelectedShape(selectedShape === shapeId ? null : shapeId);
  };

  // 计算所有可能的放置位置
  const getValidPlacements = (shapeId: number): number[][] => {
    if (!shapeId || !SHAPES[shapeId - 1]) return [];
    
    const shapeTriangles = SHAPES[shapeId - 1].triangles;
    const placements: number[][] = [];
    
    // 获取形状的基准三角形（第一个三角形）的行列坐标
    const baseCell = board.find(c => c.id === `cell-${shapeTriangles[0]}`);
    if (!baseCell) return [];
    
    // 计算形状中其他三角形相对于基准三角形的相对坐标
    const relativePositions: Array<{row: number; col: number; direction: 'UP' | 'DOWN'}> = [];
    for (const triangleId of shapeTriangles) {
      const cell = board.find(c => c.id === `cell-${triangleId}`);
      if (cell) {
        relativePositions.push({
          row: cell.row - baseCell.row,
          col: cell.col - baseCell.col,
          direction: cell.direction
        });
      }
    }
    
    // 对每个有效的起始三角形，应用相同的相对位置
    for (const centerCell of board) {
      if (DISABLED_CELLS.has(centerCell.id) || centerCell.filled) continue;
      
      // 计算这个中心位置的所有三角形
      const mappedTriangles: number[] = [];
      let allValid = true;
      
      for (const relPos of relativePositions) {
        const targetRow = centerCell.row + relPos.row;
        const targetCol = centerCell.col + relPos.col;
        
        // 找到对应的三角形
        const targetCell = board.find(c => 
          c.row === targetRow && 
          c.col === targetCol && 
          c.direction === relPos.direction
        );
        
        if (!targetCell || DISABLED_CELLS.has(targetCell.id) || targetCell.filled) {
          allValid = false;
          break;
        }
        
        mappedTriangles.push(parseInt(targetCell.id.replace('cell-', '')));
      }
      
      if (allValid && mappedTriangles.length === shapeTriangles.length) {
        placements.push(mappedTriangles);
      }
    }
    
    return placements;
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

              {/* 虚拟形状显示 - 显示所有可能的放置位置 */}
              {selectedShape && (
                (() => {
                  const validPlacements = getValidPlacements(selectedShape);
                  return validPlacements.map((placement, idx) => 
                    placement.map(triangleId => {
                      const cell = board.find(c => c.id === `cell-${triangleId}`);
                      if (!cell) return null;
                      
                      return (
                        <polygon
                          key={`virtual-${idx}-${triangleId}`}
                          points={getTriangleCoords(cell, triangleSize)}
                          fill={SHAPE_COLORS[selectedShape - 1]}
                          stroke={SHAPE_COLORS[selectedShape - 1]}
                          strokeWidth="1"
                          opacity="0.2"
                          pointerEvents="none"
                        />
                      );
                    })
                  );
                })()
              )}
            </svg>
          </div>
        </div>

        {/* 右侧：形状选择与预览 */}
        <div className="shape-section">
          {!selectedShape ? (
            <div className="shapes-list">
              <h2>Shapes</h2>
              {SHAPES.map((shape, index) => (
                <div
                  key={shape.id}
                  className={`shape-item`}
                  onClick={() => handleShapeSelect(shape.id)}
                  style={{ borderLeftColor: SHAPE_COLORS[index] }}
                  title={shape.description}
                >
                  <span className="shape-id">{shape.id}</span>
                  <span className="shape-label">{shape.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <button 
                className="back-btn"
                onClick={() => setSelectedShape(null)}
                style={{ alignSelf: 'flex-start', marginBottom: '10px' }}
              >
                ← Back
              </button>
              <h2>{SHAPES[selectedShape - 1]?.description}</h2>
              <svg width="160" height="180" className="preview-board-large" viewBox="0 0 160 180" preserveAspectRatio="xMidYMid meet">
                {board
                  .filter(cell => SHAPES[selectedShape - 1]?.triangles.includes(parseInt(cell.id.replace('cell-', ''))))
                  .map(cell => {
                    const color = SHAPE_COLORS[selectedShape - 1];
                    return (
                      <polygon
                        key={cell.id}
                        points={getTriangleCoords(cell, 20)}
                        fill={color}
                        stroke="#333"
                        strokeWidth="0.5"
                        opacity="0.9"
                      />
                    );
                  })}
              </svg>
              <p style={{ fontSize: '12px', marginTop: '10px', textAlign: 'center', color: '#666' }}>
                点击棋盘放置这个形状
              </p>
            </>
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
