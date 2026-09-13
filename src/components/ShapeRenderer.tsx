import React from 'react';
import './ShapeRenderer.css';

interface ShapeDefinition {
  id: number;
  name: string;
  description: string;
  triangles: number[];
  rotations?: number;
}

interface ShapeRendererProps {
  shape: ShapeDefinition;
  color: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * 简化的道具渲染组件 - 彩色方块表示
 */
const ShapeRenderer: React.FC<ShapeRendererProps> = ({
  shape,
  color,
  size = 100,
  className = '',
  onClick,
}) => {
  return (
    <div
      className={`shape-renderer ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}
      onClick={onClick}
      title={shape.description}
    >
      <span style={{ 
        color: 'white', 
        fontSize: '20px', 
        fontWeight: 'bold',
        opacity: 0.8,
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
      }}>
        {shape.id}
      </span>
    </div>
  );
};

export default ShapeRenderer;
