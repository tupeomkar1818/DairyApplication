#!/usr/bin/env bash
# Pictures: a poster goes up once, anybody may look at it, and a record keeps its address rather than the picture.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876555555}
TODAY=$(node -e 'console.log(new Date(Date.now() + 19800000).toISOString().slice(0, 10))')
TOMORROW=$(node -e 'console.log(new Date(Date.now() + 19800000 + 86400000).toISOString().slice(0, 10))')
TMP=${TMPDIR:-/tmp}

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

# A real 1x1 PNG, so the bytes that come back can be compared with the bytes that went up.
node -e 'require("fs").writeFileSync(process.argv[1], Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"))' "$TMP/amrale-poster.png"
printf 'not a picture' > "$TMP/amrale-notes.txt"

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H "Authorization: Bearer $TOKEN" "$@"; }

step "the dairy sends a poster up"
UPLOAD=$(admin -X POST "$API/media" -H 'content-type: image/png' --data-binary @"$TMP/amrale-poster.png")
echo "$UPLOAD" | show 'v.error ? JSON.stringify(v.error) : "key " + v.key + " (" + v.bytes + " bytes)"'
KEY=$(echo "$UPLOAD" | field key)
URL=$(echo "$UPLOAD" | field url)
[ -n "$KEY" ] || { echo "nothing was uploaded — is the MEDIA bucket bound? (see wrangler.jsonc)"; exit 1; }

step "anybody may look at it — a picture cannot carry a sign-in"
curl -s -o "$TMP/amrale-poster-back.png" -D "$TMP/amrale-head.txt" "$URL"
grep -iE "^(content-type|cache-control):" "$TMP/amrale-head.txt" | tr -d '\r'
node -e '
const fs = require("fs");
const a = fs.readFileSync(process.argv[1]);
const b = fs.readFileSync(process.argv[2]);
console.log("same bytes back: " + (a.equals(b) ? "yes" : "no"));' "$TMP/amrale-poster.png" "$TMP/amrale-poster-back.png"

step "something that is not a picture is refused"
admin -X POST "$API/media" -H 'content-type: text/plain' --data-binary @"$TMP/amrale-notes.txt" | problem

step "and so is sending one up without signing in"
curl -s -o /dev/null -w "no sign-in: %{http_code}\n" -X POST "$API/media" -H 'content-type: image/png' --data-binary @"$TMP/amrale-poster.png"

step "an offer keeps the poster's address"
OFFER=$(admin -H 'content-type: application/json' -X POST "$API/offers" -d "{\"kind\":\"bill\",\"title\":{\"en\":\"Poster offer\"},
  \"startYmd\":\"$TOMORROW\",\"discount\":{\"type\":\"percent\",\"value\":5},\"imageUri\":\"$URL\"}")
echo "$OFFER" | show 'v.error ? JSON.stringify(v.error) : "poster: " + (v.imageUri === process.env.URL ? "the address it was given" : v.imageUri)'
OFFER_ID=$(echo "$OFFER" | field id)

step "a picture pasted into the record itself is refused — that is what /media is for"
node -e '
const fs = require("fs");
fs.writeFileSync(process.argv[1], JSON.stringify({
  kind: "bill", title: { en: "Fat offer" }, startYmd: process.argv[2],
  discount: { type: "percent", value: 5 },
  imageUri: "data:image/png;base64," + "A".repeat(200000),
}));' "$TMP/amrale-fat-offer.json" "$TOMORROW"
admin -H 'content-type: application/json' -X POST "$API/offers" -d @"$TMP/amrale-fat-offer.json" | problem

step "a customer cannot take a picture down"
CUST_ID=$(admin -H 'content-type: application/json' -X POST "$API/customers" -d "{\"name\":\"Rina Shah\",\"mobile\":\"$MOBILE\",
  \"address\":\"C-3\",\"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\"}" | field id)
CUST_TOKEN=$(sign_in "$MOBILE") || exit 1
curl -s -o /dev/null -w "customer delete: %{http_code}\n" -H "Authorization: Bearer $CUST_TOKEN" -X DELETE "$API/media/$KEY"

step "the dairy can"
admin -o /dev/null -w "dairy delete: %{http_code}, " -X DELETE "$API/media/$KEY"
curl -s -o /dev/null -w "and then it is gone: %{http_code}\n" "$URL"

step "tidy up"
admin -o /dev/null -w "offer %{http_code}, " -X DELETE "$API/offers/$OFFER_ID"
admin -o /dev/null -w "customer %{http_code}\n" -X DELETE "$API/customers/$CUST_ID"
rm -f "$TMP/amrale-poster.png" "$TMP/amrale-poster-back.png" "$TMP/amrale-notes.txt" "$TMP/amrale-head.txt" "$TMP/amrale-fat-offer.json"
