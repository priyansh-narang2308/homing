import logoImg from "@/assets/logo.png";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src={logoImg}
      alt="Homing logo"
      className={cn("size-7 object-contain", className)}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-[-0.02em] text-cf-fg-strong">
        Homing
      </span>
    </span>
  );
}
