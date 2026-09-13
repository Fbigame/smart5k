/**
 * 道具定义系统
 * 基于正六边形的三角形网格
 * 每个道具由6个等边三角形组成
 */

// 三角形的方向：UP（向上） 或 DOWN（向下）
type TriangleDirection = 'UP' | 'DOWN';

// 单个三角形的定义
interface Triangle {
  id: number; // 在6个三角形中的索引 (0-5)
  direction: TriangleDirection;
  row: number; // 网格行位置
  col: number; // 网格列位置
}

// 道具形状定义
export interface ShapeDefinition {
  id: number;
  name: string;
  description: string;
  triangles: number[]; // 组成这个形状的三角形索引数组 (0-5)
  rotations?: number; // 可旋转次数（0=不旋转, 3=180度, 5=72度等）
}

/**
 * 标准正六边形的三角形布局
 * 
 *     0(UP)
 *    / \
 *   / 5 \
 *  /     \
 * 1(DOWN)-4(UP)
 *  \     /
 *   \ 2 /
 *    \ /
 *     3(DOWN)
 * 
 * 六个三角形的位置映射：
 * - 三角形0 (UP)   : 顶部中心
 * - 三角形1 (DOWN) : 左上
 * - 三角形2 (DOWN) : 左下
 * - 三角形3 (DOWN) : 底部中心
 * - 三角形4 (UP)   : 右下
 * - 三角形5 (UP)   : 右上
 */

export const STANDARD_HEXAGON_TRIANGLES = [0, 1, 2, 3, 4, 5];

/**
 * 所有12个道具的定义
 */
export const SHAPES: ShapeDefinition[] = [
  // 1. 正六边形
  {
    id: 1,
    name: 'Hexagon',
    description: '正六边形',
    triangles: [0, 1, 2, 3, 4, 5],
    rotations: 5, // 可旋转60度
  },
  
  // 2. 竖长形 (3个上 + 3个下，排成竖条)
  {
    id: 2,
    name: 'Vertical Strip',
    description: '竖长形条',
    triangles: [0, 4, 5, 1, 2, 3],
    rotations: 1, // 可旋转180度
  },

  // 3. 横宽形 (3个上 + 3个下，排成横条)
  {
    id: 3,
    name: 'Horizontal Strip',
    description: '横宽形条',
    triangles: [0, 1, 5, 4, 3, 2],
    rotations: 1,
  },

  // 4. L形 (4个相邻 + 2个)
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

  // 11. 弦形 (5个相邻 + 1个)
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
 * 获取所有道具的基本信息
 */
export function getAllShapes(): ShapeDefinition[] {
  return SHAPES;
}

/**
 * 道具的SVG坐标计算
 * 基于标准的正六边形网格
 * 使用极坐标系统，6个三角形围绕中心点
 */
export function getTriangleCoordinates(
  triangleId: number,
  centerX: number = 0,
  centerY: number = 0,
  size: number = 50
): { x1: number; y1: number; x2: number; y2: number; x3: number; y3: number } {
  // 正六边形的外接圆半径等于边长
  const radius = size;

  // 6个三角形的角度（每个60度）
  const angles = [
    -90, // 顶部 (0)
    -30, // 右上 (1)
    30,  // 右下 (2)
    90,  // 底部 (3)
    150, // 左下 (4)
    -150, // 左上 (5)
  ];

  // 计算每个三角形的三个顶点
  const angleToRad = (angle: number) => (angle * Math.PI) / 180;

  const triangleCoords: Record<
    number,
    { x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  > = {};

  for (let i = 0; i < 6; i++) {
    const angle1 = angleToRad(angles[i]);
    const angle2 = angleToRad(angles[(i + 1) % 6]);

    // 中心点
    const cx = centerX;
    const cy = centerY;

    // 两个外围点
    const x1 = cx + radius * Math.cos(angle1);
    const y1 = cy + radius * Math.sin(angle1);
    const x2 = cx + radius * Math.cos(angle2);
    const y2 = cy + radius * Math.sin(angle2);

    triangleCoords[i] = {
      x1: cx,
      y1: cy,
      x2: x1,
      y2: y1,
      x3: x2,
      y3: y2,
    };
  }

  return triangleCoords[triangleId] || triangleCoords[0];
}
