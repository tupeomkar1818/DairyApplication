import type { IAuthService } from '@/src/domain/auth/service.interface';
import { AuthServiceApi } from '@/src/domain/auth/service.api';
import { AuthServiceMock } from '@/src/domain/auth/service.mock';
import type { IProductService } from '@/src/domain/products/service.interface';
import { ProductServiceApi } from '@/src/domain/products/service.api';
import { ProductServiceMock } from '@/src/domain/products/service.mock';
import type { IProductCategoryService } from '@/src/domain/productCategories/service.interface';
import { ProductCategoryServiceMock } from '@/src/domain/productCategories/service.mock';
import type { ICustomerService } from '@/src/domain/customers/service.interface';
import { CustomerServiceApi } from '@/src/domain/customers/service.api';
import { CustomerServiceMock } from '@/src/domain/customers/service.mock';
import type { IDeliveryBoyService } from '@/src/domain/deliveryBoys/service.interface';
import { DeliveryBoyServiceApi } from '@/src/domain/deliveryBoys/service.api';
import { DeliveryBoyServiceMock } from '@/src/domain/deliveryBoys/service.mock';
import type { IAnnouncementService } from '@/src/domain/announcements/service.interface';
import { AnnouncementServiceApi } from '@/src/domain/announcements/service.api';
import { AnnouncementServiceMock } from '@/src/domain/announcements/service.mock';
import type { IChatService } from '@/src/domain/chat/service.interface';
import { ChatServiceApi } from '@/src/domain/chat/service.api';
import { ChatServiceMock } from '@/src/domain/chat/service.mock';
import type { INotificationService } from '@/src/domain/notifications/service.interface';
import { NotificationServiceApi } from '@/src/domain/notifications/service.api';
import { NotificationServiceMock } from '@/src/domain/notifications/service.mock';
import type { IMediaService } from '@/src/domain/media/service.interface';
import { MediaServiceApi } from '@/src/domain/media/service.api';
import type { IPushService } from '@/src/domain/push/service.interface';
import { PushServiceApi } from '@/src/domain/push/service.api';
import type { IOfferService } from '@/src/domain/offers/service.interface';
import { OfferServiceApi } from '@/src/domain/offers/service.api';
import { OfferServiceMock } from '@/src/domain/offers/service.mock';
import type { ISubscriptionScheduleService } from '@/src/domain/subscriptions/service.interface';
import { SubscriptionScheduleServiceMock } from '@/src/domain/subscriptions/service.mock';
import type { IFaqService } from '@/src/domain/faq/service.interface';
import { FaqServiceMock } from '@/src/domain/faq/service.mock';
import type { IContactAdminService } from '@/src/domain/contactAdmin/service.interface';
import { ContactAdminServiceMock } from '@/src/domain/contactAdmin/service.mock';
import type { IPrivacyPolicyService } from '@/src/domain/privacyPolicy/service.interface';
import { PrivacyPolicyServiceMock } from '@/src/domain/privacyPolicy/service.mock';
import type { IAdminDashboardService } from '@/src/domain/adminDashboard/service.interface';
import { AdminDashboardServiceApi } from '@/src/domain/adminDashboard/service.api';
import { AdminDashboardServiceMock } from '@/src/domain/adminDashboard/service.mock';
import type { IProfileService } from '@/src/domain/profile/service.interface';
import { ProfileServiceApi } from '@/src/domain/profile/service.api';
import { ProfileServiceMock } from '@/src/domain/profile/service.mock';

type ServiceMode = 'mock' | 'api';

/**
 * 'mock' keeps every record on this phone — the app as it has always run, with no server needed.
 *
 * 'api' talks to the dairy's server at `EXPO_PUBLIC_API_BASE_URL` for the areas that are on it — signing in,
 * customers, products, the delivery team, offers, announcements, chat, notifications, the dairy's own settings and
 * everybody's own profile — so every phone sees the same records. The few areas left keep their data on the phone
 * until they move too, which is why the app keeps working throughout.
 */

const SERVICE_MODE = (process.env.EXPO_PUBLIC_SERVICE_MODE ?? 'mock') as ServiceMode;

function resolveAuthService(): IAuthService {
  switch (SERVICE_MODE) {
    case 'api':
      return new AuthServiceApi();
    case 'mock':
    default:
      return new AuthServiceMock();
  }
}

function resolveProductService(): IProductService {
  switch (SERVICE_MODE) {
    case 'api':
      return new ProductServiceApi();
    case 'mock':
    default:
      return new ProductServiceMock();
  }
}

