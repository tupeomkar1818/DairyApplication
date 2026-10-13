#!/usr/bin/env bash
# Offers: the dairy starts one for everybody and one behind a code, the website is given only the public one, a
# customer types the code to unlock theirs — and an offer that has started can only be ended, never re-priced.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
CUST_MOBILE=${CUST_MOBILE:-9876500066}
TODAY=$(date +%F)
NEXT_MONTH=$(node -e 'const d=new Date();d.setMonth(d.getMonth()+1);console.log(d.toISOString().slice(0,10))')

j() { curl -s -H 'content-type: application/json' "$@"; }
# Windows' curl mangles non-ASCII in a -d argument, so any Marathi wording is sent from a file.
export BODY=${TMPDIR:-/tmp}/amrale-offer-body.json
body() { cat > "$BODY"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
show() { node -e 'const sent=()=>JSON.parse(require("fs").readFileSync(process.env.BODY,"utf8"));let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }
sign_in() {
  # Signing in the way the apps do: the number and the PIN. The first time for anybody, their own number is the
  # password and the PIN is chosen on the spot. No codes, so these never queue behind the one-minute cooldown.
  _res=$(j -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$1\",\"secret\":\"${E2E_PIN:-4321}\"}")
  _tok=$(echo "$_res" | field session.sessionId)
  if [ -z "$_tok" ]; then
    _res=$(j -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$1\",\"secret\":\"$1\"}")
    _tok=$(echo "$_res" | field session.sessionId)
    [ -n "$_tok" ] || { echo "could not sign $1 in: $_res" >&2; return 1; }
    curl -s -o /dev/null -H 'content-type: application/json' -H "Authorization: Bearer $_tok" \
      -X POST "$API/auth/pin" -d "{\"pin\":\"${E2E_PIN:-4321}\"}"
  fi
  echo "$_tok"
}
find_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(x=>(x.mobile||x.mobileNumber)===process.argv[1]);console.log(m?m.id:"")})' "$1"; }
offer_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(o=>o.title.en===process.argv[1]);console.log(m?m.id:"")})' "$1"; }

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "clearing anything an earlier run left behind"
OLD=$(admin "$API/customers" | find_id "$CUST_MOBILE")
[ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/customers/$OLD"
for title in "Winter price drop" "Festival box" "Ten percent off the bill" "Offer nobody started"; do
  OLD=$(admin "$API/offers" | offer_id "$title")
  [ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/offers/$OLD"
done
echo "cleared"

step "a price offer for everybody, from today"
body <<JSON
{ "kind": "price", "title": { "en": "Winter price drop", "mr": "हिवाळी सूट" },
  "description": { "en": "Shrikhand at a lower price" }, "startYmd": "$TODAY", "endYmd": "$NEXT_MONTH",
  "includeRegular": true,
  "priceItems": [{ "productId": "prod_shri", "packId": "pack_500", "productName": "Shrikhand",
    "packLabel": "500 g", "listPrice": 180, "offerPrice": 160 }] }
JSON
PRICE_ID=$(admin -X POST "$API/offers" -d @"$BODY" | field id)
echo "price offer: $PRICE_ID"

step "a combo behind a code, starting next month"
COMBO=$(admin -X POST "$API/offers" -d "{
  \"kind\":\"combo\",\"title\":{\"en\":\"Festival box\"},\"startYmd\":\"$NEXT_MONTH\",\"code\":\" diwali 50 \",
  \"comboPrice\":499,
  \"comboItems\":[{\"productId\":\"p1\",\"packId\":\"k1\",\"productName\":\"Shrikhand\",\"packLabel\":\"500 g\",\"quantity\":2,\"listPrice\":180},
    {\"productId\":\"p2\",\"packId\":\"k2\",\"productName\":\"Ghee\",\"packLabel\":\"200 ml\",\"quantity\":1,\"listPrice\":240}]}")
COMBO_ID=$(echo "$COMBO" | field id)
echo "$COMBO" | show '"combo: " + v.id + ", code stored as " + v.code'

step "the same code twice is refused"
admin -X POST "$API/offers" -d "{\"kind\":\"bill\",\"title\":{\"en\":\"Ten percent off the bill\"},\"startYmd\":\"$NEXT_MONTH\",
  \"code\":\"DIWALI50\",\"discount\":{\"type\":\"percent\",\"value\":10}}" | show 'v.error ? v.error.code : "ACCEPTED (should not be)"'

step "a first day in the past is refused"
admin -X POST "$API/offers" -d '{"kind":"bill","title":{"en":"Ten percent off the bill"},"startYmd":"2026-01-01",
  "discount":{"type":"percent","value":10}}' | show 'v.error ? v.error.code : "ACCEPTED (should not be)"'

step "the website is given the public offer only — the coded one is for the customers who were given the code"
j "$API/public/offers.json" | show 'JSON.stringify(v.offers.map(o => ({title: o.title.en, kind: o.kind, code: o.code ?? null})))'

step "a customer on the books"
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Asha Pawar\",\"mobile\":\"$CUST_MOBILE\",\"address\":\"B-2\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"paymentType\":\"Monthly\",\"status\":\"Active\",
  \"routeName\":\"Kothrud A\"}" | field id)
echo "customer: $CUST_ID"

step "the customer signs in and sees what needs no code"
CUST_TOKEN=$(sign_in "$CUST_MOBILE") || exit 1
cust() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $CUST_TOKEN" "$@"; }
cust "$API/offers" | show 'JSON.stringify(v.items.map(o => o.title.en))'

step "a wrong code says so"
cust -X POST "$API/offers/claim" -d '{"code":"NOPE123"}' | show 'v.error ? v.error.code : "ACCEPTED (should not be)"'

step "the code they were given unlocks the combo, spaces and case and all"
cust -X POST "$API/offers/claim" -d '{"code":"diwali 50"}' | show 'v.offer ? "unlocked: " + v.offer.title.en : JSON.stringify(v)'

step "and now it is on their list, and on their record"
cust "$API/offers" | show 'JSON.stringify(v.items.map(o => o.title.en))'
cust "$API/me/customer" | show 'JSON.stringify(v.offerClaims)'

step "typing it twice says so"
cust -X POST "$API/offers/claim" -d '{"code":"DIWALI50"}' | show 'v.error ? v.error.code : "ACCEPTED (should not be)"'

step "a customer cannot start an offer, nor end one"
cust -o /dev/null -w "create %{http_code}, " -X POST "$API/offers" -d "{\"kind\":\"bill\",\"title\":{\"en\":\"Free milk\"},\"startYmd\":\"$NEXT_MONTH\"}"
cust -o /dev/null -w "end %{http_code}\n" -X PATCH "$API/offers/$PRICE_ID" -d '{"endedAt":"2026-10-12T00:00:00.000Z"}'

step "the started offer's prices and code cannot be edited — only its wording and its last day"
body <<JSON
{ "title": { "en": "Winter price drop", "mr": "हिवाळी सूट (वाढवली)" },
  "code": "SNEAKY",
  "priceItems": [{ "productName": "Shrikhand", "packLabel": "500 g", "listPrice": 180, "offerPrice": 1 }] }
JSON
admin -X PATCH "$API/offers/$PRICE_ID" -d @"$BODY" \
  | show 'JSON.stringify({marathiKept: v.title.mr === sent().title.mr, code: v.code ?? null, offerPrice: v.priceItems[0].offerPrice})'

step "a started offer cannot be deleted"
admin -X DELETE "$API/offers/$PRICE_ID" | show 'v.error ? v.error.code : "DELETED (should not be)"'

step "one that never started can be"
SPARE_ID=$(admin -X POST "$API/offers" -d "{\"kind\":\"subscription\",\"title\":{\"en\":\"Offer nobody started\"},
  \"startYmd\":\"$NEXT_MONTH\",\"discount\":{\"type\":\"flat\",\"value\":2},\"minPacksPerDay\":2}" | field id)
admin -o /dev/null -w "delete scheduled %{http_code}\n" -X DELETE "$API/offers/$SPARE_ID"

step "the dairy ends the price offer today"
admin -X PATCH "$API/offers/$PRICE_ID" -d "{\"endedAt\":\"${TODAY}T06:00:00.000Z\",\"endYmd\":\"$TODAY\"}" | show '"ended at " + v.endedAt'

step "the website drops it at once, and so does the customer's list"
j "$API/public/offers.json" | show '"website offers: " + (v.offers.map(o => o.title.en).join(", ") || "none")'
cust "$API/offers" | show '"customer offers: " + (v.items.map(o => o.title.en).join(", ") || "none")'

step "tidy up"
admin -o /dev/null -w "customer %{http_code}, " -X DELETE "$API/customers/$CUST_ID"
admin -o /dev/null -w "coded offer %{http_code}\n" -X DELETE "$API/offers/$COMBO_ID"
echo "(the ended price offer stays: bills were worked out from it)"
