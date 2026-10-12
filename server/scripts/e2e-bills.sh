#!/usr/bin/env bash
# The monthly bill: what a finished month came to, worked out the way the apps work it out, and told to the
# customer on the dairy's billing day. `wrangler dev` runs a job on request, with the day to run it for.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876544444}

anon() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
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
# The day the job is run for, so a finished month can be billed without waiting for one.
run_bills_on() { curl -s -o /dev/null -w "%{http_code}" "$API/cdn-cgi/local/scheduled?cron=30+0+*+*+*&time=$(node -e 'console.log(Date.parse(process.argv[1]))' "$1")"; }

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "clearing anything an earlier run left behind"
OLD=$(admin "$API/customers" | find_id "$MOBILE")
[ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/customers/$OLD"
echo "cleared"

step "a customer with ten days of milk in September at ₹52, and nothing paid"
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Asha Pawar\",\"mobile\":\"$MOBILE\",\"address\":\"A-1\",
  \"societyName\":\"Green View\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",\"routeName\":\"Kothrud A\",
  \"subscriptionStartDate\":\"2026-09-01\",
  \"subscriptionPlans\":[{\"productName\":\"Cow Milk\",\"quantityLabel\":\"500 ml\",\"numberOfItems\":1,
    \"frequency\":\"Daily\",\"deliveryTime\":\"Morning\",\"startDate\":\"2026-09-01\",\"openEnded\":true,
    \"status\":\"Active\",\"originalPrice\":56,\"discountedPrice\":52,\"effectiveFinalPrice\":52}]}" | field id)
BODY=$(node -e '
const days = [];
for (let d = 1; d <= 10; d += 1) {
  const ymd = `2026-09-${String(d).padStart(2, "0")}`;
  days.push({ id: `del_bill_${d}`, deliveryDate: ymd, productName: "Cow Milk", quantityLabel: "500 ml", status: "Delivered" });
}
days.push({ id: "del_bill_addon_day", deliveryDate: "2026-09-11", productName: "Cow Milk", quantityLabel: "500 ml", status: "Delivered" });
console.log(JSON.stringify({
  deliveries: days,
  extraOrders: [{ id: "extra_bill_1", orderDate: "2026-09-11", deliveryDate: "2026-09-11", productName: "Paneer",
    quantityLabel: "200 g", numberOfItems: 1, price: 90, status: "Delivered", placedBy: "customer" }],
}));')
admin -o /dev/null -X PATCH "$API/customers/$CUST_ID" -d "$BODY"
echo "customer: $CUST_ID"

step "what the server makes of September — eleven days of milk and one paneer"
admin "$API/customers/$CUST_ID/bills?month=2026-09" | show 'JSON.stringify(v.months.map(m => ({month: m.month, charges: m.baseAmount, bill: m.invoiceTotal, due: m.dueDateYmd, status: m.status})))'

step "the bill goes out on the 1st of October"
echo "cron answered $(run_bills_on '2026-10-01T00:30:00Z')"
CUST_TOKEN=$(sign_in "$MOBILE") || exit 1
cust() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $CUST_TOKEN" "$@"; }
cust "$API/notifications" | show 'JSON.stringify(v.items.filter(n => n.type === "MonthlyBillGenerated").map(n => ({title: n.title, body: n.body, marathi: !!n.translations?.mr, month: n.monthYyyyMm})), null, 1)'

step "and the dairy sees how many went out"
admin "$API/notifications" | show 'JSON.stringify(v.items.filter(n => n.type === "MonthlyBillGenerated").map(n => n.title + " — " + n.body))'

step "running it again does not bill the month twice"
run_bills_on '2026-10-01T00:30:00Z' > /dev/null
cust "$API/notifications" | show '"bills in their inbox: " + v.items.filter(n => n.type === "MonthlyBillGenerated").length'

step "a day that is not their billing day sends nothing"
run_bills_on '2026-10-07T00:30:00Z' > /dev/null
cust "$API/notifications" | show '"still: " + v.items.filter(n => n.type === "MonthlyBillGenerated").length'

step "the customer can read their own bills, and only their own"
cust "$API/customers/$CUST_ID/bills?month=2026-09" | show '"outstanding: ₹" + v.outstanding + ", overdue: ₹" + v.overdue'
cust -o /dev/null -w "somebody else's bills: %{http_code}\n" "$API/customers/cust_somebody_else/bills"

step "the dairy records ₹500 against it"
admin -X PATCH "$API/customers/$CUST_ID" -d '{"payments":[{"id":"pay_bill_e2e","paymentDate":"2026-10-02","amountPaid":500,"paymentMode":"Cash","collectedBy":"Sagar"}]}' > /dev/null
admin "$API/customers/$CUST_ID/bills?month=2026-10" | show 'JSON.stringify({outstanding: v.outstanding, advance: v.advance, september: v.months.find(m => m.month === "2026-09")})'

step "tidy up"
admin -o /dev/null -w "customer %{http_code}\n" -X DELETE "$API/customers/$CUST_ID"
