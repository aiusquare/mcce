import { Link } from "react-router-dom";
import { schoolConfig } from "@/config/schoolConfig";
import logo from "@/assets/logo.png";

/**
 * Modern vector emblem representing Maslaha Community College Advance Studies:
 * - Academic shield with sapphire border
 * - Golden open book of knowledge and scholarship
 * - Radiant star/torch of enlightened learning
 * - Emerald laurel branches representing community growth (Maslaha)
 */
export function MaslahaEmblem({
  className = "h-12 w-12",
  useImage = true,
}: {
  className?: string;
  useImage?: boolean;
}) {
  if (useImage && logo) {
    return (
      <img
        src={logo}
        alt={`${schoolConfig.name.acronym} Logo`}
        className={`${className} object-contain shrink-0 drop-shadow-sm`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${className} shrink-0 drop-shadow-sm`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${schoolConfig.name.full} Emblem`}
    >
      {/* Outer Collegiate Circle */}
      <circle
        cx="50"
        cy="50"
        r="48"
        className="fill-primary stroke-gold stroke-[2]"
      />
      <circle
        cx="50"
        cy="50"
        r="42"
        className="stroke-primary-foreground/20 stroke-[1]"
      />

      {/* Inner Crest Shield */}
      <path
        d="M50 18 C66 18 76 25 76 44 C76 66 50 82 50 82 C50 82 24 66 24 44 C24 25 34 18 50 18 Z"
        className="fill-primary-foreground/10 stroke-gold stroke-[1.5]"
      />

      {/* Radiant Torch of Knowledge / Star */}
      <circle cx="50" cy="32" r="4.5" className="fill-gold" />
      <path
        d="M50 22 L50 26 M44 26 L47 28 M56 26 L53 28"
        className="stroke-gold stroke-[1.5] stroke-linecap-round"
      />

      {/* Open Book of Academic Excellence */}
      <path
        d="M50 49 C44 45 35 44 32 46 L32 62 C35 60 44 61 50 65 C56 61 65 60 68 62 L68 46 C65 44 56 45 50 49 Z"
        className="fill-white stroke-primary stroke-[1]"
      />
      <line
        x1="50"
        y1="49"
        x2="50"
        y2="65"
        className="stroke-primary stroke-[1.5]"
      />

      {/* Emerald Laurel Arc at Bottom */}
      <path
        d="M32 72 C37 77 43 80 50 80 C57 80 63 77 68 72"
        className="stroke-secondary stroke-[2] stroke-linecap-round"
      />

      {/* Academic Acronym Pill */}
      <rect
        x="36"
        y="69"
        width="28"
        height="9"
        rx="4.5"
        className="fill-gold"
      />
      <text
        x="50"
        y="75.5"
        textAnchor="middle"
        className="fill-foreground font-sans text-[6.5px] font-extrabold tracking-wider"
      >
        MCCE
      </text>
    </svg>
  );
}

export function Logo({
  className = "",
  size = "md",
  showText = true,
  inverse = false,
  useImage = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  inverse?: boolean;
  useImage?: boolean;
}) {
  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-12 w-12 md:h-14 md:w-14",
    lg: "h-16 w-16 md:h-20 md:w-20",
  };

  return (
    <Link to="/" className={`flex items-center gap-3 group ${className}`}>
      <div className="relative transition-transform duration-200 group-hover:scale-105">
        <MaslahaEmblem
          className={sizeClasses[size] || sizeClasses.md}
          useImage={useImage}
        />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-serif text-lg font-bold leading-tight tracking-tight transition-colors ${
              inverse
                ? "text-primary-foreground group-hover:text-gold"
                : "text-foreground group-hover:text-primary"
            }`}
          >
            {schoolConfig.name.acronym}
          </span>
          <span
            className={`text-[10px] font-medium leading-tight line-clamp-1 ${
              inverse ? "text-primary-foreground/75" : "text-muted-foreground"
            }`}
          >
            {schoolConfig.name.short}
          </span>
        </div>
      )}
    </Link>
  );
}
