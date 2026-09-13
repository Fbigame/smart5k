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
  // 1. 正六边形
  {
    id: 1,
    name: 'Hexagon',
    description: '正六边形',
    triangles: [59, 60, 61, 75, 76, 77],
    rotations: 5,
  },
  
  // 2. 竖长形
  {
    id: 2,
    name: 'Vertical Strip',
    description: '竖长形条',
    triangles: [0, 4, 5, 1, 2, 3],
    rotations: 1,
  },

  // 3. 横宽形
  {
    id: 3,
    name: 'Horizontal Strip',
    description: '横宽形条',
    triangles: [0, 1, 5, 4, 3, 2],
    rotations: 1,
  },

  // 4. L形
  {
    id: 4,
    name: 'L Shape',
    description: 'L形',
    triangles: [0, 1, 2, 3, 4, 5],
    rotations: 3,
  },

  // 5. Z形
  {
    id: 5,
    name: 'Z Shape',
    description: 'Z形',
    triangles: [0, 5, 1, 2, 4, 3],
    rotations: 1,
  },

  // 6. T形
  {
    id: 6,
    name: 'T Shape',
    description: 'T形',
    triangles: [0, 1, 5, 4, 2, 3],
    rotations: 3,
  },

  // 7. S形
  {
    id: 7,
    name: 'S Shape',
    description: 'S形',
    triangles: [0, 4, 1, 2, 5, 3],
    rotations: 1,
  },

  // 8. 梯形
  {
    id: 8,
    name: 'Trapezoid',
    description: '梯形',
    triangles: [0, 1, 5, 4, 3, 2],
    rotations: 2,
  },

  // 9. 风车形
  {
    id: 9,
    name: 'Windmill',
    description: '风车形',
    triangles: [0, 1, 2, 3, 4, 5],
    rotations: 5,
  },

  // 10. 花瓣形
  {
    id: 10,
    name: 'Petal',
    description: '花瓣形',
    triangles: [0, 5, 1, 4, 3, 2],
    rotations: 3,
  },

  // 11. 弦形
  {
    id: 11,
    name: 'Arc',
    description: '弦形',
    triangles: [0, 1, 2, 3, 4, 5],
    rotations: 5,
  },

  // 12. 叶形
  {
    id: 12,
    name: 'Leaf',
    description: '叶形',
    triangles: [0, 1, 5, 4, 2, 3],
    rotations: 3,
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
