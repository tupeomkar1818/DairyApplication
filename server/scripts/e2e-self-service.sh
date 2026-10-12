#!/usr/bin/env bash
# What a customer may do to their own record from the customer app — and what the server refuses, however the
# phone asks: a price of its own, a day that is closed, somebody else's record, a payment confirmed by itself.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876500077}
OTHER_MOBILE=${OTHER_MOBILE:-9876500078}
TODAY=$(node -e 'console.log(new Date(Date.now() + 19800000).toISOString().slice(0, 10))')
TOMORROW=$(node -e 'console.log(new Date(Date.now() + 19800000 + 86400000).toISOString().slice(0, 10))')

j() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }
problem() { show 'v.error ? v.error.code : "ACCEPTED (should not be)"'; }
sign_in() {
  local otp="" tries=0 answer
  until [ -n "$otp" ]; do
    answer=$(j -X POST "$API/auth/otp/request" -d "{\"mobileNumber\":\"$1\"}")
    otp=$(echo "$answer" | field demoOtp)
    if [ -z "$otp" ]; then
      tries=$((tries + 1))
      [ "$tries" -gt 8 ] && { echo "could not get a code for $1: $answer" >&2; return 1; }
      sleep 9
    fi
  done
  j -X POST "$API/auth/otp/verify" -d "{\"mobileNumber\":\"$1\",\"otp\":\"$otp\"}" | field session.sessionId
}
find_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(x=>(x.mobile||x.mobileNumber||x.name)===process.argv[1]);console.log(m?m.id:"")})' "$1"; }

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "clearing anything an earlier run left behind"
for mobile in "$MOBILE" "$OTHER_MOBILE"; do
  OLD=$(admin "$API/customers" | find_id "$mobile")
  [ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/customers/$OLD"
done
OLD=$(admin "$API/products" | find_id "Self Service Milk")
[ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/products/$OLD"
echo "cleared"

step "the dairy's catalog: one product, ₹30 for 500 ml"
PRODUCT=$(admin -X POST "$API/products" -d '{"name":"Self Service Milk","category":"Milk","productType":"Milk","unit":"ml",
  "price":30,"availability":"Available","isVisibleToCustomer":true,"isActive":true,
  "packs":[{"label":"500 ml","unit":"ml","quantity":500,"price":30,"isActive":true}]}')
PACK_ID=$(echo "$PRODUCT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(p.packs?.[0]?.id ?? "")})')
echo "pack: $PACK_ID"

step "two customers, so one can try the other's record"
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Asha Pawar\",\"mobile\":\"$MOBILE\",\"address\":\"B-2\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",\"routeName\":\"Kothrud A\",
  \"subscriptionPlans\":[{\"productName\":\"Self Service Milk\",\"quantityLabel\":\"500 ml\",\"packId\":\"$PACK_ID\",
    \"numberOfItems\":2,\"frequency\":\"Daily\",\"deliveryTime\":\"Morning\",\"startDate\":\"$TODAY\",\"openEnded\":true,
    \"status\":\"Active\",\"originalPrice\":30,\"effectiveFinalPrice\":30}]}" | field id)
OTHER_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Sunil Kale\",\"mobile\":\"$OTHER_MOBILE\",\"address\":\"B-3\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",\"routeName\":\"Kothrud A\"}" | field id)
PLAN_ID=$(admin "$API/customers/$CUST_ID" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log(JSON.parse(s).subscriptionPlans[0].id)})')
echo "customer: $CUST_ID (plan $PLAN_ID), neighbour: $OTHER_ID"

step "the customer signs in"
CUST_TOKEN=$(sign_in "$MOBILE") || exit 1
cust() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $CUST_TOKEN" "$@"; }
me() { cust -X PATCH "$API/customers/$CUST_ID" -d "$1"; }

step "they order a pack for tomorrow"
me "{\"extraOrders\":[{\"id\":\"extra_1\",\"orderDate\":\"$TOMORROW\",\"deliveryDate\":\"$TOMORROW\",
  \"productName\":\"Self Service Milk\",\"quantityLabel\":\"500 ml\",\"packId\":\"$PACK_ID\",\"numberOfItems\":2,
  \"price\":30,\"status\":\"Pending\",\"placedBy\":\"customer\"}]}" \
  | show 'JSON.stringify(v.extraOrders?.map(o => ({day: o.deliveryDate, packs: o.numberOfItems, price: o.price, status: o.status})) ?? v)'

step "a price of their own is refused"
me "{\"extraOrders\":[{\"id\":\"extra_cheap\",\"deliveryDate\":\"$TOMORROW\",\"productName\":\"Self Service Milk\",
  \"quantityLabel\":\"500 ml\",\"packId\":\"$PACK_ID\",\"numberOfItems\":2,\"price\":1,\"status\":\"Pending\"}]}" | problem

step "an order for today is refused: the crates went out this morning"
me "{\"extraOrders\":[{\"id\":\"extra_today\",\"deliveryDate\":\"$TODAY\",\"productName\":\"Self Service Milk\",
  \"quantityLabel\":\"500 ml\",\"packId\":\"$PACK_ID\",\"numberOfItems\":1,\"price\":30,\"status\":\"Pending\"}]}" | problem

