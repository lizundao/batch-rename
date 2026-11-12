import { useState } from "react";
import { WEBSITE_LOGO_FALLBACK, WEBSITE_LOGO_SRC } from "../constants/brand";

interface InkdotBrandLogoProps {
  size?: number;
  className?: string;
}

/** 网站 LOGO（inkdot.png），用于关于页「墨点」前展示 */
export function InkdotBrandLogo({ size = 40, className }: InkdotBrandLogoProps) {
  const [src, setSrc] = useState(WEBSITE_LOGO_SRC);

  return (
    <img
      className={className ?? "inkdot-brand-logo"}
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => {
        if (src !== WEBSITE_LOGO_FALLBACK) setSrc(WEBSITE_LOGO_FALLBACK);
      }}
    />
  );
}
