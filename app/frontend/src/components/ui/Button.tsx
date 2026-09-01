import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Primary pill button for the marketplace. */
export function Button({ className = "", ...props }: ButtonProps) {
  return (
    <button
      className={
        "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-button bg-black px-5 py-3 " +
        "text-label font-medium text-white soft-edge " +
        "transition-[background,transform] hover:-translate-y-0.5 hover:bg-graphite " +
        className
      }
      {...props}
    />
  );
}
