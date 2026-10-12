#!/usr/bin/env bash
# Puts one customer with a month of deliveries and a payment into the local database, so the apps have something
# real to show. Waits out the one-minute code cooldown if a code was just asked for.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876500011}

j() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }

OTP=""
until [ -n "$OTP" ]; do
  OTP=$(j -X POST "$API/auth/otp/request" -d "{\"mobileNumber\":\"$ADMIN_MOBILE\"}" | field demoOtp)
  [ -n "$OTP" ] || { echo "waiting for the code cooldown…"; sleep 10; }
done
TOKEN=$(j -X POST "$API/auth/otp/verify" -d "{\"mobileNumber\":\"$ADMIN_MOBILE\",\"otp\":\"$OTP\"}" | field session.sessionId)
[ -n "$TOKEN" ] || { echo "could not sign in"; exit 1; }
auth() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

ID=$(auth "$API/customers" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s).items.find(c=>c.mobile===process.argv[1]);console.log(m?m.id:"")})' "$MOBILE")
if [ -z "$ID" ]; then
  ID=$(auth -X POST "$API/customers" -d "{
    \"name\":\"Asha Patil\",\"mobile\":\"$MOBILE\",\"address\":\"B-12\",\"societyName\":\"Sai Heights\",
    \"deliveryTime\":\"Morning\",\"paymentType\":\"Monthly\",\"billingType\":\"Postpaid\",\"billingCycleDate\":30,
    \"status\":\"Active\",\"subscriptionStartDate\":\"2026-10-01\",
    \"subscriptionPlans\":[{\"productName\":\"Cow Milk\",\"quantityLabel\":\"500 ml\",\"numberOfItems\":2,
      \"frequency\":\"Daily\",\"deliveryTime\":\"Morning\",\"startDate\":\"2026-10-01\",\"openEnded\":true,
      \"status\":\"Active\",\"originalPrice\":30,\"effectiveFinalPrice\":30}]}" | field id)
fi
echo "customer $ID"

BODY=$(node -e '
const days = [];
for (let i = 1; i <= 11; i += 1) {
  const ymd = `2026-10-${String(i).padStart(2, "0")}`;
  days.push(
    i === 9
      ? { id: "del_9", deliveryDate: ymd, productName: "Cow Milk", quantityLabel: "500 ml", status: "Missed", missedReason: "Nobody at home" }
      : { id: `del_${i}`, deliveryDate: ymd, productName: "Cow Milk", quantityLabel: "500 ml", status: "Delivered", subscriptionItems: 2 },
  );
}
console.log(JSON.stringify({
  deliveries: days,
  payments: [{ id: "pay_1", paymentDate: "2026-10-11", amountPaid: 300, paymentMode: "Cash", collectedBy: "Sagar" }],
}));')

auth -X PATCH "$API/customers/$ID" -d "$BODY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log("seeded:",{deliveries:c.deliveries.length,delivered:c.deliveries.filter(d=>d.status==="Delivered").length,payments:c.payments.length});});'
