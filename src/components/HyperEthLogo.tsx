import {
  useEffect,
  useId,
  useRef,
  useState,
  type SVGProps,
} from 'react';

import {
  COMPACT_TESSERACT_EDGE_KEYS,
  COMPACT_TESSERACT_FACE_KEY,
  createTesseractFrame,
  ETHEREUM_V_BASE,
  STATIC_TESSERACT_PHASE,
  type TesseractFrame,
} from '../lib/tesseract';

export interface HyperEthLogoProps
  extends Omit<SVGProps<SVGSVGElement>, 'height' | 'ref' | 'width'> {
  /** Keeps the mark square while accepting either CSS or numeric dimensions. */
  size?: number | string;
  /** Enables the true four-dimensional tesseract rotation used in the hero. */
  animated?: boolean;
  /** Set to an empty string when nearby text already names the brand. */
  label?: string;
}

const LOOP_DURATION_MS = 20_000;
const FRAME_INTERVAL_MS = 1_000 / 45;
const STATIC_FRAME = createTesseractFrame(STATIC_TESSERACT_PHASE);
const EDGE_COLORS = ['#A5F3FC', '#93C5FD', '#A5B4FC', '#D946EF'] as const;
const V_BASE_LEFT_POINTS = [
  ETHEREUM_V_BASE.leftShoulder,
  ETHEREUM_V_BASE.notch,
  ETHEREUM_V_BASE.bottom,
].join(' ');
const V_BASE_RIGHT_POINTS = [
  ETHEREUM_V_BASE.rightShoulder,
  ETHEREUM_V_BASE.notch,
  ETHEREUM_V_BASE.bottom,
].join(' ');
const V_BASE_OUTLINE_PATH = [
  `M${ETHEREUM_V_BASE.leftShoulder.join(' ')}`,
  `L${ETHEREUM_V_BASE.notch.join(' ')}`,
  `L${ETHEREUM_V_BASE.rightShoulder.join(' ')}`,
  `L${ETHEREUM_V_BASE.bottom.join(' ')}`,
  'Z',
].join(' ');
const V_BASE_RIDGE_PATH = [
  `M${ETHEREUM_V_BASE.notch.join(' ')}`,
  `L${ETHEREUM_V_BASE.bottom.join(' ')}`,
].join(' ');

function vertexColor(w: number) {
  const mix = Math.max(0, Math.min(1, (w + 2) / 4));
  const far = [199, 210, 254];
  const near = [240, 253, 250];
  const channel = (index: number) =>
    Math.round(far[index] + (near[index] - far[index]) * mix);

  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function useTesseractFrame(
  animated: boolean,
  svgRef: React.RefObject<SVGSVGElement | null>,
) {
  const [frame, setFrame] = useState<TesseractFrame>(STATIC_FRAME);

  useEffect(() => {
    if (!animated || typeof window === 'undefined') {
      setFrame(STATIC_FRAME);
      return;
    }

    const motionPreference = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    let frameRequest = 0;
    let elapsedAnimationMs = 0;
    let previousAnimationTimestamp: number | undefined;
    let lastRenderedAt = 0;
    let isVisible = document.visibilityState !== 'hidden';
    let isIntersecting = true;

    const cancelFrame = () => {
      if (frameRequest) {
        window.cancelAnimationFrame(frameRequest);
        frameRequest = 0;
      }
    };

    const draw = (timestamp: number) => {
      frameRequest = 0;

      if (
        motionPreference.matches ||
        !isVisible ||
        !isIntersecting
      ) {
        return;
      }

      if (previousAnimationTimestamp !== undefined) {
        elapsedAnimationMs += timestamp - previousAnimationTimestamp;
      }
      previousAnimationTimestamp = timestamp;

      if (timestamp - lastRenderedAt >= FRAME_INTERVAL_MS) {
        setFrame(
          createTesseractFrame(
            STATIC_TESSERACT_PHASE +
              elapsedAnimationMs / LOOP_DURATION_MS,
          ),
        );
        lastRenderedAt = timestamp;
      }

      frameRequest = window.requestAnimationFrame(draw);
    };

    const scheduleFrame = () => {
      cancelFrame();
      previousAnimationTimestamp = undefined;
      if (
        !motionPreference.matches &&
        isVisible &&
        isIntersecting
      ) {
        frameRequest = window.requestAnimationFrame(draw);
      }
    };

    const syncMotionPreference = () => {
      if (motionPreference.matches) {
        elapsedAnimationMs = 0;
        setFrame(STATIC_FRAME);
      } else {
        lastRenderedAt = 0;
      }
      scheduleFrame();
    };

    const syncDocumentVisibility = () => {
      isVisible = document.visibilityState !== 'hidden';
      scheduleFrame();
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              isIntersecting = entry?.isIntersecting ?? true;
              scheduleFrame();
            },
            { rootMargin: '120px' },
          );

    if (svgRef.current) {
      observer?.observe(svgRef.current);
    }

    const modernAddListener =
      motionPreference.addEventListener?.bind(motionPreference);
    const modernRemoveListener =
      motionPreference.removeEventListener?.bind(motionPreference);
    const legacyMotionPreference = motionPreference as unknown as {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };

    if (modernAddListener) {
      modernAddListener('change', syncMotionPreference);
    } else {
      legacyMotionPreference.addListener?.(syncMotionPreference);
    }
    document.addEventListener('visibilitychange', syncDocumentVisibility);
    syncMotionPreference();

    return () => {
      cancelFrame();
      observer?.disconnect();
      if (modernRemoveListener) {
        modernRemoveListener('change', syncMotionPreference);
      } else {
        legacyMotionPreference.removeListener?.(syncMotionPreference);
      }
      document.removeEventListener(
        'visibilitychange',
        syncDocumentVisibility,
      );
    };
  }, [animated, svgRef]);

  return frame;
}

