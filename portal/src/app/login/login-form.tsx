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

      <span className="text-center text-[13px] text-muted">Quên mật khẩu? Liên hệ Ban quản lý để được cấp lại.</span>
    </form>
  );
}
