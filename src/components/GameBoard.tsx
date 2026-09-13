import React, { useState, useEffect } from 'react';
import './GameBoard.css';

interface Shape {
  id: number;
  type: string;
  color: string;
}

interface Cell {
  id: string;
  filled: boolean;
  shapeId?: number;
}

const SHAPES = [
  { id: 1, type: 'square', color: '#FF6B6B' },
  { id: 2, type: 'circle', color: '#4ECDC4' },
  { id: 3, type: 'triangle', color: '#45B7D1' },
  { id: 4, type: 'rect', color: '#FFA07A' },
  { id: 5, type: 'pentagon', color: '#98D8C8' },
  { id: 6, type: 'hexagon', color: '#F7DC6F' },
  { id: 7, type: 'star', color: '#BB8FCE' },
  { id: 8, type: 'diamond', color: '#85C1E2' },
  { id: 9, type: 'heart', color: '#F8B88B' },
  { id: 10, type: 'cross', color: '#52C0A1' },
  { id: 11, type: 'crescent', color: '#E59866' },
  { id: 12, type: 'spiral', color: '#AED6F1' },
];

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
                    ? { backgroundColor: SHAPES[cell.shapeId - 1]?.color }
                    : {}
                }
              >
                {cell.filled && cell.shapeId && (
                  <span className="shape-label">{SHAPES[cell.shapeId - 1]?.type[0].toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Shape Selector */}
        <div className="shape-selector">
          <h2>Select Shape</h2>
          <div className="shapes-grid">
            {SHAPES.map(shape => (
              <div
                key={shape.id}
                className={`shape-button ${selectedShape === shape.id ? 'selected' : ''}`}
                onClick={() => handleShapeSelect(shape.id)}
                style={{ backgroundColor: shape.color }}
                title={shape.type}
              >
                <span className="shape-name">{shape.type}</span>
                <span className="shape-count">{SHAPES.length - shape.id + 1}</span>
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
