"use client";

import { useEffect, useState } from "react";

export interface ScrollProgressBarProps {
  colorClassName?: string;
  heightPx?: number;
}

export function ScrollProgressBar({
  colorClassName = "bg-[var(--color-primary)]",
  heightPx = 3,
}: ScrollProgressBarProps) {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (windowHeight === 0) return;
      const scroll = `${(totalScroll / windowHeight) * 100}%`;
      setScrollProgress(Math.min(100, Math.max(0, (totalScroll / windowHeight) * 100)));
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="페이지 읽기 진행도"
      aria-valuenow={Math.round(scrollProgress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 right-0 left-0 z-50 overflow-hidden bg-transparent pointer-events-none"
      style={{ height: `${heightPx}px` }}
    >
      <div
        className={`h-full transition-[width] duration-150 ease-out ${colorClassName}`}
        style={{ width: `${scrollProgress}%` }}
      />
    </div>
  );
}
