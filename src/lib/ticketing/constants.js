export const TICKET_TOKEN_PREFIX = 'bt1';
export const TICKET_VERSION = 1;

/** @typedef {'NONE' | 'CHECKED_IN' | 'BOARDED'} CheckInStatus */
export const CHECK_IN = {
  NONE: 'NONE',
  CHECKED_IN: 'CHECKED_IN',
  BOARDED: 'BOARDED',
};

export const BOARDING_STATUS = CHECK_IN;

export const SCAN_RESULT = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
};
