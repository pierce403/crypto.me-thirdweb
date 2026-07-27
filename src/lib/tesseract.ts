export type TesseractPoint4 = readonly [
  x: number,
  y: number,
  z: number,
  w: number,
];

export interface TesseractEdge {
  from: number;
  to: number;
  axis: 0 | 1 | 2 | 3;
}

export interface TesseractFace {
  key: string;
  vertices: readonly [number, number, number, number];
  includesW: boolean;
}

export interface ProjectedTesseractVertex {
  index: number;
  x: number;
  y: number;
  z: number;
  w: number;
  depth: number;
  perspectiveScale: number;
}

export interface ProjectedTesseractEdge extends TesseractEdge {
  key: string;
  depth: number;
}

export interface ProjectedTesseractFace extends TesseractFace {
  depth: number;
  points: string;
  centroidX: number;
  centroidY: number;
}

export interface TesseractFrame {
  vertices: ProjectedTesseractVertex[];
  edges: ProjectedTesseractEdge[];
  faces: ProjectedTesseractFace[];
}

type MutablePoint4 = [number, number, number, number];
type Point3 = [number, number, number];
type MarkPoint = readonly [x: number, y: number];

const VIEWBOX_CENTER = 128;
const DRAW_SCALE = 43;
const FOUR_DIMENSIONAL_CAMERA_DISTANCE = 4.75;
const THREE_DIMENSIONAL_CAMERA_DISTANCE = 8;
const CAMERA_YAW = 0.58;
const CAMERA_PITCH = -0.46;
const ETHEREUM_X_SCALE = 0.74;
const ETHEREUM_Y_SCALE = 1.08;
const ETHEREUM_X_SHEAR = -0.18;
const ETHEREUM_TIP_PINCH = 0.34;
const ETHEREUM_UPPER_X_SCALE = 0.9724;
const ETHEREUM_UPPER_X_OFFSET = 1.951;
const ETHEREUM_UPPER_Y_SCALE = 0.60112;
const ETHEREUM_UPPER_Y_OFFSET = 32.994;
const TAU = Math.PI * 2;

export const ETHEREUM_V_BASE: {
  leftShoulder: MarkPoint;
  notch: MarkPoint;
  rightShoulder: MarkPoint;
  bottom: MarkPoint;
} = {
  leftShoulder: [56, 180],
  notch: [128, 211],
  rightShoulder: [200, 180],
  bottom: [128, 240],
};

export const COMPACT_TESSERACT_EDGE_KEYS: ReadonlySet<string> = new Set([
  '5-7',
  '5-13',
  '13-15',
  '14-15',
  '10-14',
  '2-10',
  '2-6',
  '6-7',
  '4-6',
  '6-14',
  '12-14',
  '4-12',
]);

export const COMPACT_TESSERACT_FACE_KEY = '1-3-2';

/**
 * A fixed, dimensional frame used for SSR, small logo treatments, and the
 * reduced-motion experience.
 */
export const STATIC_TESSERACT_PHASE = 0.645;

export const TESSERACT_VERTICES: readonly TesseractPoint4[] = Array.from(
  { length: 16 },
  (_, index) =>
    [0, 1, 2, 3].map((axis) =>
      index & (1 << axis) ? 1 : -1,
    ) as MutablePoint4,
);

export const TESSERACT_EDGES: readonly TesseractEdge[] =
  TESSERACT_VERTICES.flatMap((_, index) =>
    ([0, 1, 2, 3] as const)
      .map((axis) => ({
        from: index,
        to: index ^ (1 << axis),
        axis,
      }))
      .filter(({ to }) => index < to),
  );

function vertexIndex(point: TesseractPoint4) {
  return point.reduce(
    (index, coordinate, axis) =>
      coordinate > 0 ? index | (1 << axis) : index,
    0,
  );
}

function createFaces(): TesseractFace[] {
  const faces: TesseractFace[] = [];
  const perimeter = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const;

  for (let firstAxis = 0; firstAxis < 4; firstAxis += 1) {
    for (let secondAxis = firstAxis + 1; secondAxis < 4; secondAxis += 1) {
      const fixedAxes = ([0, 1, 2, 3] as const).filter(
        (axis) => axis !== firstAxis && axis !== secondAxis,
      );

      for (let fixedSigns = 0; fixedSigns < 4; fixedSigns += 1) {
        const indices = perimeter.map(([firstSign, secondSign]) => {
          const point: MutablePoint4 = [-1, -1, -1, -1];
          point[firstAxis] = firstSign;
          point[secondAxis] = secondSign;
          point[fixedAxes[0]] = fixedSigns & 1 ? 1 : -1;
          point[fixedAxes[1]] = fixedSigns & 2 ? 1 : -1;
          return vertexIndex(point);
        }) as [number, number, number, number];

        faces.push({
          key: `${firstAxis}-${secondAxis}-${fixedSigns}`,
          vertices: indices,
          includesW: firstAxis === 3 || secondAxis === 3,
        });
      }
    }
  }

  return faces;
}

export const TESSERACT_FACES: readonly TesseractFace[] = createFaces();

