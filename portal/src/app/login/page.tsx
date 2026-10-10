import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { IconHouse } from "@/components/icons";
import { ROLE_HOME, SITE_NAME } from "@/lib/constants";
import { getSessionUser } from "@/server/session";
import { backendFetch } from "@/server/backend-client";
import type { DemoAccounts } from "@/server/backend-dto";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập · Cổng phản ánh cư dân" };

async function RedirectIfSignedIn(): Promise<null> {
  const user = await getSessionUser();
  if (user) redirect(ROLE_HOME[user.role]);
  return null;
}

async function BackendLoginForm() {
  const demo = await backendFetch<DemoAccounts>("/api/v1/auth/demo-accounts").catch(() => null);
  return <LoginForm demo={demo} />;
}

/** Main.dc.html */
export default function LoginPage() {
  return (
    <div className="scr-login flex min-h-screen flex-col bg-page">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <div style={{ background: "linear-gradient(120deg, #9CCBFF 0%, #5E9BFF 100%)", padding: "40px 24px 160px" }}>
        <div className="mx-auto flex max-w-[1200px] items-center gap-3.5">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white text-brand">
            <IconHouse />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-ink">Cổng phản ánh cư dân</span>
            <span className="text-sm text-hello">{SITE_NAME}</span>
          </div>
        </div>
      </div>
      <div className="-mt-[120px] flex flex-1 justify-center px-6 pb-16">
        <Suspense fallback={<div className="card w-full max-w-[460px] p-9" role="status">Đang tải đăng nhập…</div>}><BackendLoginForm /></Suspense>
      </div>
    </div>
  );
}
