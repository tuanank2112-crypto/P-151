"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: "", username: "" });
  const [show, setShow] = useState(false);
  const [dirty, setDirty] = useState(false);
  const err = state.error && !dirty;
  const fieldCls = err ? "field err" : "field";

  return (
    <form
      action={(fd) => {
        setDirty(false);
        action(fd);
      }}
      className="flex w-full max-w-[460px] flex-col gap-5 self-start rounded-3xl bg-white p-9"
      style={{ boxShadow: "0 8px 30px rgba(15,30,60,0.10)" }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-base text-muted">Xin chào,</span>
        <h1 className="m-0 text-[30px] font-bold tracking-[-0.01em]">Đăng nhập</h1>
        <span className="text-sm text-muted">Hệ thống tự đưa bạn đến dashboard theo vai trò của tài khoản.</span>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="user" className="text-sm font-semibold">
          Tên đăng nhập
        </label>
        <input
          id="user"
          name="username"
          className={fieldCls}
          type="text"
          autoComplete="username"
          placeholder="Nhập tên đăng nhập"
          defaultValue={state.username}
          aria-invalid={err ? true : undefined}
          onChange={() => setDirty(true)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pass" className="text-sm font-semibold">
          Mật khẩu
        </label>
        <div className="relative">
          <input
            id="pass"
            name="password"
            className={fieldCls}
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            aria-invalid={err ? true : undefined}
            onChange={() => setDirty(true)}
            style={{ paddingRight: 64 }}
          />
          <button type="button" className="eye" aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShow(!show)}>
            {show ? "Ẩn" : "Hiện"}
          </button>
        </div>
      </div>
      {err ? (
        <div role="alert" className="rounded-[14px] px-4 py-3 text-sm" style={{ background: "#FDE2DF", color: "#8A1C12" }}>
          {state.error}
        </div>
      ) : null}
      <button type="submit" className="submit" disabled={pending}>
        Đăng nhập
      </button>

      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 text-xs text-muted">
        <span className="font-semibold text-slate-600">Tài khoản demo nghiệm thu (mật khẩu: 123456):</span>
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "Cư dân", u: "cudan" },
            { label: "Tiếp nhận", u: "tiepnhan" },
            { label: "Ban quản lý", u: "quanly" },
            { label: "Kỹ thuật", u: "kythuat" },
            { label: "Vệ sinh", u: "vesinh" },
            { label: "Thủ kho", u: "kho" },
          ].map((acc) => (
            <button
              key={acc.u}
              type="button"
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
              onClick={() => {
                const userInput = document.getElementById("user") as HTMLInputElement;
                const passInput = document.getElementById("pass") as HTMLInputElement;
                if (userInput) userInput.value = acc.u;
                if (passInput) passInput.value = "123456";
                setDirty(true);
              }}
            >
              {acc.label} ({acc.u})
            </button>
          ))}
        </div>
      </div>

      <span className="text-center text-[13px] text-muted">Quên mật khẩu? Liên hệ Ban quản lý để được cấp lại.</span>
    </form>
  );
}
