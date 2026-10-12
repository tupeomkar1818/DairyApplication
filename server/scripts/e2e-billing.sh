#!/usr/bin/env bash
# A month in the life of one customer: a subscription, delivered days, a missed day, a paused day, an extra order
# and a payment — then the bill the app would show, worked out from what came back.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876500033}

j() { curl -s -H 'content-type: application/json' "$@"; }
auth() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }

# A code can only be asked for once a minute, so a run right after another one waits for the cooldown.
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

TOKEN=$(sign_in "$ADMIN_MOBILE")
[ -n "$TOKEN" ] || { echo "could not sign in (is SMS_PROVIDER=log with OTP_DEV_ECHO=true?)"; exit 1; }

step "the dairy adds a customer on ₹30 × 2 a day from 1 Oct"
CUST=$(auth -X POST "$API/customers" -d "{
  \"name\":\"Nilesh Jadhav\",\"mobile\":\"$MOBILE\",\"address\":\"C-4\",\"societyName\":\"Shree Residency\",
  \"deliveryTime\":\"Morning\",\"paymentType\":\"Monthly\",\"billingType\":\"Postpaid\",\"billingCycleDate\":30,
  \"status\":\"Active\",\"subscriptionStartDate\":\"2026-10-01\",
  \"subscriptionPlans\":[{\"productName\":\"Cow Milk\",\"quantityLabel\":\"500 ml\",\"numberOfItems\":2,
    \"frequency\":\"Daily\",\"deliveryTime\":\"Morning\",\"startDate\":\"2026-10-01\",\"openEnded\":true,
    \"status\":\"Active\",\"originalPrice\":30,\"effectiveFinalPrice\":30}]}")
ID=$(echo "$CUST" | field id)
echo "customer: $(echo "$CUST" | field name) ($ID)"

step "the delivery boy marks 1–8 Oct delivered, 9 Oct missed; the customer paused 10 Oct and ordered paneer on 11 Oct; the dairy recorded ₹300"
BODY=$(node -e '
const days = [];
for (let d = 1; d <= 8; d += 1) {
  const ymd = `2026-10-0${d}`;
  days.push({ id: `del_bill_${d}`, deliveryDate: ymd, productName: "Cow Milk", quantityLabel: "500 ml", status: "Delivered", subscriptionItems: 2 });
}
days.push({ id: "del_bill_9", deliveryDate: "2026-10-09", productName: "Cow Milk", quantityLabel: "500 ml", status: "Missed", missedReason: "Nobody at home" });
days.push({ id: "del_bill_11", deliveryDate: "2026-10-11", productName: "Cow Milk", quantityLabel: "500 ml", status: "Delivered", subscriptionItems: 2 });
console.log(JSON.stringify({
  deliveries: days,
  subscriptionExceptions: [{ id: "exc_bill_1", kind: "skip", fromYmd: "2026-10-10", toYmd: "2026-10-10", reason: "Paused from the app", createdBy: "customer" }],
  extraOrders: [{ id: "extra_bill_1", orderDate: "2026-10-11", deliveryDate: "2026-10-11", productName: "Paneer", quantityLabel: "200 g", numberOfItems: 1, price: 100, status: "Delivered", placedBy: "customer" }],
  payments: [{ id: "pay_bill_1", paymentDate: "2026-10-11", amountPaid: 300, paymentMode: "Cash", collectedBy: "Sagar" }],
  paymentRequests: [{ id: "payreq_bill_1", amount: 200, method: "UPI", reference: "432101234567", paidOnYmd: "2026-10-11", status: "Pending" }],
}));')
auth -X PATCH "$API/customers/$ID" -d "$BODY" > /dev/null

step "what the apps now read back"
auth "$API/customers/$ID" | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const c = JSON.parse(s);
  const delivered = c.deliveries.filter((d) => d.status === "Delivered");
  const missed = c.deliveries.filter((d) => d.status === "Missed");
  const subscription = delivered.length * 2 * 30;
  const addOns = c.extraOrders.filter((o) => o.status === "Delivered").reduce((sum, o) => sum + o.price * o.numberOfItems, 0);
  const paid = c.payments.reduce((sum, p) => sum + p.amountPaid, 0);
  console.log({
    plans: c.subscriptionPlans.length,
    deliveredDays: delivered.length,
    missedDays: missed.length,
    pausedDays: c.subscriptionExceptions.length,
    addOnOrders: c.extraOrders.length,
    paymentsRecorded: c.payments.length,
    paymentsAwaitingConfirmation: c.paymentRequests.filter((r) => r.status === "Pending").length,
  });
  console.log("October bill:", { subscription, addOns, charges: subscription + addOns, paid, stillToPay: subscription + addOns - paid });
});'

step "the delivery boy sees only their own route (this customer has none, so not theirs)"
auth "$API/customers" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log("customers the dairy sees:",JSON.parse(s).items.length));'

step "a profile edit leaves the month alone"
auth -X PATCH "$API/customers/$ID" -d '{"routeName":"Kothrud B"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log({route:c.routeName,deliveriesKept:c.deliveries.length,paymentsKept:c.payments.length,plansKept:c.subscriptionPlans.length});});'

step "the dairy confirms the UPI payment: the request closes and the money is recorded"
auth -X PATCH "$API/customers/$ID" -d '{
  "payments":[{"id":"pay_bill_1","paymentDate":"2026-10-11","amountPaid":300,"paymentMode":"Cash","collectedBy":"Sagar"},
              {"id":"pay_bill_2","paymentDate":"2026-10-11","amountPaid":200,"paymentMode":"UPI","transactionId":"432101234567","notes":"Paid from the customer app (UPI)"}],
  "paymentRequests":[{"id":"payreq_bill_1","amount":200,"method":"UPI","reference":"432101234567","paidOnYmd":"2026-10-11","status":"Confirmed","paymentId":"pay_bill_2","reviewedAt":"2026-10-11T12:00:00.000Z"}]
}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log({payments:c.payments.map(p=>p.paymentMode+" ₹"+p.amountPaid),requests:c.paymentRequests.map(r=>r.status)});});'

step "tidy up"
auth -o /dev/null -w "customer delete %{http_code}\n" -X DELETE "$API/customers/$ID"
