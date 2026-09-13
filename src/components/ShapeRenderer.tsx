import React from 'react';
import { ShapeDefinition, getTriangleCoordinates } from '../utils/shapeDefinitions';
import './ShapeRenderer.css';

interface ShapeRendererProps {
  shape: ShapeDefinition;
  color: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * 道具渲染组件
 * 使用SVG绘制基于三角形网格的道具形状
 */
const ShapeRenderer: React.FC<ShapeRendererProps> = ({
  shape,
  color,
  size = 100,
  className = '',
  onClick,
}) => {
  // SVG容器大小
  const padding = 15;
  const svgSize = size + padding * 2;
  const centerX = svgSize / 2;
  const centerY = svgSize / 2;
  const triangleSize = size / 2.5; // 调整三角形大小以适应总大小

  // 渲染三角形
  const renderTriangle = (triangleId: number) => {
    const coords = getTriangleCoordinates(triangleId, centerX, centerY, triangleSize);
    const pathData = `M ${coords.x1} ${coords.y1} L ${coords.x2} ${coords.y2} L ${coords.x3} ${coords.y3} Z`;

    return (
      <path
        key={`triangle-${triangleId}`}
        d={pathData}
        fill={color}
        stroke="rgba(255, 255, 255, 0.4)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    );
  };

  return (
    <svg
      className={`shape-renderer ${className}`}
      width={svgSize}
      height={svgSize}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* 背景 */}
      <rect width={svgSize} height={svgSize} fill="transparent" />

      {/* 绘制组成这个形状的三角形 */}
      {shape.triangles.map((triangleId) => renderTriangle(triangleId))}

      {/* 可选的外轮廓 */}
      {false && (
        <g fill="none" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5">
          {shape.triangles.map((triangleId) => {
            const coords = getTriangleCoordinates(
              triangleId,
              centerX,
              centerY,
              triangleSize
            );
            const pathData = `M ${coords.x1} ${coords.y1} L ${coords.x2} ${coords.y2} L ${coords.x3} ${coords.y3} Z`;
            return <path key={`outline-${triangleId}`} d={pathData} />;
          })}
        </g>
      )}
    </svg>
  );
};

export default ShapeRenderer;
