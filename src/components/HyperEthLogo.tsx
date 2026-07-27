import { useId, type SVGProps } from 'react';

export interface HyperEthLogoProps
  extends Omit<SVGProps<SVGSVGElement>, 'height' | 'width'> {
  /** Keeps the mark square while accepting either CSS or numeric dimensions. */
  size?: number | string;
  /** Enables the slow dimensional turn and core pulse used in hero treatments. */
  animated?: boolean;
  /** Set to an empty string when nearby text already names the brand. */
  label?: string;
}

/**
 * An original hypercube mark built from two connected, faceted diamonds.
 *
 * The outer and translated inner solids read like a projected tesseract while
 * retaining the upward/downward geometry associated with Ethereum.
 */
export function HyperEthLogo({
  size = 64,
  animated = false,
  label = 'Crypto.me hypercube logo',
  style,
  ...svgProps
}: HyperEthLogoProps) {
  const idSuffix = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const edgeGradientId = `hyper-eth-edge-${idSuffix}`;
  const lightFaceGradientId = `hyper-eth-light-${idSuffix}`;
  const darkFaceGradientId = `hyper-eth-dark-${idSuffix}`;
  const glowFilterId = `hyper-eth-glow-${idSuffix}`;

  return (
    <svg
      {...svgProps}
      data-hyper-eth={animated ? 'animated' : 'static'}
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
          x1="26"
          y1="22"
          x2="226"
          y2="238"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#67E8F9" />
          <stop offset="0.46" stopColor="#6366F1" />
          <stop offset="1" stopColor="#C026D3" />
        </linearGradient>
        <linearGradient
          id={lightFaceGradientId}
          x1="72"
          y1="66"
          x2="190"
          y2="174"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#CFFAFE" />
          <stop offset="0.48" stopColor="#818CF8" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient
          id={darkFaceGradientId}
          x1="90"
          y1="92"
          x2="176"
          y2="201"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="0.58" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7E22CE" />
        </linearGradient>
        <filter
          id={glowFilterId}
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <style>{`
        [data-hyper-eth="animated"] .hyper-eth-scene {
          animation: hyper-eth-dimensional-turn 12s linear infinite;
          transform-box: view-box;
          transform-origin: center;
          transform-style: preserve-3d;
        }

        [data-hyper-eth="animated"] .hyper-eth-core {
          animation: hyper-eth-core-pulse 3.2s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        [data-hyper-eth="animated"] .hyper-eth-aura {
          animation: hyper-eth-aura-pulse 2.8s ease-in-out infinite;
        }

        @keyframes hyper-eth-dimensional-turn {
          0% {
            transform: perspective(620px) rotateX(-7deg) rotateY(0deg) rotateZ(-2deg);
          }
          50% {
            transform: perspective(620px) rotateX(7deg) rotateY(180deg) rotateZ(2deg);
          }
          100% {
            transform: perspective(620px) rotateX(-7deg) rotateY(360deg) rotateZ(-2deg);
          }
        }

        @keyframes hyper-eth-core-pulse {
          0%, 100% {
            transform: scale(0.97);
          }
          50% {
            transform: scale(1.035);
          }
        }

        @keyframes hyper-eth-aura-pulse {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 0.48;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-hyper-eth="animated"] .hyper-eth-scene,
          [data-hyper-eth="animated"] .hyper-eth-core,
          [data-hyper-eth="animated"] .hyper-eth-aura {
            animation: none;
          }
        }
      `}</style>

      <g className="hyper-eth-scene">
        <path
          className="hyper-eth-aura"
          d="M128 14 226 126 128 242 30 126Z"
          fill="none"
          stroke={`url(#${edgeGradientId})`}
          strokeWidth="15"
          strokeLinejoin="round"
          opacity="0.24"
          filter={`url(#${glowFilterId})`}
        />

        <g>
          <path
            d="M128 14 30 126 128 137Z"
            fill="currentColor"
            opacity="0.08"
          />
          <path
            d="M128 14 226 126 128 137Z"
            fill={`url(#${lightFaceGradientId})`}
            opacity="0.2"
          />
          <path
            d="m30 126 98 116v-105Z"
            fill={`url(#${darkFaceGradientId})`}
            opacity="0.16"
          />
          <path
            d="m226 126-98 116V137Z"
            fill="currentColor"
            opacity="0.05"
          />
          <path
            d="M128 14 226 126 128 242 30 126Z"
            fill="none"
            stroke={`url(#${edgeGradientId})`}
            strokeWidth="5"
            strokeLinejoin="round"
          />
        </g>

        <path
          d="M128 14 142 56M226 126h-35M128 242l14-42M30 126h47M128 137l14-5"
          fill="none"
          stroke={`url(#${edgeGradientId})`}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.88"
        />

        <g className="hyper-eth-core">
          <path
            d="m142 56-65 70 65 6Z"
            fill={`url(#${lightFaceGradientId})`}
          />
          <path
            d="m142 56 49 70-49 6Z"
            fill="#818CF8"
            opacity="0.92"
          />
          <path
            d="m77 126 65 74v-68Z"
            fill="#3730A3"
            opacity="0.96"
          />
          <path
            d="m191 126-49 74v-68Z"
            fill={`url(#${darkFaceGradientId})`}
          />
          <path
            d="m142 56 49 70-49 74-65-74Z"
            fill="none"
            stroke={`url(#${edgeGradientId})`}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M77 126l65 6 49-6"
            fill="none"
            stroke="#E0F2FE"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.82"
          />
        </g>

        <circle cx="142" cy="132" r="4" fill="#F0FDFA" />
      </g>
    </svg>
  );
}