/**
 * The crypto.me mark is a canonical tesseract: 16 vertices and 32 edges are
 * rotated in XW, YW, and ZW planes, perspective-projected into 3D, then
 * projected once more into this SVG.
 */
export function HyperEthLogo({
  size = 64,
  animated = false,
  label = 'Crypto.me Ethereum tesseract',
  style,
  ...svgProps
}: HyperEthLogoProps) {
  const idSuffix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const edgeGradientId = `hyper-eth-edge-${idSuffix}`;
  const auraGradientId = `hyper-eth-aura-${idSuffix}`;
  const lightFaceGradientId = `hyper-eth-face-light-${idSuffix}`;
  const darkFaceGradientId = `hyper-eth-face-dark-${idSuffix}`;
  const baseLeftGradientId = `hyper-eth-base-left-${idSuffix}`;
  const baseRightGradientId = `hyper-eth-base-right-${idSuffix}`;
  const glowFilterId = `hyper-eth-glow-${idSuffix}`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frame = useTesseractFrame(animated, svgRef);
  const displayedFaces = animated
    ? frame.faces
    : frame.faces.filter(
        (face) => face.key === COMPACT_TESSERACT_FACE_KEY,
      );
  const displayedEdges = animated
    ? frame.edges
    : frame.edges.filter(
        (edge) => COMPACT_TESSERACT_EDGE_KEYS.has(edge.key),
      );

  return (
    <svg
      {...svgProps}
      ref={svgRef}
      data-hyper-eth={animated ? 'animated-4d' : 'static-4d'}
      data-tesseract-vertices="16"
      data-tesseract-edges="32"
      data-tesseract-projection="4d-perspective-to-3d-perspective"
      data-brand-silhouette="ethereum-tesseract-v"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ display: 'block', isolation: 'isolate', ...style }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id={edgeGradientId}
          x1="34"
          y1="24"
          x2="224"
          y2="232"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#67E8F9" />
          <stop offset="0.5" stopColor="#6366F1" />
          <stop offset="1" stopColor="#D946EF" />
        </linearGradient>
        <radialGradient id={auraGradientId}>
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="0.58" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#C026D3" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={lightFaceGradientId}
          x1="54"
          y1="36"
          x2="174"
          y2="212"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#E0F2FE" />
          <stop offset="0.5" stopColor="#A5B4FC" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient
          id={darkFaceGradientId}
          x1="92"
          y1="38"
          x2="204"
          y2="224"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="0.54" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#86198F" />
        </linearGradient>
        <linearGradient
          id={baseLeftGradientId}
          x1="56"
          y1="180"
          x2="136"
          y2="240"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#CFFAFE" />
          <stop offset="0.46" stopColor="#A5B4FC" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient
          id={baseRightGradientId}
          x1="200"
          y1="180"
          x2="120"
          y2="240"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="0.55" stopColor="#6D28D9" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <filter
          id={glowFilterId}
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={animated ? 4 : 3.5} />
        </filter>
      </defs>

      <ellipse
        cx="128"
        cy="118"
        rx="86"
        ry="106"
        fill={`url(#${auraGradientId})`}
        opacity={animated ? 0.055 : 0.045}
        filter={`url(#${glowFilterId})`}
      />

      <g
        data-brand-part="ethereum-v-base"
        data-ethereum-v-base="stable"
        aria-hidden="true"
      >
        <g filter={`url(#${glowFilterId})`} opacity={animated ? 0.2 : 0.14}>
          <polygon
            points={V_BASE_LEFT_POINTS}
            fill={`url(#${baseLeftGradientId})`}
          />
          <polygon
            points={V_BASE_RIGHT_POINTS}
            fill={`url(#${baseRightGradientId})`}
          />
        </g>
        <polygon
          points={V_BASE_LEFT_POINTS}
          fill={`url(#${baseLeftGradientId})`}
          opacity={animated ? 0.78 : 0.94}
        />
        <polygon
          points={V_BASE_RIGHT_POINTS}
          fill={`url(#${baseRightGradientId})`}
          opacity={animated ? 0.7 : 0.9}
        />
        <path
          d={V_BASE_OUTLINE_PATH}
          fill="none"
          stroke={`url(#${edgeGradientId})`}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={animated ? 1.8 : 4.6}
          opacity={animated ? 0.72 : 0.9}
        />
        <path
          d={V_BASE_RIDGE_PATH}
          fill="none"
          stroke="#C4B5FD"
          strokeLinecap="round"
          strokeWidth={animated ? 1.2 : 3.4}
          opacity={animated ? 0.42 : 0.68}
        />
      </g>

      <g
        data-brand-part="upper-tesseract"
        data-upper-frame="none"
        aria-hidden="true"
      >
        <g>
          <g>
            {displayedFaces.map((face) => (
              <polygon
                key={face.key}
                points={face.points}
                fill={`url(#${
                  face.centroidX <= 128
                    ? lightFaceGradientId
                    : darkFaceGradientId
                })`}
                opacity={
                  animated
                    ? (face.includesW ? 0.018 : 0.01) +
                      (face.centroidY < 90 ? 0.014 : 0) +
                      face.depth ** 2 * 0.13
                    : 0.32
                }
              />
            ))}
          </g>

          <g
            fill="none"
            stroke={`url(#${edgeGradientId})`}
            strokeLinecap="round"
            filter={`url(#${glowFilterId})`}
            opacity={animated ? 0.34 : 0.24}
          >
            {displayedEdges.map((edge) => {
              const from = frame.vertices[edge.from];
              const to = frame.vertices[edge.to];

              return (
                <line
                  key={edge.key}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  strokeWidth={
                    animated ? 4.6 + edge.depth * 3.7 : 6.8 + edge.depth * 2.6
                  }
                />
              );
            })}
          </g>

          <g fill="none" strokeLinecap="round">
            {displayedEdges.map((edge) => {
              const from = frame.vertices[edge.from];
              const to = frame.vertices[edge.to];
              const depthOpacity = animated
                ? 0.12 + edge.depth ** 1.35 * 0.76
                : 0.86;

              return (
                <line
                  key={edge.key}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={
                    edge.axis === 3
                      ? EDGE_COLORS[3]
                      : EDGE_COLORS[edge.axis]
                  }
                  strokeWidth={
                    animated
                      ? 1.05 +
                        edge.depth * 2.05 +
                        (edge.axis === 3 ? 0.3 : 0)
                      : 4.8 + edge.depth * 1.8
                  }
                  opacity={depthOpacity}
                />
              );
            })}
          </g>

          {animated && (
            <g>
              {[...frame.vertices]
                .sort((first, second) => first.depth - second.depth)
                .map((vertex) => (
                  <circle
                    key={vertex.index}
                    cx={vertex.x}
                    cy={vertex.y}
                    r={0.55 + vertex.depth}
                    fill={vertexColor(vertex.w)}
                    opacity={0.06 + vertex.depth ** 2 * 0.58}
                  />
                ))}
            </g>
          )}
        </g>

      </g>
    </svg>
  );
}
