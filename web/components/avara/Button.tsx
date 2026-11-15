"use client";

// Avara UI Button (avaraui.com/docs/nextjs/button), trimmed to the two variants
// Pagelyt uses: "slide-icon" for primary calls to action and "outline" for
// secondary ones. Pass `href` to render a next/link with the same look.

import { cn } from "@/lib/utils";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const Loader2: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("animate-spin", className)}
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const ArrowRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export type ButtonVariant = "outline" | "slide-icon";
export type ButtonSize = "default" | "sm" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /** Outline only: add a trailing arrow. */
  showArrow?: boolean;
  /** Render a next/link instead of a <button>. */
  href?: string;
  /** slide-icon only: "solid" rests filled with the brand colour (main calls to action); "plain" rests white. */
  tone?: "plain" | "solid";
}

interface Ripple {
  x: number;
  y: number;
  size: number;
  id: number;
}

const RIPPLE_CSS = `@keyframes ripple-effect{from{transform:scale(0);opacity:1}to{transform:scale(2);opacity:0}}.animate-ripple{animation:ripple-effect .7s ease-out forwards}@media (prefers-reduced-motion:reduce){.animate-ripple{animation:none;opacity:0}}`;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "outline",
      size = "default",
      children,
      loading,
      onClick,
      iconLeft,
      iconRight,
      showArrow,
      href,
      tone = "plain",
      disabled,
      type,
      ...props
    },
    ref,
  ) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const iconOnly = !children && Boolean(iconLeft || iconRight);

    useEffect(() => {
      const styleId = "ripple-animation-style";
      if (document.getElementById(styleId)) return;
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = RIPPLE_CSS;
      document.head.appendChild(style);
    }, []);

    const createRipple = (event: React.MouseEvent<HTMLElement>) => {
      if (loading) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const s = Math.max(rect.width, rect.height);
      setRipples((r) => [
        ...r,
        { x: event.clientX - rect.left - s / 2, y: event.clientY - rect.top - s / 2, size: s, id: Date.now() },
      ]);
      setTimeout(() => setRipples((r) => r.slice(1)), 700);
      onClick?.(event as React.MouseEvent<HTMLButtonElement>);
    };

    const base =
      "relative inline-flex items-center justify-center rounded-xl text-sm font-semibold no-underline transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:pointer-events-none active:scale-[0.97] cursor-pointer group bg-background text-foreground border border-border shadow-xs overflow-hidden";

    const sizeClasses: Record<ButtonSize, string> = {
      default: iconOnly ? "h-12 w-12 p-0" : "h-12 py-2.5 px-6",
      sm: iconOnly ? "h-10 w-10 p-0" : "h-10 px-4 rounded-lg text-xs",
      lg: iconOnly ? "h-14 w-14 p-0" : "h-14 px-8 rounded-xl text-base",
    };

    const rippleLayer = !loading && (
      <span aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[inherit]">
        {ripples.map((r) => (
          <span
            key={r.id}
            className="absolute rounded-full animate-ripple bg-primary-foreground/25"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          />
        ))}
      </span>
    );

    let classes: string;
    let inner: React.ReactNode;

    if (variant === "slide-icon") {
      const icon = iconRight || iconLeft || <ArrowRightIcon className="h-4 w-4" />;
      classes = cn(
        base,
        tone === "solid"
          ? "bg-primary text-primary-foreground border-primary shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary)_82%,black)] hover:border-[color-mix(in_oklab,var(--primary)_82%,black)]"
          : "hover:bg-primary hover:text-primary-foreground hover:border-primary",
        sizeClasses[size],
        "z-10 w-max pl-4 pr-3.5 gap-3",
        className,
      );
      inner = (
        <>
          {/* Sliding left icon on hover */}
          <span
            aria-hidden="true"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center h-7 w-7 rounded-full bg-primary-foreground text-primary shadow-xs -translate-x-10 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 transition-all duration-300 ease-out z-20 motion-reduce:transition-none"
          >
            {icon}
          </span>
          <span className="relative z-10 font-semibold transition-transform duration-300 ease-out group-hover:translate-x-[36px] group-focus-visible:translate-x-[36px] motion-reduce:transition-none">
            {children}
          </span>
          {/* Resting right icon, slides out on hover */}
          <span
            aria-hidden="true"
            className="relative z-10 flex items-center justify-center h-7 w-7 rounded-full bg-muted text-primary group-hover:translate-x-10 group-hover:opacity-0 group-focus-visible:translate-x-10 group-focus-visible:opacity-0 transition-all duration-300 ease-out motion-reduce:transition-none"
          >
            {loading ? <Loader2 className="h-4 w-4" /> : icon}
          </span>
          {rippleLayer}
        </>
      );
    } else {
      classes = cn(base, "hover:bg-muted hover:border-primary/40", sizeClasses[size], "gap-2", className);
      inner = (
        <>
          <span className="relative z-10 inline-flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4" />}
            {!loading && iconLeft && <span className="inline-flex items-center">{iconLeft}</span>}
            {children}
            {!loading && (iconRight || showArrow) && (
              <span className="inline-flex items-center transition-transform duration-200 group-hover:translate-x-1">
                {iconRight ?? <ArrowRightIcon className="h-4 w-4" />}
              </span>
            )}
          </span>
          {rippleLayer}
        </>
      );
    }

    if (href) {
      const { title, id, style, tabIndex } = props;
      return (
        <Link
          href={href}
          className={classes}
          onClick={createRipple}
          aria-label={props["aria-label"]}
          aria-disabled={disabled || loading || undefined}
          title={title}
          id={id}
          style={style}
          tabIndex={tabIndex}
        >
          {inner}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={classes}
        onClick={createRipple}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {inner}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
