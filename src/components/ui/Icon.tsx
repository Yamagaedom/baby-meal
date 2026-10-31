import type { ReactNode, SVGProps } from "react";

export type IconName =
  "home" | "ingredients" | "book" | "logs" | "profile" | "star" | "close" | "warning" | "timer";

const paths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v12h14V9M9 21v-8h6v8" />
    </>
  ),
  ingredients: (
    <>
      <path d="M4 21c0-8 3-14 12-14h4v4c0 8-7 10-12 10H4Z" />
      <path d="m4 21 11-11M15 7V3M20 7l2-3" />
    </>
  ),
  book: (
    <>
      <path d="M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z" />
    </>
  ),
  logs: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M4 10h16M8 14h3M8 17h7" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  warning: (
    <>
      <path d="m12 3 10 18H2L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="14" r="8" />
      <path d="M12 10v4l3 2M9 2h6M12 2v4M18 7l2-2" />
    </>
  ),
};

/** 단색 선 아이콘은 조작, 경고, 모바일 내비게이션에만 사용합니다. */
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
