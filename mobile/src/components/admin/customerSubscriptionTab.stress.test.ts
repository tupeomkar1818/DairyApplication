import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomerResponse } from '@/src/domain/customers/dtos';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const FIXED_NOW = new Date('2026-05-15T10:00:00.000Z');
type ReactTestRendererInstance = ReturnType<typeof TestRenderer.create>;

const mocks = vi.hoisted(() => {
  const sampleCustomer: CustomerResponse = {
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
    nextDeliveryDate: '2026-05-16T00:00:00.000Z',
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
    subscription: [{ productName: 'Cow Milk', quantityLabel: '1 x 500 ml' }],
    subscriptionPlans: [
      {
        id: 'plan_1',
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
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ],
    // Add-ons are the shared order rows the customer app and the run sheet read.
    extraOrders: [
      {
        id: 'addon_1',
        orderDate: '2026-05-10',
        deliveryDate: '2026-05-10',
        productName: 'Curd',
        quantityLabel: '200 g',
        numberOfItems: 1,
        price: 20,
        status: 'Pending',
        createdAt: '2026-05-09T00:00:00.000Z',
        updatedAt: '2026-05-09T00:00:00.000Z',
      },
    ],
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-15T00:00:00.000Z',
  };

  return {
    sampleCustomer,
    updateCustomer: vi.fn().mockResolvedValue(undefined),
    onViewDetailedBill: vi.fn(),
  };
});

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
    Alert: { alert: vi.fn() },
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
    ({ children, visible = true, disabled, ...props }: any) =>
      visible && !disabled ? ReactModule.createElement(name, props, children) : null;

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

vi.mock('@/src/components/admin/CustomerSubscriptionPlansEditor', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    CustomerSubscriptionPlansEditor: () => ReactModule.createElement('CustomerSubscriptionPlansEditor'),
  };
});

vi.mock('@/src/components/admin/CustomerSubscriptionHistoryCards', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    CustomerSubscriptionHistoryCards: () => ReactModule.createElement('CustomerSubscriptionHistoryCards'),
  };
});

vi.mock('@/src/components/admin/MilkSubscriptionLineCompactFields', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  return {
    MilkSubscriptionLineCompactFields: () => ReactModule.createElement('MilkSubscriptionLineCompactFields'),
  };
});

vi.mock('@/src/hooks/customers', () => ({
  useUpdateCustomer: () => ({ mutateAsync: mocks.updateCustomer, isPending: false }),
}));

vi.mock('@/src/domain/notifications/events', () => ({
  notifyOrderPlaced: vi.fn(),
  notifyOrderCancelled: vi.fn(),
}));

vi.mock('@/src/hooks/offers/useOffers', () => ({
  useOffers: () => ({ all: [], isLoading: false, isError: false, refetch: () => undefined }),
}));

vi.mock('@/src/hooks/products/useProducts', () => ({
  useProducts: () => ({
    data: {
      items: [
        {
          id: 'prod_1',
          name: 'Cow Milk',
          productType: 'Milk',
          price: 30,
          discountPrice: 0,
          unit: 'Packet',
          variants: ['500 ml', '1 Litre'],
          isActive: true,
        },
        {
          id: 'prod_2',
          name: 'Curd',
          productType: 'Grocery Product',
          price: 20,
          discountPrice: 0,
          unit: 'Cup',
          variants: ['200 g', '400 g'],
          isActive: true,
        },
      ],
    },
  }),
}));

import { CustomerSubscriptionTab } from '@/src/components/admin/CustomerSubscriptionTab';

function collectNodeText(node: ReactTestInstance): string {
  return node.children
    .map((child: string | ReactTestInstance) => {
      if (Object.prototype.toString.call(child) === '[object String]') return child;
      return collectNodeText(child);
    })
    .join('')
    .trim();
}

function pressables(root: ReactTestInstance) {
  return root.findAll(
    (node: ReactTestInstance) => node.type === 'Pressable' && typeof node.props.onPress === 'function',
  );
}

function pressByA11y(root: ReactTestInstance, label: string) {
  const node = pressables(root).find((p: ReactTestInstance) => p.props.accessibilityLabel === label);
  if (!node) throw new Error(`Pressable not found: ${label}`);
  act(() => {
    node.props.onPress();
  });
  return node;
}

