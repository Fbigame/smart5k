import React, { useState, useEffect } from 'react';
import ShapeRenderer from './ShapeRenderer';
import { SHAPES } from '../utils/shapeDefinitions';
import './GameBoard.css';

interface ShapeDefinition {
  id: number;
  name: string;
  description: string;
  triangles: number[];
  rotations?: number;
}

// 每个形状对应的颜色
const SHAPE_COLORS = [
  '#FF6B6B', // Hexagon - Red
  '#4ECDC4', // Vertical Strip - Teal
  '#45B7D1', // Horizontal Strip - Blue
  '#FFA07A', // L Shape - Light Salmon
  '#98D8C8', // Z Shape - Mint
  '#F7DC6F', // T Shape - Yellow
  '#BB8FCE', // S Shape - Purple
  '#85C1E2', // Trapezoid - Light Blue
  '#F8B88B', // Windmill - Peach
  '#52C0A1', // Petal - Teal Green
  '#E59866', // Arc - Orange
  '#AED6F1', // Leaf - Sky Blue
];

interface Cell {
  id: string;
  filled: boolean;
  shapeId?: number;
}

const GRID_SIZE = 6; // 6x6 grid = 36 cells

const GameBoard: React.FC = () => {
  const [board, setBoard] = useState<Cell[]>([]);
  const [selectedShape, setSelectedShape] = useState<number | null>(null);
  const [level, setLevel] = useState(1);
  const [filledCount, setFilledCount] = useState(0);

  // Initialize the board
  useEffect(() => {
    const initialBoard: Cell[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({
      id: `cell-${i}`,
      filled: false,
    }));
    setBoard(initialBoard);
  }, []);

  // Check if all cells are filled
  useEffect(() => {
    const filled = board.filter(cell => cell.filled).length;
    setFilledCount(filled);

    if (filled === GRID_SIZE * GRID_SIZE && board.length > 0) {
      handleLevelComplete();
    }
  }, [board]);

  const handleCellClick = (cellId: string) => {
    if (!selectedShape) return;

    setBoard(prevBoard =>
      prevBoard.map(cell =>
        cell.id === cellId ? { ...cell, filled: true, shapeId: selectedShape } : cell
      )
    );
  };

  const handleShapeSelect = (shapeId: number) => {
    setSelectedShape(selectedShape === shapeId ? null : shapeId);
  };

  const handleLevelComplete = () => {
    alert(`🎉 Level ${level} Complete!\nNext level coming...`);
    resetBoard();
    setLevel(level + 1);
  };

  const resetBoard = () => {
    setBoard(prevBoard => prevBoard.map(cell => ({ ...cell, filled: false, shapeId: undefined })));
    setSelectedShape(null);
  };

  const handleClearBoard = () => {
    resetBoard();
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h1>Shape Fill Game</h1>
        <div className="stats">
          <span>Level: {level}</span>
          <span>Filled: {filledCount}/{GRID_SIZE * GRID_SIZE}</span>
        </div>
      </div>

      <div className="game-content">
        {/* Game Board */}
        <div className="board-wrapper">
          <div className="game-board" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
            {board.map(cell => (
              <div
                key={cell.id}
                className={`game-cell ${cell.filled ? 'filled' : ''}`}
                onClick={() => handleCellClick(cell.id)}
                style={
                  cell.filled && cell.shapeId
                    ? { backgroundColor: SHAPE_COLORS[cell.shapeId - 1] }
                    : {}
                }
              >
                {cell.filled && cell.shapeId && (
                  <span className="shape-label">{SHAPES[cell.shapeId - 1]?.name[0].toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Shape Selector */}
        <div className="shape-selector">
          <h2>Select Shape</h2>
          <div className="shapes-grid">
            {SHAPES.map((shape, index) => (
              <div
                key={shape.id}
                className={`shape-button ${selectedShape === shape.id ? 'selected' : ''}`}
                onClick={() => handleShapeSelect(shape.id)}
                title={shape.description}
                style={{
                  backgroundColor: SHAPE_COLORS[index],
                }}
              >
                <span className="shape-name">{shape.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="game-footer">
        <button className="btn btn-primary" onClick={handleClearBoard}>
          Clear Board
        </button>
        <button className="btn btn-secondary" onClick={() => resetBoard()}>
          Reset Level
        </button>
      </div>
    </div>
  );
};

export default GameBoard;