function resolveProductCategoryService(): IProductCategoryService {
  switch (SERVICE_MODE) {
    // Not on the server yet (server/README.md): this area keeps its records on the phone.
    case 'api':
    case 'mock':
    default:
      return new ProductCategoryServiceMock();
  }
}

function resolveCustomerService(): ICustomerService {
  switch (SERVICE_MODE) {
    case 'api':
      return new CustomerServiceApi();
    case 'mock':
    default:
      return new CustomerServiceMock();
  }
}

function resolveDeliveryBoyService(): IDeliveryBoyService {
  switch (SERVICE_MODE) {
    case 'api':
      return new DeliveryBoyServiceApi();
    case 'mock':
    default:
      return new DeliveryBoyServiceMock();
  }
}

function resolveOfferService(): IOfferService {
  switch (SERVICE_MODE) {
    case 'api':
      return new OfferServiceApi();
    case 'mock':
    default:
      return new OfferServiceMock();
  }
}

function resolveAnnouncementService(): IAnnouncementService {
  switch (SERVICE_MODE) {
    case 'api':
      return new AnnouncementServiceApi();
    case 'mock':
    default:
      return new AnnouncementServiceMock();
  }
}

function resolveChatService(): IChatService {
  switch (SERVICE_MODE) {
    case 'api':
      return new ChatServiceApi();
    case 'mock':
    default:
      return new ChatServiceMock();
  }
}

function resolveNotificationService(): INotificationService {
  switch (SERVICE_MODE) {
    case 'api':
      return new NotificationServiceApi();
    case 'mock':
    default:
      return new NotificationServiceMock();
  }
}

/**
 * Pictures go to the dairy's server where there is one; a phone keeping its own records keeps the picture as it
 * was picked (see `uploadPicture`).
 */
function resolveMediaService(): IMediaService | undefined {
  return SERVICE_MODE === 'api' ? new MediaServiceApi() : undefined;
}

/**
 * Push only exists with the dairy's server to send it. A phone keeping its own records schedules the evening
 * reminder on the phone itself instead (`deviceReminders`), so there is nothing to register.
 */
function resolvePushService(): IPushService | undefined {
  return SERVICE_MODE === 'api' ? new PushServiceApi() : undefined;
}

function resolveSubscriptionScheduleService(): ISubscriptionScheduleService {
  switch (SERVICE_MODE) {
    // Not on the server yet (server/README.md): this area keeps its records on the phone.
    case 'api':
    case 'mock':
    default:
      return new SubscriptionScheduleServiceMock();
  }
}

function resolveFaqService(): IFaqService {
  switch (SERVICE_MODE) {
    // Not on the server yet (server/README.md): this area keeps its records on the phone.
    case 'api':
    case 'mock':
    default:
      return new FaqServiceMock();
  }
}

function resolveContactAdminService(): IContactAdminService {
  switch (SERVICE_MODE) {
    // Not on the server yet (server/README.md): this area keeps its records on the phone.
    case 'api':
    case 'mock':
    default:
      return new ContactAdminServiceMock();
  }
}

function resolvePrivacyPolicyService(): IPrivacyPolicyService {
  switch (SERVICE_MODE) {
    // Not on the server yet (server/README.md): this area keeps its records on the phone.
    case 'api':
    case 'mock':
    default:
      return new PrivacyPolicyServiceMock();
  }
}

function resolveAdminDashboardService(): IAdminDashboardService {
  switch (SERVICE_MODE) {
    case 'api':
      return new AdminDashboardServiceApi();
    case 'mock':
    default:
      return new AdminDashboardServiceMock();
  }
}

function resolveProfileService(): IProfileService {
  switch (SERVICE_MODE) {
    case 'api':
      return new ProfileServiceApi();
    case 'mock':
    default:
      return new ProfileServiceMock();
  }
}

export const services = {
  auth: resolveAuthService(),
  faq: resolveFaqService(),
  contactAdmin: resolveContactAdminService(),
  privacyPolicy: resolvePrivacyPolicyService(),
  adminDashboard: resolveAdminDashboardService(),
  profile: resolveProfileService(),
  products: resolveProductService(),
  productCategories: resolveProductCategoryService(),
  customers: resolveCustomerService(),
  deliveryBoys: resolveDeliveryBoyService(),
  offers: resolveOfferService(),
  announcements: resolveAnnouncementService(),
  chat: resolveChatService(),
  notifications: resolveNotificationService(),
  push: resolvePushService(),
  media: resolveMediaService(),
  subscriptionSchedule: resolveSubscriptionScheduleService(),
};

