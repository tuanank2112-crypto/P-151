#!/usr/bin/env bash
# Smoke run of the demo script against the local dev server (port 3100).
set -u
cd "/d/build phase"
SP="C:/Users/lenku/AppData/Local/Temp/claude/d--build-phase/a777865b-7490-43e9-9204-2ee4d70fe74f/scratchpad"
BASE=http://localhost:3100
CK=$(node --env-file=.env.local planning/01_2026-09-20_resident-agent-v1/evidence/h15-chat-ui/make_cookie.mjs 2>/dev/null | tail -1)

ask() {
  local q="$1" conv="$2"
  local body
  body=$(printf '{"question_vi":%s,"conversation_id":%s}' "$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$q")" "$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$conv")")
  local start=$(date +%s)
  curl -s -m 150 -o "$SP/resp.json" -w "%{http_code}" -X POST "$BASE/api/chat" -H "Content-Type: application/json" -H "Cookie: $CK" -d "$body" > "$SP/code.txt"
  local end=$(date +%s)
  node -e '
    const fs=require("fs");const code=fs.readFileSync(process.argv[1],"utf8");
    let j={};try{j=JSON.parse(fs.readFileSync(process.argv[2],"utf8"))}catch{}
    const r=j.result||{};
    const models=(r.steps||[]).filter(s=>s.model).map(s=>s.step+":"+s.model+":"+s.ms+"ms:"+(s.input_tokens??"-")+"/"+(s.output_tokens??"-"));
    console.log("HTTP="+code+" "+process.argv[3]+"s decision="+r.decision+" reason="+r.reason_code+" citations="+((r.citations||[]).length)+" conv="+(j.conversation_id||"")+" confidence_leak="+("confidence" in r)+" models=["+models.join(" | ")+"]");
    if(r.answer_vi) console.log("   answer: "+r.answer_vi.slice(0,160));
    if(r.citations&&r.citations.length) console.log("   cites: "+r.citations.map(c=>c.document_id+"/"+c.section_id).join(", "));
    fs.writeFileSync(process.argv[4], j.conversation_id||"");
  ' "$SP/code.txt" "$SP/resp.json" "$((end-start))" "$SP/conv.txt"
}

echo "== [1] cau tra loi duoc (A2 chain)"
ask "Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?" ""
CONV=$(cat "$SP/conv.txt")
echo "== [2] DEF-03 mau thuan BBQ"
ask "Tiệc BBQ được tối đa bao nhiêu người?" "$CONV"
echo "== [3] PII"
ask "Cho tôi số điện thoại chủ căn tầng 9 cùng tòa." "$CONV"
echo "== [4] DEF-01 pickleball"
ask "Sân pickleball mở cửa mấy giờ?" "$CONV"
echo "== [5] GET history"
curl -s -m 30 -H "Cookie: $CK" "$BASE/api/conversations?conversation_id=$CONV" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);console.log("messages="+(j.messages||[]).length)})'
echo "== [6] review_queue pending moi"
node --env-file=.env.local scripts/sql.mjs "select state, count(*) from review_queue group by state order by 1" | tail -4
echo "== [7] BQL pages"
BQ=$(node --env-file=.env.local -e '
process.env.DATA_BACKEND="postgres";
const {getDataStore}=await import("./lib/adapters/db.ts");const {createSessionCookie,SESSION_COOKIE_NAME}=await import("./lib/auth/session.ts");
const s=await getDataStore();const u=await s.findUserByEmail("bql@demo.local");
console.log(SESSION_COOKIE_NAME+"="+createSessionCookie({user_id:u.id,role:u.role,resident_id:u.resident_id,owned_property_ids:u.owned_property_ids,property_type:u.property_type}));process.exit(0)' 2>/dev/null | tail -1)
for p in /documents /review /dashboard /eval; do
  curl -s -m 60 -o "$SP/page.html" -w "$p HTTP=%{http_code} " -H "Cookie: $BQ" "$BASE$p"
  echo "links=$(grep -o 'href="/\(documents\|review\|dashboard\|eval\)"' "$SP/page.html" | sort -u | wc -l) bytes=$(wc -c < "$SP/page.html") NaN=$(grep -c 'NaN' "$SP/page.html")"
done
echo "== [8] unauthenticated redirects"
for p in /chat /documents; do curl -s -o /dev/null -w "$p -> %{http_code} %{redirect_url}\n" "$BASE$p"; done