function rotateInPlane(
  point: MutablePoint4,
  firstAxis: 0 | 1 | 2 | 3,
  secondAxis: 0 | 1 | 2 | 3,
  angle: number,
) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const first = point[firstAxis];
  const second = point[secondAxis];

  point[firstAxis] = first * cosine - second * sine;
  point[secondAxis] = first * sine + second * cosine;
}

/**
 * Rotates through three distinct planes that include W. Integer angular
 * ratios make phase 0 and phase 1 identical, giving the animation an exact
 * seamless loop without accumulating floating-point transform error.
 */
export function rotateTesseractPoint(
  point: TesseractPoint4,
  phase: number,
): MutablePoint4 {
  const rotated = [...point] as MutablePoint4;
  const angle = phase * TAU;

  rotateInPlane(rotated, 0, 3, angle);
  rotateInPlane(rotated, 1, 3, angle * 2);
  rotateInPlane(rotated, 2, 3, -angle * 3);

  return rotated;
}

function orientThreeDimensionalCamera(point: Point3): Point3 {
  const [x, y, z] = point;
  const yawCosine = Math.cos(CAMERA_YAW);
  const yawSine = Math.sin(CAMERA_YAW);
  const yawedX = x * yawCosine - z * yawSine;
  const yawedZ = x * yawSine + z * yawCosine;

  const pitchCosine = Math.cos(CAMERA_PITCH);
  const pitchSine = Math.sin(CAMERA_PITCH);
  const pitchedY = y * pitchCosine - yawedZ * pitchSine;
  const pitchedZ = y * pitchSine + yawedZ * pitchCosine;

  return [yawedX, pitchedY, pitchedZ];
}

export function projectTesseractVertex(
  point: TesseractPoint4,
  phase: number,
  index = 0,
): ProjectedTesseractVertex {
  const [x, y, z, w] = rotateTesseractPoint(point, phase);
  const perspective4 =
    FOUR_DIMENSIONAL_CAMERA_DISTANCE /
    (FOUR_DIMENSIONAL_CAMERA_DISTANCE - w);
  const [cameraX, cameraY, cameraZ] = orientThreeDimensionalCamera([
    x * perspective4,
    y * perspective4,
    z * perspective4,
  ]);
  const perspective3 =
    THREE_DIMENSIONAL_CAMERA_DISTANCE /
    (THREE_DIMENSIONAL_CAMERA_DISTANCE - cameraZ);
  const projectedX = cameraX * perspective3 * DRAW_SCALE;
  const projectedY = -cameraY * perspective3 * DRAW_SCALE;
  const verticalPosition = Math.min(
    1,
    Math.abs(projectedY) / (DRAW_SCALE * 2.25),
  );
  const tipPinch =
    1 - ETHEREUM_TIP_PINCH * verticalPosition ** 1.4;
  const brandedX =
    (projectedX * ETHEREUM_X_SCALE +
      projectedY * ETHEREUM_X_SHEAR) *
    tipPinch;
  const brandedY =
    VIEWBOX_CENTER + projectedY * ETHEREUM_Y_SCALE;

  return {
    index,
    // Preserve the real 4D/3D projection, then give its presentation the
    // upper-body stance associated with Ethereum. A separate stable V base
    // completes the mark without participating in the rotation.
    x:
      VIEWBOX_CENTER +
      brandedX * ETHEREUM_UPPER_X_SCALE +
      ETHEREUM_UPPER_X_OFFSET,
    y:
      ETHEREUM_UPPER_Y_OFFSET +
      brandedY * ETHEREUM_UPPER_Y_SCALE,
    z: cameraZ,
    w,
    depth: Math.max(0, Math.min(1, (cameraZ + 2.5) / 5)),
    perspectiveScale: perspective4 * perspective3,
  };
}

export function createTesseractFrame(
  phase = STATIC_TESSERACT_PHASE,
): TesseractFrame {
  const normalizedPhase = ((phase % 1) + 1) % 1;
  const vertices = TESSERACT_VERTICES.map((point, index) =>
    projectTesseractVertex(point, normalizedPhase, index),
  );

  const edges = TESSERACT_EDGES.map((edge) => ({
    ...edge,
    key: `${edge.from}-${edge.to}`,
    depth: (vertices[edge.from].depth + vertices[edge.to].depth) / 2,
  })).sort((first, second) => first.depth - second.depth);

  const faces = TESSERACT_FACES.map((face) => {
    const faceVertices = face.vertices.map((vertex) => vertices[vertex]);

    return {
      ...face,
      depth:
        faceVertices.reduce(
          (total, vertex) => total + vertex.depth,
          0,
        ) / faceVertices.length,
      centroidX:
        faceVertices.reduce((total, vertex) => total + vertex.x, 0) /
        faceVertices.length,
      centroidY:
        faceVertices.reduce((total, vertex) => total + vertex.y, 0) /
        faceVertices.length,
      points: faceVertices
        .map((vertex) => `${vertex.x},${vertex.y}`)
        .join(' '),
    };
  }).sort((first, second) => first.depth - second.depth);

  return {
    vertices,
    edges,
    faces,
  };
}
