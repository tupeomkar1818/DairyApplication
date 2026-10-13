#!/usr/bin/env bash
# Messages: an announcement the dairy sends and a customer opens, a chat between the two, and the notifications
# each app raises — each landing in the right inbox, and nobody else's.
set -u
API=${API:-http://127.0.0.1:8787}
ADMIN_MOBILE=${ADMIN_MOBILE:-8208682688}
MOBILE=${MOBILE:-9876522222}
OTHER_MOBILE=${OTHER_MOBILE:-9876522233}
BOY_MOBILE=${BOY_MOBILE:-9876522244}
TODAY=$(node -e 'console.log(new Date(Date.now() + 19800000).toISOString().slice(0, 10))')

anon() { curl -s -H 'content-type: application/json' "$@"; }
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const v=JSON.parse(s);console.log(process.argv[1].split('.').reduce((a,k)=>a?.[k],v)??'')}catch{console.log('')}})" "$1"; }
step() { printf '\n=== %s\n' "$1"; }
show() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v;try{v=JSON.parse(s)}catch{console.log(s);return}console.log(eval(process.argv[1]))})' "$1"; }
problem() { show 'v.error ? v.error.code : "ACCEPTED (should not be)"'; }
# Windows' curl mangles non-ASCII in a -d argument, so any Marathi wording is sent from a file.
BODY=${TMPDIR:-/tmp}/amrale-message-body.json
body() { cat > "$BODY"; }
sign_in() {
  # Signing in the way the apps do: the number and the PIN. The first time for anybody, their own number is the
  # password and the PIN is chosen on the spot. No codes, so these never queue behind the one-minute cooldown.
  _res=$(anon -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$1\",\"secret\":\"${E2E_PIN:-4321}\"}")
  _tok=$(echo "$_res" | field session.sessionId)
  if [ -z "$_tok" ]; then
    _res=$(anon -X POST "$API/auth/login" -d "{\"mobileNumber\":\"$1\",\"secret\":\"$1\"}")
    _tok=$(echo "$_res" | field session.sessionId)
    [ -n "$_tok" ] || { echo "could not sign $1 in: $_res" >&2; return 1; }
    curl -s -o /dev/null -H 'content-type: application/json' -H "Authorization: Bearer $_tok" \
      -X POST "$API/auth/pin" -d "{\"pin\":\"${E2E_PIN:-4321}\"}"
  fi
  echo "$_tok"
}
find_id() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const list=(JSON.parse(s).items)||[];const m=list.find(x=>(x.mobile||x.mobileNumber)===process.argv[1]);console.log(m?m.id:"")})' "$1"; }

TOKEN=$(sign_in "$ADMIN_MOBILE") || exit 1
admin() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" "$@"; }

step "clearing anything an earlier run left behind"
for mobile in "$MOBILE" "$OTHER_MOBILE"; do
  OLD=$(admin "$API/customers" | find_id "$mobile")
  [ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/customers/$OLD"
done
OLD=$(admin "$API/delivery-boys" | find_id "$BOY_MOBILE")
[ -n "$OLD" ] && admin -o /dev/null -X DELETE "$API/delivery-boys/$OLD"
for id in ann_festival ann_for_one; do admin -o /dev/null -X DELETE "$API/announcements/$id"; done
echo "cleared"

step "a delivery boy, and two customers — one on their round, one not"
BOY_ID=$(admin -X POST "$API/delivery-boys" -d "{\"fullName\":\"Sagar More\",\"mobileNumber\":\"$BOY_MOBILE\",
  \"primaryRouteName\":\"Kothrud A\",\"status\":\"Active\",\"salaryType\":\"Attendance Based Salary\",\"monthlySalary\":9000}" | field id)
CUST_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Meera Joshi\",\"mobile\":\"$MOBILE\",\"address\":\"A-11\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",\"routeName\":\"Kothrud A\",
  \"assignedDeliveryBoyId\":\"$BOY_ID\"}" | field id)
OTHER_ID=$(admin -X POST "$API/customers" -d "{\"name\":\"Sunil Kale\",\"mobile\":\"$OTHER_MOBILE\",\"address\":\"A-12\",
  \"societyName\":\"Shivneri\",\"deliveryTime\":\"Morning\",\"status\":\"Active\",\"routeName\":\"Kothrud B\"}" | field id)
