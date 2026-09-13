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
    setBoard(prevBoard =>
      prevBoard.map(cell =>
        cell.id === cellId && !cell.filled
          ? { ...cell, filled: true, shapeId: selectedShape }
          : cell
      )
    );
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

  const h = (35 * Math.sqrt(3)) / 2;
  const svgHeight = 9 * h + 40;
  const svgWidth = 18 * 35 / 2 + 40;

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
        <div className="board-wrapper">
          <svg width={svgWidth} height={svgHeight} className="triangle-board" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            {board.map(cell => {
              const isDisabled = DISABLED_CELLS.has(cell.id);
              let fill: string;
              let stroke: string;

              if (isDisabled) {
                // 禁用的三角形显示为浅灰色
                fill = '#d3d3d3';
                stroke = '#aaa';
              } else if (cell.filled) {
                fill = SHAPE_COLORS[cell.shapeId ? cell.shapeId - 1 : 0];
                stroke = '#ddd';
              } else {
                fill = '#fff';
                stroke = '#999';
              }

              return (
                <polygon
                  key={cell.id}
                  points={getTriangleCoords(cell)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={cell.filled || isDisabled ? '0.5' : '1'}
                  className="triangle-cell"
                  onClick={() => handleCellClick(cell.id)}
                  style={{ cursor: !isDisabled && selectedShape && !cell.filled ? 'pointer' : 'default', pointerEvents: isDisabled ? 'none' : 'auto' }}
                />
              );
            })}
          </svg>
        </div>

        <div className="shape-selector">
          <h2>Select Shape</h2>
          <div className="shapes-grid">
            {SHAPES.map((shape, index) => (
              <div
                key={shape.id}
                className={`shape-button ${selectedShape === shape.id ? 'selected' : ''}`}
                onClick={() => handleShapeSelect(shape.id)}
                style={{ backgroundColor: SHAPE_COLORS[index] }}
              >
                <span className="shape-name">{shape.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="game-footer">
        <button className="btn btn-primary" onClick={() => {
          setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined })));
          setSelectedShape(null);
        }}>
          Clear Board
        </button>
      </div>
    </div>
  );
};

export default TriangleBoard;
