import React, { useState, useRef, useEffect } from "react";
import { cn } from "../src/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export default function Button({ children, className = "", onClick, ...props }: ButtonProps) {
  const [animate, setAnimate] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;

    // Synchronously reset and restart CSS animation via DOM reflow
    el.classList.remove("animate");
    void el.offsetWidth;
    el.classList.add("animate");

    setAnimate(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setAnimate(false);
    }, 600);

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "btn-bubble px-6 py-3 rounded-lg border-none text-white cursor-pointer bg-[#ff7a00] hover:bg-[#e56d00] transition-all duration-200 active:scale-95 text-xs font-bold leading-none select-none font-sans shadow-sm hover:shadow-md",
        animate && "animate",
        className,
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-[inherit] pointer-events-none">
        {children}
      </span>
    </button>
  );
}
