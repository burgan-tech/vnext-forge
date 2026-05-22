export enum ViewType {
  Json = 1,
  Html = 2,
  Markdown = 3,
  DeepLink = 4,
  Http = 5,
  URN = 6,
}

export const ViewRenderer = {
  PseudoUi: 'pseudo-ui',
  Flutter: 'flutter',
  Angular: 'angular',
  Vue: 'vue',
  React: 'react',
  ReactNative: 'react-native',
  NativeIos: 'native-ios',
  NativeAndroid: 'native-android',
} as const;

export type ViewRendererValue = (typeof ViewRenderer)[keyof typeof ViewRenderer];
