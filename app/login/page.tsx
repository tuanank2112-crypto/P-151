import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main>
      <h1>Đăng nhập — Resident Agent</h1>
      {params.error ? (
        <p role="alert" style={{ color: "#b3261e" }}>
          Sai email hoặc mật khẩu.
        </p>
      ) : null}
      <form action={loginAction}>
        <div>
          <label htmlFor="email">Email</label>
          <br />
          <input id="email" name="email" type="email" required autoComplete="username" />
        </div>
        <div>
          <label htmlFor="password">Mật khẩu</label>
          <br />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <button type="submit">Đăng nhập</button>
      </form>
    </main>
  );
}