echo "delivery boy $BOY_ID, customer $CUST_ID, neighbour $OTHER_ID"

step "the dairy sends a festival message to everybody, in both languages"
body <<JSON
{ "category": "Festival", "title": "Happy Diwali", "message": "Wishing you light and sweets.",
  "translations": { "mr": { "title": "दिवाळीच्या शुभेच्छा", "message": "प्रकाश आणि गोडव्याच्या शुभेच्छा." } },
  "audience": { "kind": "all" }, "source": "admin", "senderName": "Amrale Dairy", "readBy": {} }
JSON
admin -X PUT "$API/announcements/ann_festival" -d @"$BODY" | show 'JSON.stringify({id: v.id, title: v.title, marathiKept: !!v.translations?.mr, to: v.audience.kind})'

step "and a note to one customer only"
admin -X PUT "$API/announcements/ann_for_one" -d "{\"category\":\"Payment\",\"title\":\"Your October bill\",
  \"message\":\"Your bill is ready.\",\"audience\":{\"kind\":\"customers\",\"customerIds\":[\"$OTHER_ID\"]},
  \"source\":\"admin\",\"readBy\":{}}" | show '"sent to " + v.audience.customerIds.length + " customer"'

step "the customer signs in and sees only what was sent to them"
CUST_TOKEN=$(sign_in "$MOBILE") || exit 1
cust() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $CUST_TOKEN" "$@"; }
cust "$API/announcements" | show 'JSON.stringify(v.items.map(a => a.title))'

step "the neighbour's note is not theirs to open"
cust "$API/announcements/ann_for_one" | problem

step "they open the festival message"
cust -X POST "$API/announcements/ann_festival/read" | show '"read marks they can see: " + JSON.stringify(v.readBy)'

step "the dairy sees who has opened it"
admin "$API/announcements/ann_festival" | show '"opened by " + Object.keys(v.readBy).length + " customer(s)"'

step "a customer cannot send a message to everybody"
cust -X PUT "$API/announcements/ann_sneaky" -d '{"title":"Free milk","message":"Come and get it","audience":{"kind":"all"},"source":"admin","readBy":{}}' | problem

step "the delivery boy marks a day, which raises the message about it"
BOY_TOKEN=$(sign_in "$BOY_MOBILE") || exit 1
boy() { curl -s -H 'content-type: application/json' -H "Authorization: Bearer $BOY_TOKEN" "$@"; }
boy -X PUT "$API/announcements/ann_delivery_${CUST_ID}_${TODAY}" -d "{\"category\":\"Delivery\",\"title\":\"Delivered\",
  \"message\":\"Your milk was delivered today.\",\"audience\":{\"kind\":\"customers\",\"customerIds\":[\"$CUST_ID\"]},
  \"source\":\"delivery\",\"senderName\":\"Sagar More\",\"dateYmd\":\"$TODAY\",\"readBy\":{}}" \
  | show 'v.error ? v.error.code : "raised: " + v.title + " for " + v.audience.customerIds.length + " house"'

step "but not about a house on somebody else's round"
boy -X PUT "$API/announcements/ann_delivery_${OTHER_ID}_${TODAY}" -d "{\"category\":\"Delivery\",\"title\":\"Delivered\",
  \"message\":\"Your milk was delivered today.\",\"audience\":{\"kind\":\"customers\",\"customerIds\":[\"$OTHER_ID\"]},
  \"source\":\"delivery\",\"dateYmd\":\"$TODAY\",\"readBy\":{}}" | problem

step "the customer writes to the dairy, and the dairy answers"
cust -X POST "$API/chat" -d '{"text":"Please leave the milk with the watchman.","senderName":"Meera Joshi"}' \
  | show '"customer: " + v.text + " (" + v.from + ")"'
admin -X POST "$API/chat" -d "{\"customerId\":\"$CUST_ID\",\"text\":\"We will tell Sagar. Thank you!\",\"senderName\":\"Amrale Dairy\"}" \
  | show '"dairy: " + v.text + " (" + v.from + ")"'

