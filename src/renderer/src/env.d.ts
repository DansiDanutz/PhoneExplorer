/// <reference types="vite/client" />

import type { PhoneAPI } from '../../shared/types';

declare global {
  interface Window {
    phone: PhoneAPI;
  }
}

export {};
