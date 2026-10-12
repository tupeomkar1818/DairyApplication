import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => {
  const sampleCustomer = {
    id: 'cust_1',
    name: 'Test Customer',
    mobile: '9876543210',
    address: 'Street 1',
    societyName: 'Milk Residency',
    status: 'Active',
    deliveryTime: 'Morning',
    monthlyBillAmount: 1800,
    pendingAmount: 120,
    nextDueDate: '2026-05-31T00:00:00.000Z',
    lastPaymentDate: '2026-05-10T00:00:00.000Z',
    assignedDeliveryBoyName: 'Ravi',
    routeName: 'North Route',
    paymentType: 'UPI',
    billingType: 'Postpaid',
    subscriptionStatus: 'Active',
    subscriptionStartDate: '2026-05-01',
    subscriptionEndDate: '2026-05-31',
    discountAmount: 0,
    advanceBalance: 0,
    payments: [],
    deliveries: [],
    complaints: [],
    complaintActions: [],
    subscriptionPlans: [
      {
        productName: 'Cow Milk',
        numberOfItems: 1,
        quantityLabel: '500 ml',
        unitType: 'Packet',
        subscriptionKind: 'Monthly',
        productAdditionTag: 'Regular',
        deliveryTime: 'Morning',
        frequency: 'Daily',
        startDate: '01/05/2026',
        endDate: '31/05/2026',
        status: 'Active',
        originalPrice: 30,
        discountedPrice: 0,
        effectiveFinalPrice: 30,
      },
    ],
  };

  return {
    sampleCustomer,
    routerPush: vi.fn(),
    routerBack: vi.fn(),
    updateCustomerMutateAsync: vi.fn().mockResolvedValue(undefined),
    subscriptionTabRender: vi.fn(),
  };
});

vi.mock('expo-router', () => ({
  router: {
    push: mocks.routerPush,
    back: mocks.routerBack,
  },
  useLocalSearchParams: () => ({ id: 'cust_1' }),
  useNavigation: () => ({
    canGoBack: () => true,
  }),
}));

vi.mock('expo-linear-gradient', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    LinearGradient: ({ children, ...props }: any) => ReactModule.createElement('LinearGradient', props, children),
  };
});

vi.mock('@expo/vector-icons/MaterialCommunityIcons', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    default: (props: any) => ReactModule.createElement('MaterialCommunityIcons', props),
  };
});

vi.mock('react-native', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const host =
    (name: string) =>
    ({ children, ...props }: any) =>
      ReactModule.createElement(name, props, children instanceof Function ? children({ pressed: false }) : children);

  return {
    InteractionManager: {
      runAfterInteractions: (cb: () => void) => {
        cb();
        return { cancel: vi.fn() };
      },
    },
    Platform: {
      OS: 'android',
      select: (options: Record<string, unknown>) => options.android ?? options.default,
    },
    Pressable: host('Pressable'),
    ScrollView: host('ScrollView'),
    // The screen's shared month stepper renders react-native's own Text.
    Text: host('Text'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      hairlineWidth: 1,
    },
    View: host('View'),
    useColorScheme: () => 'light',
    useWindowDimensions: () => ({ width: 900, height: 1200, scale: 1, fontScale: 1 }),
  };
});

vi.mock('react-native-paper', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const host =
    (name: string) =>
    ({ children, visible = true, ...props }: any) =>
      visible ? ReactModule.createElement(name, props, children) : null;

  const Card = host('Card') as any;
  Card.Content = host('CardContent');

  const Dialog = host('Dialog') as any;
  Dialog.Title = host('DialogTitle');
  Dialog.Content = host('DialogContent');
  Dialog.Actions = host('DialogActions');

  return {
    Button: host('Button'),
    Card,
    Dialog,
    Portal: ({ children }: any) => ReactModule.createElement(ReactModule.Fragment, null, children),
    Snackbar: host('Snackbar'),
    Text: host('Text'),
    TextInput: host('TextInput'),
  };
});

vi.mock('@/src/components/admin/CustomerDetailOverview', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    CustomerDetailOverview: (props: any) => ReactModule.createElement('CustomerDetailOverview', props),
  };
});

vi.mock('@/src/components/shared/DetailProfileCard', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    DetailProfileCard: (props: any) => ReactModule.createElement('DetailProfileCard', props),
  };
});

vi.mock('@/src/components/admin/CustomerSubscriptionTab', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    CustomerSubscriptionTab: (props: any) => {
      mocks.subscriptionTabRender(props);
      return ReactModule.createElement('CustomerSubscriptionTab', props);
    },
  };
});