step "an order that marks itself delivered is refused"
me "{\"extraOrders\":[{\"id\":\"extra_done\",\"deliveryDate\":\"$TOMORROW\",\"productName\":\"Self Service Milk\",
  \"quantityLabel\":\"500 ml\",\"packId\":\"$PACK_ID\",\"numberOfItems\":1,\"price\":30,\"status\":\"Delivered\"}]}" | problem

step "sending the list back without yesterday's order does not drop it"
me '{"extraOrders":[]}' | show '"orders still there: " + (v.extraOrders?.length ?? JSON.stringify(v))'

step "they cancel their order, and it stays on the record as cancelled"
me "{\"extraOrders\":[{\"id\":\"extra_1\",\"deliveryDate\":\"$TOMORROW\",\"productName\":\"Self Service Milk\",
  \"quantityLabel\":\"500 ml\",\"packId\":\"$PACK_ID\",\"numberOfItems\":2,\"price\":30,\"status\":\"Cancelled\"}]}" \
  | show 'JSON.stringify(v.extraOrders?.map(o => o.status) ?? v)'

step "they pause tomorrow"
me "{\"subscriptionExceptions\":[{\"id\":\"exc_1\",\"kind\":\"skip\",\"fromYmd\":\"$TOMORROW\",\"toYmd\":\"$TOMORROW\",
  \"reason\":\"Paused from the app\",\"createdBy\":\"customer\"}]}" \
  | show 'JSON.stringify(v.subscriptionExceptions?.map(e => e.kind + " " + e.fromYmd + " by " + e.createdBy) ?? v)'

step "pausing today is refused"
me "{\"subscriptionExceptions\":[{\"id\":\"exc_today\",\"kind\":\"skip\",\"fromYmd\":\"$TODAY\",\"toYmd\":\"$TODAY\",
  \"createdBy\":\"customer\"}]}" | problem

step "they take one pack a day instead of two, from tomorrow"
me "{\"subscriptionPlans\":[{\"id\":\"$PLAN_ID\",\"productName\":\"Self Service Milk\",\"quantityLabel\":\"500 ml\",
  \"packId\":\"$PACK_ID\",\"numberOfItems\":1,\"frequency\":\"Daily\",\"deliveryTime\":\"Morning\",
  \"startDate\":\"$TODAY\",\"openEnded\":true,\"status\":\"Active\",\"originalPrice\":1,\"effectiveFinalPrice\":1}]}" \
  | show 'JSON.stringify(v.subscriptionPlans?.map(p => ({packs: p.numberOfItems, price: p.effectiveFinalPrice})) ?? v)'

step "they say they have paid ₹500 by UPI"
me "{\"paymentRequests\":[{\"id\":\"payreq_1\",\"amount\":500,\"method\":\"UPI\",\"reference\":\"432101234567\",
  \"paidOnYmd\":\"$TODAY\",\"status\":\"Pending\"}]}" \
  | show 'JSON.stringify(v.paymentRequests?.map(r => ({amount: r.amount, status: r.status})) ?? v)'

step "confirming their own payment is refused"
me "{\"paymentRequests\":[{\"id\":\"payreq_1\",\"amount\":500,\"method\":\"UPI\",\"paidOnYmd\":\"$TODAY\",\"status\":\"Approved\"}]}" | problem

step "so is recording a payment, their own discount, or their own route"
me '{"payments":[{"id":"pay_x","paymentDate":"2026-10-12","amountPaid":5000,"paymentMode":"Cash"}]}' | problem
me '{"discountAmount":500}' | problem
me '{"routeName":"Kothrud B"}' | problem

step "and so is touching the neighbour's record"
cust -o /dev/null -w "neighbour patch %{http_code}, " -X PATCH "$API/customers/$OTHER_ID" -d '{"extraOrders":[]}'
cust -o /dev/null -w "neighbour read %{http_code}\n" "$API/customers/$OTHER_ID"

step "what the dairy sees on the record now"
admin "$API/customers/$CUST_ID" | show 'JSON.stringify({
  orders: v.extraOrders.map(o => o.status),
  pausedDays: v.subscriptionExceptions.map(e => e.fromYmd),
  packsADay: v.subscriptionPlans[0].numberOfItems,
  priceKept: v.subscriptionPlans[0].effectiveFinalPrice,
  paymentRequests: v.paymentRequests.map(r => r.amount + " " + r.status),
  payments: v.payments.length,
})'

step "tidy up"
admin -o /dev/null -w "customer %{http_code}, " -X DELETE "$API/customers/$CUST_ID"
admin -o /dev/null -w "neighbour %{http_code}, " -X DELETE "$API/customers/$OTHER_ID"
PROD_ID=$(admin "$API/products" | find_id "Self Service Milk")
admin -o /dev/null -w "product %{http_code}\n" -X DELETE "$API/products/$PROD_ID"
