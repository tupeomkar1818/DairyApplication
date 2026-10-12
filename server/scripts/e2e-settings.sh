#!/usr/bin/env bash
# The dairy's own settings: the cover picture every app shows, and how customers pay. The dairy sets them once;
# every phone reads the same thing.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876566666}

anon() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }
problem() { show 'v.error ? v.error.code : "ACCEPTED (should not be)"'; }
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

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "a dairy that has set nothing yet"
admin "$API/settings" | show 'JSON.stringify(v)'
echo "(the apps then show the cover they ship with, and no way to pay in the app)"

step "the dairy adds its UPI details"
admin -X PUT "$API/settings/payment" -d '{"upiId":"amraledairy@okhdfcbank","payeeName":"Amrale Dairy","acceptCash":true,
  "instructions":"Please add your flat number in the UPI note."}' \
  | show 'JSON.stringify({upi: v.upiId, payee: v.payeeName, cash: v.acceptCash, saved: !!v.updatedAt})'

step "a UPI id that is not one is refused"
admin -X PUT "$API/settings/payment" -d '{"upiId":"not a upi id","payeeName":"Amrale Dairy","acceptCash":true}' | problem

step "so is a UPI id with nobody to pay"
admin -X PUT "$API/settings/payment" -d '{"upiId":"amraledairy@okhdfcbank","payeeName":"","acceptCash":true}' | problem

step "and so is leaving customers no way to pay at all"
admin -X PUT "$API/settings/payment" -d '{"upiId":"","payeeName":"","acceptCash":false}' | problem

step "the cover picture is kept as an address, not as a picture"
admin -X PUT "$API/settings/cover" -d '{"uri":"https://amrale-dairy-api.example.workers.dev/media/2026/10/cover.jpg","aspectRatio":2.4}' \
  | show '"cover: " + v.uri + " (" + v.aspectRatio + ")"'
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ uri: "data:image/png;base64," + "A".repeat(200000), aspectRatio: 2.4 }))' "${TMPDIR:-/tmp}/amrale-cover.json"
admin -X PUT "$API/settings/cover" -d @"${TMPDIR:-/tmp}/amrale-cover.json" | problem

step "a customer reads what the dairy set — this is how the app knows it can offer UPI"
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Nita Rao\",\"mobile\":\"$MOBILE\",\"address\":\"D-4\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\"}" | field id)
CUST_TOKEN=$(sign_in "$MOBILE") || exit 1
cust() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $CUST_TOKEN" "$@"; }
cust "$API/settings" | show 'JSON.stringify({upi: v.payment.upiId, payee: v.payment.payeeName, note: v.payment.instructions, cover: !!v.cover})'

step "but cannot change them"
cust -X PUT "$API/settings/payment" -d '{"upiId":"theirs@okaxis","payeeName":"Somebody Else","acceptCash":true}' | problem

step "and nobody reads them without signing in"
anon -o /dev/null -w "no sign-in: %{http_code}\n" "$API/settings"

step "there is no such setting as anything else"
admin -X PUT "$API/settings/faq" -d '{"items":[]}' | problem
echo "(the FAQ, the contact details and the privacy policy are app content, in both languages — see the README)"

step "tidy up"
admin -o /dev/null -w "customer %{http_code}\n" -X DELETE "$API/customers/$CUST_ID"
rm -f "${TMPDIR:-/tmp}/amrale-cover.json"
echo "(the dairy's settings stay: they are the dairy's)"