step "each side sees the conversation"
cust "$API/chat" | show 'JSON.stringify(v.items.map(m => m.from + ": " + m.text))'
admin "$API/chat" | show '"the dairy sees " + v.items.length + " message(s) across all customers"'

step "a customer cannot read or write another household's chat"
cust -X POST "$API/chat" -d "{\"customerId\":\"$OTHER_ID\",\"text\":\"Hello neighbour\"}" \
  | show '"went to their own conversation instead: " + (v.customerId === process.env.CUST_ID ? "yes" : v.customerId)'
CUST_ID="$CUST_ID" cust "$API/chat" | show '"conversations they can read: " + new Set(v.items.map(m => m.customerId)).size'

step "the dairy opens the conversation, so the customer's message is seen"
admin -X POST "$API/chat/read" -d "{\"customerId\":\"$CUST_ID\"}" | show 'JSON.stringify(v.items.map(m => m.from + (m.readAt ? " (read)" : " (unread)")))'

step "the customer's app tells the dairy what they did"
cust -X POST "$API/notifications" -d "{\"audience\":\"Admin\",\"customerId\":\"$CUST_ID\",\"type\":\"OrderPlaced\",
  \"title\":\"Meera ordered Paneer\",\"body\":\"For tomorrow.\",\"subjectKey\":\"order:$CUST_ID:paneer\"}" \
  | show '"raised: " + v.items[0].title'

step "the same change again replaces it — one change, one notification"
cust -X POST "$API/notifications" -d "{\"audience\":\"Admin\",\"customerId\":\"$CUST_ID\",\"type\":\"OrderPlaced\",
  \"title\":\"Meera ordered Paneer × 2\",\"body\":\"For tomorrow.\",\"subjectKey\":\"order:$CUST_ID:paneer\"}" > /dev/null
admin "$API/notifications" | show 'JSON.stringify(v.items.filter(n => n.type === "OrderPlaced").map(n => n.title))'

step "but it cannot write into another household's inbox"
cust -X POST "$API/notifications" -d "{\"audience\":\"Customer\",\"customerId\":\"$OTHER_ID\",\"type\":\"Announcement\",
  \"title\":\"You owe nothing\",\"body\":\"Ignore your bill.\"}" | problem

step "the dairy tells the customer, and only they see it"
admin -X POST "$API/notifications" -d "{\"items\":[{\"audience\":\"Customer\",\"customerId\":\"$CUST_ID\",\"type\":\"PaymentReceived\",
  \"title\":\"Payment received\",\"body\":\"₹500 received, thank you.\",
  \"translations\":{\"mr\":{\"title\":\"पेमेंट मिळालं\",\"body\":\"₹५०० मिळाले, धन्यवाद.\"}}}]}" > /dev/null
cust "$API/notifications" | show 'JSON.stringify(v.items.map(n => ({title: n.title, mr: !!n.translations?.mr, read: !!n.readAt})))'

step "they read their inbox"
cust -X POST "$API/notifications/read" -d '{"all":true}' | show '"unread left: " + v.items.filter(n => !n.readAt).length'

step "the dairy's own inbox is the dairy's"
admin "$API/notifications" | show '"admin rows: " + v.items.length + ", all addressed to the dairy: " + v.items.every(n => n.audience === "Admin")'
admin "$API/notifications?scope=all" | show '"every row, for the reports: " + v.items.length'

step "tidy up"
admin -o /dev/null -w "festival %{http_code}, " -X DELETE "$API/announcements/ann_festival"
admin -o /dev/null -w "note %{http_code}, " -X DELETE "$API/announcements/ann_for_one"
admin -o /dev/null -w "delivery message %{http_code}, " -X DELETE "$API/announcements/ann_delivery_${CUST_ID}_${TODAY}"
admin -o /dev/null -w "customer %{http_code}, " -X DELETE "$API/customers/$CUST_ID"
admin -o /dev/null -w "neighbour %{http_code}, " -X DELETE "$API/customers/$OTHER_ID"
admin -o /dev/null -w "delivery boy %{http_code}\n" -X DELETE "$API/delivery-boys/$BOY_ID"
