/**
 * 道具定义系统
 * 基于正六边形的三角形网格
 * 每个道具由6个等边三角形组成
 */

// 道具形状定义
export interface ShapeDefinition {
  id: number;
  name: string;
  description: string;
  triangles: number[]; // 组成这个形状的三角形索引数组 (0-5)
  rotations?: number; // 可旋转次数
}

/**
 * 所有12个道具的定义
 */
export const SHAPES: ShapeDefinition[] = [
  ...Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `Hexagon ${index + 1}`,
    description: '正六边形',
    triangles: [59, 60, 61, 75, 76, 77],
  })),
];

/**
 * 获取指定ID的道具定义
 */
export function getShapeById(id: number): ShapeDefinition | undefined {
  return SHAPES.find(shape => shape.id === id);
}

/**
 * 道具的SVG坐标计算
 * 基于极坐标系统，6个三角形围绕中心点
 * 每个三角形是一个扇形切片
 */
export function getTriangleCoordinates(
  triangleId: number,
  centerX: number = 0,
  centerY: number = 0,
  size: number = 50
): { x1: number; y1: number; x2: number; y2: number; x3: number; y3: number } {
  const radius = size;
  
  // 6个三角形的起始角度（度数）
  const angles = [-90, -30, 30, 90, 150, -150];
  
  // 转换为弧度
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  
  if (triangleId < 0 || triangleId > 5) {
    triangleId = 0;
  }
  
  const angle1Rad = toRad(angles[triangleId]);
  const angle2Rad = toRad(angles[(triangleId + 1) % 6]);
  
  // 中心点
  const cx = centerX;
  const cy = centerY;
  
  // 两个外围顶点
  const x2 = cx + radius * Math.cos(angle1Rad);
  const y2 = cy + radius * Math.sin(angle1Rad);
  const x3 = cx + radius * Math.cos(angle2Rad);
  const y3 = cy + radius * Math.sin(angle2Rad);
  
  return {
    x1: cx,
    y1: cy,
    x2: x2,
    y2: y2,
    x3: x3,
    y3: y3,
  };
}
