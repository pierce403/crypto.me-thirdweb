import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createTesseractFrame,
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
        assert.ok(vertex.x >= 20 && vertex.x <= 236);
        assert.ok(vertex.y >= 20 && vertex.y <= 236);
      }
    }
  });

  it('keeps an Ethereum-like tall crystal silhouette through the motion', () => {
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

    assert.ok(aspectRatios[Math.floor(aspectRatios.length / 2)] <= 0.7);
    assert.ok(aspectRatios[aspectRatios.length - 1] < 0.9);

    const staticVertices = createTesseractFrame().vertices;
    const top = staticVertices.reduce((first, second) =>
      first.y < second.y ? first : second,
    );
    const bottom = staticVertices.reduce((first, second) =>
      first.y > second.y ? first : second,
    );
    assert.ok(Math.abs(top.x - 128) <= 3);
    assert.ok(Math.abs(bottom.x - 128) <= 3);
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
