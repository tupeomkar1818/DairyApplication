#!/usr/bin/env bash
# The delivery team: the dairy adds someone, assigns a route and marks a month of attendance; the delivery boy
# signs in, sees their own record and their round, marks their own day — and cannot touch anything else.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
BOY_MOBILE=${BOY_MOBILE:-9876500044}
MATE_MOBILE=${MATE_MOBILE:-9876500088}
CUST_MOBILE=${CUST_MOBILE:-9876500055}

j() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
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
find_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(x=>(x.mobile||x.mobileNumber)===process.argv[1]);console.log(m?m.id:"")})' "$1"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "clearing anything an earlier run left behind"
OLD=$(admin "$API/customers" | find_id "$CUST_MOBILE")
[ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/customers/$OLD"
for mobile in "$BOY_MOBILE" "$MATE_MOBILE"; do
  OLD=$(admin "$API/delivery-boys" | find_id "$mobile")
  [ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/delivery-boys/$OLD"
done
echo "cleared"

step "the dairy adds a delivery boy with a route and a salary"
BOY=$(admin -X POST "$API/delivery-boys" -d "{
  \"fullName\":\"Sagar More\",\"mobileNumber\":\"$BOY_MOBILE\",\"primaryRouteName\":\"Kothrud A\",
  \"joiningDate\":\"2026-09-01\",\"status\":\"Active\",\"salaryType\":\"Attendance Based Salary\",
  \"monthlySalary\":9000,\"perDaySalary\":300,\"appAccessEnabled\":true,
  \"address\":\"Shastri Nagar\",\"aadhaarNumber\":\"1111 2222 3333\",
  \"bankDetails\":{\"accountNumber\":\"000123456789\",\"ifsc\":\"HDFC0000001\"},
  \"emergencyContactName\":\"Kaka\",\"emergencyContactNumber\":\"9876500099\",
  \"assignedRoutes\":[\"Kothrud A\"],\"shiftTiming\":\"Morning\",\"weeklyOffDay\":\"Sunday\",
  \"attendance\":[],\"leaves\":[],\"replacements\":[],\"salaryHistory\":[],\"performance\":[],\"complaints\":[],\"audit\":[]}")
BOY_ID=$(echo "$BOY" | field id)
echo "delivery boy: $(echo "$BOY" | field fullName) ($BOY_ID)"

step "a colleague, so a cover day has somebody to point at"
MATE_ID=$(admin -X POST "$API/delivery-boys" -d "{\"fullName\":\"Amit Kale\",\"mobileNumber\":\"$MATE_MOBILE\",
  \"primaryRouteName\":\"Kothrud B\",\"status\":\"Active\",\"salaryType\":\"Attendance Based Salary\",
  \"monthlySalary\":9000,\"perDaySalary\":300}" | field id)
echo "colleague: $MATE_ID"

step "a customer on the first route"
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Rohit Shelar\",\"mobile\":\"$CUST_MOBILE\",\"address\":\"D-7\",
  \"societyName\":\"Tulip\",\"deliveryTime\":\"Morning\",\"paymentType\":\"Monthly\",\"status\":\"Active\",
  \"routeName\":\"Kothrud A\",\"assignedDeliveryBoyId\":\"$BOY_ID\"}" | field id)
echo "customer: $CUST_ID"

step "the dairy marks three days: present, absent, and one covering the colleague"
admin -X PATCH "$API/delivery-boys/$BOY_ID" -d "{\"attendance\":[
  {\"id\":\"att_1\",\"date\":\"2026-10-09\",\"status\":\"Present\",\"markedBy\":\"Admin\"},
  {\"id\":\"att_2\",\"date\":\"2026-10-10\",\"status\":\"Absent\",\"notes\":\"Marked Absent from admin attendance\"},
  {\"id\":\"att_3\",\"date\":\"2026-10-11\",\"status\":\"Present\",\"coverForDeliveryBoyId\":\"$MATE_ID\",\"remarks\":\"Took the second round too\"}]}" \
  | show 'v.attendance ? JSON.stringify({days: v.attendance.map(a => a.date + " " + a.status), cover: v.attendance.filter(a => a.coverForDeliveryBoyId).length}) : s'

step "a day covering somebody not on the team is refused"
admin -X PATCH "$API/delivery-boys/$BOY_ID" -d '{"attendance":[{"id":"att_x","date":"2026-10-12","status":"Present","coverForDeliveryBoyId":"db_nobody"}]}'; echo

step "the delivery boy signs in"
BOY_TOKEN=$(sign_in "$BOY_MOBILE") || exit 1
boy() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $BOY_TOKEN" "$@"; }
boy "$API/auth/me" | show 'JSON.stringify({role: v.session.role, linked: !!v.linkedRecordId})'

step "their own record comes back whole — their own bank details are theirs to see"
boy "$API/me/delivery-boy" | show 'JSON.stringify({name: v.fullName, route: v.primaryRouteName, perDay: v.perDaySalary, attendanceDays: v.attendance.length, ownBank: !!v.bankDetails, ownAadhaar: !!v.aadhaarNumber})'

step "the team list leaves a colleague's personal details out"
boy "$API/delivery-boys" | show 'JSON.stringify(v.items.map(b => ({name: b.fullName, perDay: b.perDaySalary, bank: !!b.bankDetails, aadhaar: !!b.aadhaarNumber, address: !!b.address})))'

step "they see only their own round"
boy "$API/customers" | show '"stops: " + (v.items.map(c => c.name + " (" + c.routeName + ")").join(", ") || "none")'

step "they may mark their own attendance"
boy -X PATCH "$API/delivery-boys/$BOY_ID" -d "{\"attendance\":[
  {\"id\":\"att_1\",\"date\":\"2026-10-09\",\"status\":\"Present\",\"markedBy\":\"Admin\"},
  {\"id\":\"att_2\",\"date\":\"2026-10-10\",\"status\":\"Absent\",\"notes\":\"Marked Absent from admin attendance\"},
  {\"id\":\"att_3\",\"date\":\"2026-10-11\",\"status\":\"Present\",\"coverForDeliveryBoyId\":\"$MATE_ID\",\"remarks\":\"Took the second round too\"},
  {\"id\":\"att_4\",\"date\":\"2026-10-12\",\"status\":\"Present\",\"markedBy\":\"Delivery app\"}]}" \
  | show 'v.attendance ? "days: " + v.attendance.length : s'

step "but not their own salary, not a colleague, and not their own record"
boy -o /dev/null -w "own salary %{http_code}, " -X PATCH "$API/delivery-boys/$BOY_ID" -d '{"monthlySalary":99000}'
boy -o /dev/null -w "add a colleague %{http_code}, " -X POST "$API/delivery-boys" -d '{"fullName":"Ghost","mobileNumber":"9000000001"}'
boy -o /dev/null -w "delete self %{http_code}\n" -X DELETE "$API/delivery-boys/$BOY_ID"

step "the dairy cannot delete someone who still has a route"
admin -X DELETE "$API/delivery-boys/$BOY_ID"; echo

step "tidy up"
admin -o /dev/null -w "customer %{http_code}, " -X DELETE "$API/customers/$CUST_ID"
admin -o /dev/null -w "delivery boy %{http_code}, " -X DELETE "$API/delivery-boys/$BOY_ID"
admin -o /dev/null -w "colleague %{http_code}\n" -X DELETE "$API/delivery-boys/$MATE_ID"
