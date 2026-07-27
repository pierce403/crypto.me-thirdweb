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
}

export interface TesseractFrame {
  vertices: ProjectedTesseractVertex[];
  edges: ProjectedTesseractEdge[];
  faces: ProjectedTesseractFace[];
}

type MutablePoint4 = [number, number, number, number];
type Point3 = [number, number, number];

const VIEWBOX_CENTER = 128;
const DRAW_SCALE = 43;
const FOUR_DIMENSIONAL_CAMERA_DISTANCE = 4.75;
const THREE_DIMENSIONAL_CAMERA_DISTANCE = 8;
const CAMERA_YAW = 0.58;
const CAMERA_PITCH = -0.46;
const TAU = Math.PI * 2;

/**
 * A fixed, dimensional frame used for SSR, small logo treatments, and the
 * reduced-motion experience.
 */
export const STATIC_TESSERACT_PHASE = 0.11;

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

  return {
    index,
    x: VIEWBOX_CENTER + cameraX * perspective3 * DRAW_SCALE,
    y: VIEWBOX_CENTER - cameraY * perspective3 * DRAW_SCALE,
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

  const faces = TESSERACT_FACES.map((face) => ({
    ...face,
    depth:
      face.vertices.reduce(
        (total, vertex) => total + vertices[vertex].depth,
        0,
      ) / face.vertices.length,
    points: face.vertices
      .map((vertex) => `${vertices[vertex].x},${vertices[vertex].y}`)
      .join(' '),
  })).sort((first, second) => first.depth - second.depth);

  return {
    vertices,
    edges,
    faces,
  };
}
