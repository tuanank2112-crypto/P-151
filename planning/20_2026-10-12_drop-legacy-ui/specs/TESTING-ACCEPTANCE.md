# TESTING & ACCEPTANCE

## §1 Ma trận
| Phần | Test |
|---|---|
| 01 §1 | pytest: `/` ⇒ `/app/` khi không PORTAL_URL; `/ui/` 404; portal tắt ⇒ `/` 503 |
| 01 §2 | `grep -rn "/ui" src/mobile` rỗng; `test_mobile_static` xanh |
| 01 §3 | `git grep -n "drizzle\|from \"pg\"\|DATABASE_URL" -- portal ':!portal/package-lock.json'` rỗng; typecheck/lint/vitest/build xanh |
| Postgres | `pytest --pg` xanh trên `p151_test`; backend khởi động `MO_STORE=postgres` trên `p151` |

## §2 Exit gates
| Gate | local | server |
|---|---|---|
| G1 pytest (memory) + ruff | ✅ 3599 passed / 100 pg deselected; ruff sạch; 2 phép phá `src/main.py` đỏ → khôi phục xanh | ⬜ |
| G2 `pytest --pg` | ✅ 100 passed (`p151_test` local) | ⬜ |
| G3 portal typecheck + lint + vitest + build | ✅ vitest 135 (−8 = `agent.test.ts` đã xoá cùng mã chết); build ok | ⬜ |
| G4 Backend `MO_STORE=postgres` + portal: đăng nhập, tạo ticket, ticket nằm trong DB (`select count(*) from maintops.tickets` tăng) | ✅ 12 → 13, `evidence/g4-postgres-local.txt` + 2 ảnh | ⬜ |
| G5 Người dùng thử tay | ⬜ | ⬜ |
