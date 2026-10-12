export const ADMIN_DASHBOARD_SETTINGS_STORE_KEY = 'DAIRY_ADMIN_DASHBOARD_SETTINGS_V1';

export const FAQ_STORE_KEY = 'DAIRY_FAQ_V1';
export const CONTACT_ADMIN_STORE_KEY = 'DAIRY_CONTACT_ADMIN_V3';
export const PRIVACY_POLICY_STORE_KEY = 'DAIRY_PRIVACY_POLICY_V1';

export const USERS_STORE_KEY = 'DAIRY_USERS_V1';
export const OTP_CHALLENGES_STORE_KEY = 'DAIRY_OTP_CHALLENGES_V1';

/** Active session id pointer — must stay in sync with auth mock */
export const SESSION_ID_STORAGE_KEY = 'DAIRY_SESSION_ID_V1';
export const SESSION_STORE_PREFIX = 'DAIRY_SESSION_V1:';

export const PROFILE_MOBILE_CHANGE_STORE_KEY = 'DAIRY_PROFILE_MOBILE_CHANGE_V1';
/** Per-user profile avatar URIs; key = userId */
export const PROFILE_AVATARS_STORE_KEY = 'DAIRY_PROFILE_AVATARS_V1';

export const PRODUCTS_STORE_KEY = 'DAIRY_PRODUCTS_V1';
export const PRODUCT_CATEGORIES_STORE_KEY = 'DAIRY_PRODUCT_CATEGORIES_V1';
export const PRODUCT_ACTIVITY_STORE_KEY = 'DAIRY_PRODUCT_ACTIVITY_V1';
export const CUSTOMERS_STORE_KEY = 'DAIRY_CUSTOMERS_V1';
export const DELIVERY_BOYS_STORE_KEY = 'DAIRY_DELIVERY_BOYS_V3';
export const ORDERS_STORE_KEY = 'DAIRY_ORDERS_V1';
export const SUBSCRIPTIONS_STORE_KEY = 'DAIRY_DYNAMIC_SUBSCRIPTIONS_V1';
/** Per-customer admin calendar entries (subscription tab); value key suffix = customerId */
export const CUSTOMER_SUBSCRIPTION_CALENDAR_STORE_PREFIX = 'DAIRY_CUSTOMER_SUB_CAL_V1';
/** Per-customer day product order lines (subscription calendar); value key suffix = customerId */
export const CUSTOMER_DAILY_PRODUCT_ORDERS_STORE_PREFIX = 'DAIRY_CUSTOMER_DAY_ORDER_V1';
/** Per-customer basic subscription history memos (duplicate-line closures, etc.) */
export const CUSTOMER_SUBSCRIPTION_PLAN_HISTORY_MEMO_PREFIX = 'DAIRY_CUSTOMER_SUB_PLAN_MEMO_V1';
/** Per-customer derived billing ledger rows (day-wise billing snapshot); key suffix = customerId:YYYY-MM */
export const CUSTOMER_BILLING_LEDGER_PREFIX = 'DAIRY_CUSTOMER_BILL_LEDGER_V1';


/** In-app notifications for all three apps; rows carry their own audience. */
export const NOTIFICATIONS_STORE_KEY = 'DAIRY_NOTIFICATIONS_V1';

/** Messages from the dairy to customers (wishes, notices, delivery updates), with optional pictures or videos. */
export const ANNOUNCEMENTS_STORE_KEY = 'DAIRY_ANNOUNCEMENTS_V1';

/** Chat messages between each customer and the dairy. */
export const CHAT_STORE_KEY = 'DAIRY_CHAT_V1';

/** Offers the dairy runs (price offers, combos, bill discounts, subscription rewards), shared by every app. */
export const OFFERS_STORE_KEY = 'DAIRY_OFFERS_V1';