vi.mock('@/src/components/shared/DairyTactileScreenBackground', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    DairyTactileScreenBackground: ({ children }: any) => ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

vi.mock('@/src/components/admin/SubscriptionMonthCalendarGrid', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    buildCalendarCells: () => [],
    SubscriptionMonthCalendarGrid: (props: any) => ReactModule.createElement('SubscriptionMonthCalendarGrid', props),
  };
});

vi.mock('@/src/hooks/customers', () => ({
  useCustomer: () => ({ data: mocks.sampleCustomer }),
}));

vi.mock('@/src/hooks/customers/useCustomerDailyProductOrders', () => ({
  useCustomerDailyProductOrders: () => ({
    lines: [
      {
        id: 'line_1',
        dateYmd: '2026-05-10',
        productName: 'Curd',
        quantityLabel: '200 g',
        unitType: 'Cup',
        quantity: 1,
        createdAtIso: '2026-05-10T00:00:00.000Z',
      },
    ],
    ready: true,
    upsert: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock('@/src/hooks/customers/useCustomers', () => ({
  useUpdateCustomer: () => ({
    isPending: false,
    mutateAsync: mocks.updateCustomerMutateAsync,
  }),
}));

vi.mock('@/src/hooks/deliveryBoys', () => ({
  useDeliveryBoys: () => ({
    data: {
      items: [{ id: 'boy_1', fullName: 'Ravi', primaryRouteName: 'North Route' }],
    },
  }),
}));

// The screen reaches the service registry through the event helpers; this test only renders, so it is stubbed.
vi.mock('@/src/infrastructure/service-registry', () => ({
  services: {
    auth: { resetPin: async () => undefined },
    notifications: { list: async () => [], add: async () => undefined },
    announcements: { list: async () => [], save: async () => undefined },
    chat: { list: async () => [], send: async () => undefined },
  },
}));

// The screen lets the dairy forget somebody’s PIN; this test renders without a query client.
vi.mock('@/src/hooks/auth', () => ({
  useResetPin: () => ({ mutateAsync: async () => undefined, isPending: false }),
}));

vi.mock('@/src/hooks/offers/useOffers', () => ({
  useOffers: () => ({ all: [], isLoading: false, isError: false, refetch: () => undefined }),
}));

vi.mock('@/src/hooks/products/useProducts', () => ({
  useProducts: () => ({
    data: {
      items: [
        { id: 'prod_1', name: 'Cow Milk', price: 30, discountPrice: 0, isActive: true },
        { id: 'prod_2', name: 'Curd', price: 20, discountPrice: 0, isActive: true },
      ],
    },
  }),
}));

vi.mock('@/src/hooks/useScreenSafeInsets', () => ({
  useScreenSafeInsets: () => ({
    headerPaddingTop: 0,
    scrollPaddingBottom: (value: number) => value,
  }),
}));

import AdminCustomerDetailDashboard from '@/app/(admin)/customers-detail';

function collectNodeText(node: ReactTestInstance): string {
  return node.children
    .map((child: string | ReactTestInstance) => {
      if (Object.prototype.toString.call(child) === '[object String]') return child;
      return collectNodeText(child);
    })
    .join('')
    .trim();
}

function getTabPressable(root: ReactTestInstance, label: string) {
  const tabPressable = root
    .findAll((node: ReactTestInstance) => node.type === 'Pressable' && node.props.onPress instanceof Function)
    .find((node: ReactTestInstance) => collectNodeText(node) === label);

  if (!tabPressable) {
    throw new Error(`Could not find tab pressable for "${label}"`);
  }

  return tabPressable;
}

function pressTab(root: ReactTestInstance, label: string) {
  act(() => {
    getTabPressable(root, label).props.onPress();
  });
}

describe('AdminCustomerDetailDashboard tab stress flow', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset();
    mocks.routerBack.mockReset();
    mocks.updateCustomerMutateAsync.mockClear();
    mocks.subscriptionTabRender.mockClear();
  });

  it('survives 240 repeated tab switches without crashing', () => {
    let renderer: any;

    act(() => {
      renderer = TestRenderer.create(React.createElement(AdminCustomerDetailDashboard));
    });

    const tabOrder = ['Subscription', 'Billing', 'Payments', 'Customer Delivery', 'Complaints', 'Overview'];

    act(() => {
      for (let i = 0; i < 240; i += 1) {
        getTabPressable(renderer!.root, tabOrder[i % tabOrder.length]!).props.onPress();
      }
    });

    pressTab(renderer!.root, 'Subscription');

    expect(renderer!.root.findAllByType('CustomerSubscriptionTab')).toHaveLength(1);
    expect(mocks.subscriptionTabRender).toHaveBeenCalled();
  }, 15000);
});
