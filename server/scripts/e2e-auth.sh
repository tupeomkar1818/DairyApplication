#!/usr/bin/env bash
# Signs in as the dairy, then as a customer, and checks that each one may do only what it should.
# Run against a local Worker: npm run dev, then npm run e2e:auth
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
CUSTOMER_MOBILE=${CUSTOMER_MOBILE:-9876500011}

j() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
# A code can only be asked for once a minute, so a run right after another one waits for the cooldown.
code_for() {
  local otp="" tries=0
  until [ -n "$otp" ]; do
    otp=$(j -X POST "$API/auth/otp/request" -d "{\"mobileNumber\":\"$1\"}" | field demoOtp)
    if [ -z "$otp" ]; then
      tries=$((tries + 1))
      [ "$tries" -gt 8 ] && { echo "" ; return 1; }
      sleep 9
    fi
  done
  echo "$otp"
}
token_for() {
  _res=$(j -X POST "$API/auth/otp/verify" -d "{\"mobileNumber\":\"$1\",\"otp\":\"$2\"}")
  _tok=$(echo "$_res" | field session.sessionId)
  # A session can do nothing else until a PIN is chosen, so pick one — but only when there isn't one yet,
  # since answering that for a login that has one counts as a wrong try.
  if [ "$(echo "$_res" | field mustSetPin)" = "true" ]; then
    curl -s -o /dev/null -H 'content-type: application/json' -H "Authorization: Bearer $_tok" \
      -X POST "$API/auth/pin" -d "{\"pin\":\"${E2E_PIN:-4321}\"}"
  fi
  echo "$_tok"
}

step "a number the dairy does not know is refused"
j -X POST "$API/auth/otp/request" -d '{"mobileNumber":"9000000000"}'; echo

step "a malformed number is refused"
j -X POST "$API/auth/otp/request" -d '{"mobileNumber":"12345"}'; echo

step "the dairy asks for a code"
ADMIN_OTP=$(code_for "$ADMIN_MOBILE")
echo "code: $ADMIN_OTP"

step "asking again straight away is refused (one minute cooldown)"
j -X POST "$API/auth/otp/request" -d "{\"mobileNumber\":\"$ADMIN_MOBILE\"}" | head -c 200; echo

step "a wrong code is refused"
j -X POST "$API/auth/otp/verify" -d "{\"mobileNumber\":\"$ADMIN_MOBILE\",\"otp\":\"000000\"}"; echo

step "the right code signs the dairy in"
ADMIN_TOKEN=$(token_for "$ADMIN_MOBILE" "$ADMIN_OTP")
echo "token: ${ADMIN_TOKEN:0:12}…"
j -H "Authorization: Bearer $ADMIN_TOKEN" "$API/auth/me"; echo

step "the same code cannot be used twice"
j -X POST "$API/auth/otp/verify" -d "{\"mobileNumber\":\"$ADMIN_MOBILE\",\"otp\":\"$ADMIN_OTP\"}"; echo

find_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(x=>(x.mobile||x.mobileNumber)===process.argv[1]);console.log(m?m.id:"")})' "$1"; }

step "no token: the catalog is closed"
j -o /dev/null -w "status %{http_code}: " "$API/products"; j "$API/products"; echo

step "a made-up token is refused"
j -o /dev/null -w "status %{http_code}\n" -H "Authorization: Bearer not-a-real-token" "$API/products"

step "the dairy adds a product and a customer"
# Start from nothing. A customer left behind by an earlier run carries that run’s paused days with them, and a
# customer may not undo a day that has gone by — so the steps below would be refused for the right reason and
# read as the wrong one.
OLD=$(j -H "Authorization: Bearer $ADMIN_TOKEN" "$API/customers" | find_id "$CUSTOMER_MOBILE")
[ -n "$OLD" ] && j -o /dev/null -H "Authorization: Bearer $ADMIN_TOKEN" -X DELETE "$API/customers/$OLD"
PROD=$(j -H "Authorization: Bearer $ADMIN_TOKEN" -X POST "$API/products" -d '{"name":"Cow Milk","category":"Milk","productType":"Milk","unit":"ml","price":30,"description":"","availability":"Available","features":[],"isVisibleToCustomer":true,"isActive":true,"packs":[{"id":"","label":"500 ml","unit":"ml","quantity":500,"price":30,"isActive":true}]}')
echo "product: $(echo "$PROD" | field name)"
CUST=$(j -H "Authorization: Bearer $ADMIN_TOKEN" -X POST "$API/customers" -d "{\"name\":\"Asha Patil\",\"mobile\":\"$CUSTOMER_MOBILE\",\"address\":\"B-12\",\"societyName\":\"Sai Heights\",\"deliveryTime\":\"Morning\",\"paymentType\":\"Monthly\",\"status\":\"Active\"}")
CUST_ID=$(echo "$CUST" | field id)
# Without an id every step below would quietly ask about customer "" and read as a pile of 405s.
[ -n "$CUST_ID" ] || { echo "could not add the customer: $CUST"; exit 1; }
echo "customer: $(echo "$CUST" | field name) ($CUST_ID)"

step "that customer can now sign in — their login is created on the spot"
CUST_OTP=$(code_for "$CUSTOMER_MOBILE")
CUST_TOKEN=$(token_for "$CUSTOMER_MOBILE" "$CUST_OTP")
j -H "Authorization: Bearer $CUST_TOKEN" "$API/auth/me"; echo

step "the customer reads their own record, and the catalog"
j -H "Authorization: Bearer $CUST_TOKEN" -o /dev/null -w "me/customer %{http_code}, " "$API/me/customer"
j -H "Authorization: Bearer $CUST_TOKEN" -o /dev/null -w "products %{http_code}\n" "$API/products"

step "the customer may not list customers, add products, or change what is the dairy’s on their record"
j -H "Authorization: Bearer $CUST_TOKEN" -o /dev/null -w "list customers %{http_code}, " "$API/customers"
j -H "Authorization: Bearer $CUST_TOKEN" -o /dev/null -w "add product %{http_code}, " -X POST "$API/products" -d '{"name":"Sneaky","price":1}'
j -H "Authorization: Bearer $CUST_TOKEN" -o /dev/null -w "own discount %{http_code}, " -X PATCH "$API/customers/$CUST_ID" -d '{"discountAmount":9999}'
j -H "Authorization: Bearer $CUST_TOKEN" -o /dev/null -w "neighbour %{http_code}\n" -X PATCH "$API/customers/cust_somebody_else" -d '{"extraOrders":[]}'

step "what they may do on their own record: pause a day that is still open"
TOMORROW=$(node -e 'console.log(new Date(Date.now() + 19800000 + 86400000).toISOString().slice(0, 10))')
j -H "Authorization: Bearer $CUST_TOKEN" -X PATCH "$API/customers/$CUST_ID" -d "{\"subscriptionExceptions\":[{\"id\":\"exc_auth_1\",\"kind\":\"skip\",\"fromYmd\":\"$TOMORROW\",\"toYmd\":\"$TOMORROW\",\"createdBy\":\"customer\"}]}" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log("paused: " + (c.subscriptionExceptions?.map(e=>e.fromYmd).join(", ") ?? JSON.stringify(c)))})'

step "signing out ends the session"
j -H "Authorization: Bearer $CUST_TOKEN" -o /dev/null -w "logout %{http_code}, " -X POST "$API/auth/logout"
j -H "Authorization: Bearer $CUST_TOKEN" -o /dev/null -w "me afterwards %{http_code}\n" "$API/auth/me"
