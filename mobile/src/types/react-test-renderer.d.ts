declare module 'react-test-renderer' {
  export type ReactTestInstance = any;
  export function act(callback: () => void | Promise<void>): void | Promise<void>;

  const TestRenderer: {
    create(element: any): any;
  };

  export default TestRenderer;
}