function pressByText(root: ReactTestInstance, text: string) {
  const node = pressables(root).find((p: ReactTestInstance) => collectNodeText(p).includes(text));
  if (!node) throw new Error(`Pressable not found with text: ${text}`);
  act(() => {
    node.props.onPress();
  });
  return node;
}

function pressButton(root: ReactTestInstance, label: string) {
  const btn = root
    .findAll((node: ReactTestInstance) => node.type === 'Button' && typeof node.props.onPress === 'function')
    .find((node: ReactTestInstance) => collectNodeText(node) === label);
  if (!btn) throw new Error(`Button not found: ${label}`);
  act(() => {
    btn.props.onPress();
  });
  return btn;
}

function pressCalendarDay(root: ReactTestInstance, dayNum: number) {
  const dayPressable = pressables(root).find((p: ReactTestInstance) => {
    const text = collectNodeText(p);
    return text === String(dayNum) || text.startsWith(`${dayNum}`);
  });
  if (!dayPressable) throw new Error(`Calendar day not found: ${dayNum}`);
  act(() => {
    dayPressable.props.onPress();
  });
}

function renderTab() {
  let renderer: ReactTestRendererInstance;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(CustomerSubscriptionTab, {
        customer: mocks.sampleCustomer,
        customerId: 'cust_1',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        scheme: 'light',
        onViewDetailedBill: mocks.onViewDetailedBill,
      }),
    );
  });
  return renderer!;
}

describe('CustomerSubscriptionTab interaction stress', () => {
  beforeEach(() => {
    vi.setSystemTime(FIXED_NOW);
    mocks.updateCustomer.mockClear();
    mocks.onViewDetailedBill.mockClear();
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('month prev/next and picker open-close without crash', () => {
    const renderer = renderTab();
    const root = renderer.root;

    pressByA11y(root, 'Previous month');
    pressByA11y(root, 'Next month');
    pressByText(root, 'May 2026');
    expect(collectNodeText(root)).toContain('Product subscription month');
    pressButton(root, 'Close');
    expect(collectNodeText(root)).not.toContain('Product subscription month');
  });

  it('opens day sheet on calendar tap and closes via header and footer', () => {
    const renderer = renderTab();
    const root = renderer.root;

    pressCalendarDay(root, 10);
    expect(collectNodeText(root)).toContain('10 May 2026');

    pressByA11y(root, 'Close');
    expect(collectNodeText(root)).not.toContain('SCHEDULED DELIVERY DETAILS');

    pressCalendarDay(root, 12);
    pressByText(root, 'Close');
    expect(collectNodeText(root)).not.toContain('12 May 2026');
  });

  it('lets the admin add an add-on on a day with no subscription, as the customer can', () => {
    let renderer: ReactTestRendererInstance;
    const customerNoPlans = { ...mocks.sampleCustomer, subscriptionPlans: [], subscription: [] };
    act(() => {
      renderer = TestRenderer.create(
        React.createElement(CustomerSubscriptionTab, {
          customer: customerNoPlans,
          customerId: 'cust_1',
          isMobile: false,
          isTablet: false,
          isDesktop: true,
          scheme: 'light',
        }),
      );
    });
    const root = renderer!.root;

    pressCalendarDay(root, 11);
    pressByText(root, 'Add add-on product');
    expect(collectNodeText(root)).not.toContain('Subscription required');
    expect(root.findAll((n: ReactTestInstance) => n.type === 'MilkSubscriptionLineCompactFields').length).toBe(1);
  });

  it('removing an add-on cancels the shared order row', () => {
    const renderer = renderTab();
    const root = renderer.root;

    pressCalendarDay(root, 10);
    pressByText(root, 'Delete');
    expect(root.findAll((n: ReactTestInstance) => n.type === 'DialogTitle' && collectNodeText(n) === 'Remove add-on?').length).toBe(1);
    pressButton(root, 'Remove');
    expect(mocks.updateCustomer).toHaveBeenCalledWith({
      id: 'cust_1',
      data: { extraOrders: [expect.objectContaining({ id: 'addon_1', status: 'Cancelled' })] },
    });
  });

  it('view detailed bill button fires callback', () => {
    const renderer = renderTab();
    pressByText(renderer.root, 'View Detailed Bill');
    expect(mocks.onViewDetailedBill).toHaveBeenCalledTimes(1);
  });

});
