import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { IconBell } from "./icons";

/** Gradient header of every dashboard (Resident/Reception/Management/Cleaning/Technical .dc.html <header>) */
export function Header(props: {
  avatar: string;
  name: string;
  rolePill: string;
  bellLabel: string;
  bellCount: number;
  onBell?: () => void;
}) {
  return (
    <header style={{ background: "linear-gradient(120deg, #9CCBFF 0%, #5E9BFF 100%)", padding: "32px 24px 112px" }}>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-[18px]">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white text-2xl font-bold text-brand">
            {props.avatar}
          </div>
          <div className="flex flex-col">
            <span className="text-lg text-hello">Xin chào,</span>
            <span className="text-[32px] font-bold tracking-[-0.01em] text-ink-strong">{props.name}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="pill" style={{ background: "rgba(255,255,255,0.88)", color: "#13203A", fontSize: 13, padding: "8px 14px" }}>
            {props.rolePill}
          </span>
          <button type="button" className="bell" aria-label={props.bellLabel} onClick={props.onBell}>
            <IconBell />
            <span className="b">{props.bellCount}</span>
          </button>
          <form action={logout}>
            <button type="submit" className="hdr-btn">
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export type NavItem<K extends string> = { key: K; label: string; icon: ReactNode; count?: number };

/** White function menu overlapping the header (nav.card + .tile) */
export function NavTiles<K extends string>(props: { label: string; items: NavItem<K>[]; active: K; onPick: (k: K) => void }) {
  return (
    <nav
      className="card grid gap-2 p-5"
      aria-label={props.label}
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
    >
      {props.items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={it.key === props.active ? "tile on" : "tile"}
          aria-current={it.key === props.active ? "page" : undefined}
          onClick={() => props.onPick(it.key)}
        >
          <span className="ic">{it.icon}</span>
          {it.label}
          {it.count ? <span className="cnt">{it.count}</span> : null}
        </button>
      ))}
    </nav>
  );
}

export function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="mt-2 mb-0 text-[28px] font-bold tracking-[-0.01em]">{title}</h1>
      <p className="m-0 text-[15px] text-muted">{sub}</p>
    </div>
  );
}

/** Content column under the header: max 1200px, pulled up 80px over the gradient */
export function Body({ children }: { children: ReactNode }) {
  return <div className="mx-auto -mt-20 flex max-w-[1200px] flex-col gap-6 px-6 pb-16">{children}</div>;
}

/** Static shell shown while the session and data stream in (cacheComponents) */
export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-page" aria-busy="true">
      <header style={{ background: "linear-gradient(120deg, #9CCBFF 0%, #5E9BFF 100%)", padding: "32px 24px 112px" }}>
        <div className="mx-auto flex max-w-[1200px] items-center gap-[18px]">
          <div className="h-[72px] w-[72px] rounded-full bg-white/70" />
          <div className="flex flex-col gap-2">
            <span className="text-lg text-hello">Xin chào,</span>
            <span className="h-8 w-56 rounded-lg bg-white/50" />
          </div>
        </div>
      </header>
      <Body>
        <div className="card h-[148px]" />
        <div className="card h-64" />
      </Body>
    </div>
  );
}
