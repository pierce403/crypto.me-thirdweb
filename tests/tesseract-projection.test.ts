import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMPACT_TESSERACT_EDGE_KEYS,
  COMPACT_TESSERACT_FACE_KEY,
  createTesseractFrame,
  ETHEREUM_UPPER_KITE,
  ETHEREUM_V_BASE,
  projectTesseractVertex,
  rotateTesseractPoint,
  TESSERACT_EDGES,
  TESSERACT_FACES,
  TESSERACT_VERTICES,
} from '../src/lib/tesseract';

describe('tesseract projection', () => {
  it('uses the canonical 16 vertices, 32 edges, and 24 square faces', () => {
    assert.equal(TESSERACT_VERTICES.length, 16);
    assert.equal(new Set(TESSERACT_VERTICES.map(String)).size, 16);
    assert.equal(TESSERACT_EDGES.length, 32);
    assert.equal(TESSERACT_FACES.length, 24);
  });

  it('connects every edge along exactly one four-dimensional axis', () => {
    for (const edge of TESSERACT_EDGES) {
      const from = TESSERACT_VERTICES[edge.from];
      const to = TESSERACT_VERTICES[edge.to];
      const changedAxes = from.filter(
        (coordinate, axis) => coordinate !== to[axis],
      );

      assert.equal(changedAxes.length, 1);
      assert.notEqual(from[edge.axis], to[edge.axis]);
    }
  });

  it('produces finite, padded screen coordinates throughout the loop', () => {
    for (let sample = 0; sample <= 200; sample += 1) {
      const frame = createTesseractFrame(sample / 200);

      for (const vertex of frame.vertices) {
        assert.equal(Number.isFinite(vertex.x), true);
        assert.equal(Number.isFinite(vertex.y), true);
        assert.ok(vertex.x >= 68 && vertex.x <= 186);
        assert.ok(vertex.y >= 47 && vertex.y <= 155);
      }
    }
  });

  it('keeps the rotating tesseract inside the upper Ethereum body', () => {
    const centerX = ETHEREUM_UPPER_KITE.top[0];
    const topY = ETHEREUM_UPPER_KITE.top[1];
    const shoulderY = ETHEREUM_UPPER_KITE.left[1];
    const bottomY = ETHEREUM_UPPER_KITE.bottom[1];
    const halfShoulderWidth =
      ETHEREUM_UPPER_KITE.right[0] - centerX;
    const clipInset = 4;
    const aspectRatios = Array.from({ length: 201 }, (_, sample) => {
      const vertices = createTesseractFrame(sample / 200).vertices;
      const width =
        Math.max(...vertices.map((vertex) => vertex.x)) -
        Math.min(...vertices.map((vertex) => vertex.x));
      const height =
        Math.max(...vertices.map((vertex) => vertex.y)) -
        Math.min(...vertices.map((vertex) => vertex.y));
      return width / height;
    }).sort((first, second) => first - second);

    assert.ok(aspectRatios[0] >= 0.8);
    assert.ok(aspectRatios[aspectRatios.length - 1] <= 1.4);

    for (let sample = 0; sample <= 400; sample += 1) {
      const vertices = createTesseractFrame(sample / 400).vertices;

      for (const vertex of vertices) {
        assert.ok(vertex.y >= topY && vertex.y <= bottomY);
        const halfWidth =
          vertex.y <= shoulderY
            ? ((vertex.y - topY) * halfShoulderWidth) /
              (shoulderY - topY)
            : ((bottomY - vertex.y) * halfShoulderWidth) /
              (bottomY - shoulderY);

        assert.ok(
          Math.abs(vertex.x - centerX) <= halfWidth - clipInset,
          `vertex ${vertex.index} leaves the inset upper kite at phase ${
            sample / 400
          }`,
        );
      }
    }

    const highestLowerVertex = Math.max(
      ...Array.from({ length: 201 }, (_, sample) =>
        Math.max(
          ...createTesseractFrame(sample / 200).vertices.map(
            (vertex) => vertex.y,
          ),
        ),
      ),
    );
    assert.ok(
      ETHEREUM_V_BASE.leftShoulder[1] - highestLowerVertex >= 16,
    );

    const staticVertices = createTesseractFrame().vertices;
    const top = staticVertices.reduce((first, second) =>
      first.y < second.y ? first : second,
    );
    const bottom = staticVertices.reduce((first, second) =>
      first.y > second.y ? first : second,
    );
    assert.ok(Math.abs(top.x - 128) <= 1);
    assert.ok(Math.abs(bottom.x - 128) <= 1);
  });

  it('defines a centered, stable two-facet Ethereum V base', () => {
    const {
      leftShoulder,
      notch,
      rightShoulder,
      bottom,
    } = ETHEREUM_V_BASE;

    assert.equal(leftShoulder[0] + rightShoulder[0], 256);
    assert.equal(leftShoulder[1], rightShoulder[1]);
    assert.equal(notch[0], 128);
    assert.equal(bottom[0], 128);
    assert.ok(notch[1] > leftShoulder[1]);
    assert.ok(bottom[1] > notch[1]);
    assert.ok(bottom[1] <= 240);
    assert.equal(ETHEREUM_UPPER_KITE.top[0], 128);
    assert.equal(ETHEREUM_UPPER_KITE.bottom[0], 128);
    assert.equal(
      ETHEREUM_UPPER_KITE.left[0] +
        ETHEREUM_UPPER_KITE.right[0],
      256,
    );
    assert.equal(
      ETHEREUM_UPPER_KITE.left[1],
      ETHEREUM_UPPER_KITE.right[1],
    );
    assert.ok(
      leftShoulder[1] - ETHEREUM_UPPER_KITE.bottom[1] >= 10,
    );

    const edgeKeys = new Set(TESSERACT_EDGES.map(
      (edge) => `${edge.from}-${edge.to}`,
    ));
    for (const edgeKey of COMPACT_TESSERACT_EDGE_KEYS) {
      assert.equal(edgeKeys.has(edgeKey), true);
    }
    assert.equal(
      TESSERACT_FACES.some(
        (face) => face.key === COMPACT_TESSERACT_FACE_KEY,
      ),
      true,
    );
  });

  it('loops exactly and changes W-plane geometry during the cycle', () => {
    const start = createTesseractFrame(0);
    const quarterTurn = createTesseractFrame(0.25);

    TESSERACT_VERTICES.forEach((vertex, index) => {
      const rotatedStart = rotateTesseractPoint(vertex, 0);
      const rotatedEnd = rotateTesseractPoint(vertex, 1);
      const projectedStart = projectTesseractVertex(vertex, 0, index);
      const projectedEnd = projectTesseractVertex(vertex, 1, index);

      rotatedStart.forEach((coordinate, axis) => {
        assert.ok(Math.abs(coordinate - rotatedEnd[axis]) < 1e-9);
      });
      assert.ok(Math.abs(projectedStart.x - projectedEnd.x) < 1e-9);
      assert.ok(Math.abs(projectedStart.y - projectedEnd.y) < 1e-9);
    });

    assert.ok(
      start.vertices.some(
        (vertex, index) =>
          Math.abs(vertex.x - quarterTurn.vertices[index].x) > 1 ||
          Math.abs(vertex.y - quarterTurn.vertices[index].y) > 1,
      ),
    );

    const original = TESSERACT_VERTICES[0];
    const rotated = rotateTesseractPoint(original, 0.125);
    assert.notEqual(rotated[3], original[3]);
  });

  it('returns deterministic static geometry', () => {
    assert.deepEqual(createTesseractFrame(), createTesseractFrame());
  });
});
