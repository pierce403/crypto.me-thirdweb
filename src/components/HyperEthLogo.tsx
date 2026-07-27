import {
  useEffect,
  useId,
  useRef,
  useState,
  type SVGProps,
} from 'react';

import {
  createTesseractFrame,
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
const EDGE_COLORS = ['#67E8F9', '#60A5FA', '#818CF8', '#D946EF'] as const;

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
  label = 'Crypto.me four-dimensional hypercube',
  style,
  ...svgProps
}: HyperEthLogoProps) {
  const idSuffix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const edgeGradientId = `hyper-eth-edge-${idSuffix}`;
  const faceGradientId = `hyper-eth-face-${idSuffix}`;
  const glowFilterId = `hyper-eth-glow-${idSuffix}`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const frame = useTesseractFrame(animated, svgRef);

  return (
    <svg
      {...svgProps}
      ref={svgRef}
      data-hyper-eth={animated ? 'animated-4d' : 'static-4d'}
      data-tesseract-vertices="16"
      data-tesseract-edges="32"
      data-tesseract-projection="4d-perspective-to-3d-perspective"
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
        <radialGradient id={faceGradientId}>
          <stop offset="0" stopColor="#A5F3FC" />
          <stop offset="0.56" stopColor="#818CF8" />
          <stop offset="1" stopColor="#C026D3" />
        </radialGradient>
        <filter
          id={glowFilterId}
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation={animated ? 5.5 : 3.5} />
        </filter>
      </defs>

      <circle
        cx="128"
        cy="128"
        r="93"
        fill={`url(#${faceGradientId})`}
        opacity={animated ? 0.045 : 0.065}
        filter={`url(#${glowFilterId})`}
      />

      <g aria-hidden="true">
        {frame.faces.map((face) => (
          <polygon
            key={face.key}
            points={face.points}
            fill={`url(#${faceGradientId})`}
            opacity={
              (face.includesW ? 0.018 : 0.012) +
              face.depth * (animated ? 0.048 : 0.065)
            }
          />
        ))}
      </g>

      <g
        aria-hidden="true"
        fill="none"
        stroke={`url(#${edgeGradientId})`}
        strokeLinecap="round"
        filter={`url(#${glowFilterId})`}
        opacity={animated ? 0.42 : 0.34}
      >
        {frame.edges.map((edge) => {
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
                animated ? 5 + edge.depth * 4 : 7 + edge.depth * 3
              }
            />
          );
        })}
      </g>

      <g aria-hidden="true" fill="none" strokeLinecap="round">
        {frame.edges.map((edge) => {
          const from = frame.vertices[edge.from];
          const to = frame.vertices[edge.to];
          const depthOpacity = 0.34 + edge.depth * 0.64;

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
                animated ? 1.55 + edge.depth * 2.3 : 4.8 + edge.depth * 2
              }
              opacity={depthOpacity}
            />
          );
        })}
      </g>

      <g aria-hidden="true">
        {[...frame.vertices]
          .sort((first, second) => first.depth - second.depth)
          .map((vertex) => (
            <circle
              key={vertex.index}
              cx={vertex.x}
              cy={vertex.y}
              r={
                animated
                  ? 1.45 + vertex.depth * 1.9
                  : 3.1 + vertex.depth * 1.4
              }
              fill={vertexColor(vertex.w)}
              opacity={0.54 + vertex.depth * 0.46}
            />
          ))}
      </g>
    </svg>
  );
}
