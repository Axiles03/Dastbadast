/// <reference types="nativewind/types" />

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
    key?: string | number;
  }
  interface TextProps {
    className?: string;
    key?: string | number;
  }
}