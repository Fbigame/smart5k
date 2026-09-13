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
  {
    id: 1,
    name: 'Shape 1',
    description: '形状1',
    triangles: [59, 60, 61, 75, 76, 77],
  },
  {
    id: 2,
    name: 'Shape 2',
    description: '形状2',
    triangles: [52, 53, 54, 68, 69, 70],
  },
  {
    id: 3,
    name: 'Shape 3',
    description: '形状3',
    triangles: [57, 58, 71, 72, 73, 74],
  },
  {
    id: 4,
    name: 'Shape 4',
    description: '形状4',
    triangles: [36, 37, 38, 50, 51, 67],
  },
  {
    id: 5,
    name: 'Shape 5',
    description: '形状5',
    triangles: [34, 35, 46, 47, 48, 62],
  },
  {
    id: 6,
    name: 'Shape 6',
    description: '形状6',
    triangles: [42, 43, 44, 45, 55, 56],
  },
  {
    id: 7,
    name: 'Shape 7',
    description: '形状7',
    triangles: [25, 26, 27, 39, 40, 41],
  },
  {
    id: 8,
    name: 'Shape 8',
    description: '形状8',
    triangles: [39, 40, 41, 42, 43, 44],
  },
  {
    id: 9,
    name: 'Shape 9',
    description: '形状9',
    triangles: [9, 11, 16, 17, 18, 19],
  },
  {
    id: 10,
    name: 'Shape 10',
    description: '形状10',
    triangles: [15, 20, 21, 22, 23, 24],
  },
  {
    id: 11,
    name: 'Shape 11',
    description: '形状11',
    triangles: [1, 4, 5, 6, 10, 12],
  },
  {
    id: 12,
    name: 'Shape 12',
    description: '形状12',
    triangles: [2, 3, 7, 8, 13, 14],
  },
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
