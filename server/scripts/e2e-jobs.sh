#!/usr/bin/env bash
# The dairy's day, run by the clock: the 6 pm reminders and the offers starting today. `wrangler dev` exposes the
# scheduled handler at /__scheduled, so a run can be asked for instead of waited for.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876533333}
QUIET_MOBILE=${QUIET_MOBILE:-9876533344}
TODAY=$(node -e 'console.log(new Date(Date.now() + 19800000).toISOString().slice(0, 10))')
TOMORROW=$(node -e 'console.log(new Date(Date.now() + 19800000 + 86400000).toISOString().slice(0, 10))')

anon() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
# Windows' curl mangles non-ASCII in a -d argument, so any Marathi wording is sent from a file.
export BODY=${TMPDIR:-/tmp}/amrale-job-body.json
body() { cat > "$BODY"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }
sign_in() {
  local otp="" tries=0 answer
  until [ -n "$otp" ]; do
    answer=$(anon -X POST "$API/auth/otp/request" -d "{\"mobileNumber\":\"$1\"}")
    otp=$(echo "$answer" | field demoOtp)
    if [ -z "$otp" ]; then
      tries=$((tries + 1))
      [ "$tries" -gt 8 ] && { echo "could not get a code for $1: $answer" >&2; return 1; }
      sleep 9
    fi
  done
  anon -X POST "$API/auth/otp/verify" -d "{\"mobileNumber\":\"$1\",\"otp\":\"$otp\"}" | field session.sessionId
}
find_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(x=>(x.mobile||x.mobileNumber)===process.argv[1]);console.log(m?m.id:"")})' "$1"; }
# `wrangler dev` runs the scheduled handler on request; on the live Worker, Cloudflare's clock does.
run_cron() { curl -s -o /dev/null -w "%{http_code}" "$API/cdn-cgi/local/scheduled?cron=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1")"; }

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "clearing anything an earlier run left behind"
for mobile in "$MOBILE" "$QUIET_MOBILE"; do
  OLD=$(admin "$API/customers" | find_id "$mobile")
  [ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/customers/$OLD"
done
OLD=$(admin "$API/offers" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=(JSON.parse(s).items||[]).find(o=>o.title.en==="Morning price drop");console.log(m?m.id:"")})')
[ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/offers/$OLD"
echo "cleared"

step "one customer with milk every day, and one with nothing coming"
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Meera Joshi\",\"mobile\":\"$MOBILE\",\"address\":\"A-11\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",\"routeName\":\"Kothrud A\",
  \"subscriptionPlans\":[{\"productName\":\"Cow Milk\",\"quantityLabel\":\"500 ml\",\"numberOfItems\":2,
    \"frequency\":\"Daily\",\"deliveryTime\":\"Morning\",\"startDate\":\"$TODAY\",\"openEnded\":true,
    \"status\":\"Active\",\"originalPrice\":30,\"effectiveFinalPrice\":30}]}" | field id)
QUIET_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Sunil Kale\",\"mobile\":\"$QUIET_MOBILE\",\"address\":\"A-12\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",\"routeName\":\"Kothrud B\"}" | field id)
echo "customer $CUST_ID, and $QUIET_ID with no subscription"

step "6 pm: the reminders go out"
echo "cron answered $(run_cron '30 12 * * *')"

step "what the customer was asked"
CUST_TOKEN=$(sign_in "$MOBILE") || exit 1
cust() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $CUST_TOKEN" "$@"; }
cust "$API/notifications" | show 'JSON.stringify(v.items.filter(n => n.type === "OrderReminder").map(n => ({title: n.title, body: n.body, marathi: !!n.translations?.mr, day: n.dateYmd})), null, 1)'

step "the dairy's line for the evening"
admin "$API/notifications" | show 'JSON.stringify(v.items.filter(n => n.type === "OrderReminder").map(n => n.title + " — " + n.body))'

step "the customer with nothing coming was not woken up"
QUIET_TOKEN=$(sign_in "$QUIET_MOBILE") || exit 1
curl -s -H "Authorization: Bearer $QUIET_TOKEN" "$API/notifications" | show '"their inbox: " + v.items.length + " row(s)"'

step "running it again sends nothing twice"
run_cron '30 12 * * *' > /dev/null
cust "$API/notifications" | show '"reminders in their inbox: " + v.items.filter(n => n.type === "OrderReminder").length'

step "the customer answers: keep it as it is"
REMINDER_ID=$(cust "$API/notifications" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=(JSON.parse(s).items||[]).find(n=>n.type==="OrderReminder");console.log(m?m.id:"")})')
cust -X POST "$API/notifications/$REMINDER_ID/response" -d '{"response":"keep"}' | show '"answer: " + v.response + ", read: " + !!v.readAt'

step "and the dairy sees the tally"
admin "$API/notifications" | show 'JSON.stringify(v.items.filter(n => n.subjectKey && n.subjectKey.startsWith("reminder-answers")).map(n => n.body))'

step "an offer that starts today"
body <<JSON
{ "kind": "price", "title": { "en": "Morning price drop", "mr": "सकाळची सूट" },
  "startYmd": "$TODAY", "endYmd": "$TOMORROW",
  "priceItems": [{ "productId": "p1", "packId": "k1", "productName": "Shrikhand", "packLabel": "500 g",
    "listPrice": 180, "offerPrice": 160 }] }
JSON
admin -X POST "$API/offers" -d @"$BODY" | show '"offer: " + v.title.en'

step "midnight: the customers are told about it"
echo "cron answered $(run_cron '30 18 * * *')"
cust "$API/notifications" | show 'JSON.stringify(v.items.filter(n => n.type === "Offer").map(n => ({title: n.title, body: n.body, marathiNamesTheOffer: (n.translations?.mr?.body ?? "").includes(JSON.parse(require("fs").readFileSync(process.env.BODY, "utf8")).title.mr)})), null, 1)'

step "running that again tells nobody twice"
run_cron '30 18 * * *' > /dev/null
cust "$API/notifications" | show '"offer notifications: " + v.items.filter(n => n.type === "Offer").length'

step "a phone registers for push, and forgets it again"
cust -X POST "$API/push/tokens" -d '{"token":"ExponentPushToken[e2e-test-token]","platform":"android","language":"mr"}' | show 'JSON.stringify(v)'
cust -o /dev/null -w "forget %{http_code}\n" -X DELETE "$API/push/tokens/ExponentPushToken%5Be2e-test-token%5D"

step "tidy up"
admin -o /dev/null -w "customer %{http_code}, " -X DELETE "$API/customers/$CUST_ID"
admin -o /dev/null -w "quiet customer %{http_code}\n" -X DELETE "$API/customers/$QUIET_ID"
echo "(the offer and the notifications stay: they are the day's record)"
