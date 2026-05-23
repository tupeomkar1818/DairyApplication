import type { IAuthService } from '@/src/domain/auth/service.interface';
import { AuthServiceMock } from '@/src/domain/auth/service.mock';
import type { IProductService } from '@/src/domain/products/service.interface';
import { ProductServiceMock } from '@/src/domain/products/service.mock';
import type { IProductCategoryService } from '@/src/domain/productCategories/service.interface';
import { ProductCategoryServiceMock } from '@/src/domain/productCategories/service.mock';
import type { ICustomerService } from '@/src/domain/customers/service.interface';
import { CustomerServiceMock } from '@/src/domain/customers/service.mock';
import type { IDeliveryBoyService } from '@/src/domain/deliveryBoys/service.interface';
import { DeliveryBoyServiceMock } from '@/src/domain/deliveryBoys/service.mock';
import type { ISubscriptionScheduleService } from '@/src/domain/subscriptions/service.interface';
import { SubscriptionScheduleServiceMock } from '@/src/domain/subscriptions/service.mock';
import type { IFaqService } from '@/src/domain/faq/service.interface';
import { FaqServiceMock } from '@/src/domain/faq/service.mock';
import type { IContactAdminService } from '@/src/domain/contactAdmin/service.interface';
import { ContactAdminServiceMock } from '@/src/domain/contactAdmin/service.mock';
import type { IPrivacyPolicyService } from '@/src/domain/privacyPolicy/service.interface';
import { PrivacyPolicyServiceMock } from '@/src/domain/privacyPolicy/service.mock';
import type { IAdminDashboardService } from '@/src/domain/adminDashboard/service.interface';
import { AdminDashboardServiceMock } from '@/src/domain/adminDashboard/service.mock';
import type { IProfileService } from '@/src/domain/profile/service.interface';
import { ProfileServiceMock } from '@/src/domain/profile/service.mock';

type ServiceMode = 'mock' | 'api';

const SERVICE_MODE = (process.env.EXPO_PUBLIC_SERVICE_MODE ?? 'mock') as ServiceMode;

function resolveAuthService(): IAuthService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new AuthServiceMock();
  }
}

function resolveProductService(): IProductService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new ProductServiceMock();
  }
}

function resolveProductCategoryService(): IProductCategoryService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new ProductCategoryServiceMock();
  }
}

function resolveCustomerService(): ICustomerService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new CustomerServiceMock();
  }
}

function resolveDeliveryBoyService(): IDeliveryBoyService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new DeliveryBoyServiceMock();
  }
}

function resolveSubscriptionScheduleService(): ISubscriptionScheduleService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new SubscriptionScheduleServiceMock();
  }
}

function resolveFaqService(): IFaqService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new FaqServiceMock();
  }
}

function resolveContactAdminService(): IContactAdminService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new ContactAdminServiceMock();
  }
}

function resolvePrivacyPolicyService(): IPrivacyPolicyService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new PrivacyPolicyServiceMock();
  }
}

function resolveAdminDashboardService(): IAdminDashboardService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
    case 'mock':
    default:
      return new AdminDashboardServiceMock();
  }
}

function resolveProfileService(): IProfileService {
  switch (SERVICE_MODE) {
    case 'api':
      throw new Error('API services not yet implemented — set EXPO_PUBLIC_SERVICE_MODE=mock');
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
  subscriptionSchedule: resolveSubscriptionScheduleService(),
};

