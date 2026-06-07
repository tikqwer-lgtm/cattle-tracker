/** Public window exports + ESM re-exports for tests */
import './part-3.js';

var g = typeof globalThis !== 'undefined' ? globalThis : {};
var SM = g.__chatCtx || {};

if (typeof globalThis !== 'undefined') {
  globalThis.buildChatDataContext = SM.buildChatDataContext;
  globalThis.isCalvingDataQuestion = SM.isCalvingDataQuestion;
  globalThis.isDataQuestion = SM.isDataQuestion;
  globalThis.detectChatDataTopics = SM.detectChatDataTopics;
  globalThis.detectQuestionWarnings = SM.detectQuestionWarnings;
}

export const normalizeQuestion = (...a) => SM.normalizeQuestion(...a);
export const isCalvingDataQuestion = (...a) => SM.isCalvingDataQuestion(...a);
export const isDataQuestion = (...a) => SM.isDataQuestion(...a);
export const detectChatDataTopics = (...a) => SM.detectChatDataTopics(...a);
export const detectQuestionWarnings = (...a) => SM.detectQuestionWarnings(...a);
export const looksLikeDataQuestion = (...a) => SM.looksLikeDataQuestion(...a);
export const parseMonthFromQuestion = (...a) => SM.parseMonthFromQuestion(...a);
export const parseDateRangeFromQuestion = (...a) => SM.parseDateRangeFromQuestion(...a);
export const buildChatDataContext = (...a) => SM.buildChatDataContext(...a);
export const formatMonthLabel = (...a) => SM.formatMonthLabel(...a);
export const countActiveEntries = (...a) => SM.countActiveEntries(...a);
export const collectProtocolTasks = (...a) => SM.collectProtocolTasks(...a);
export const buildHerdSection = (...a) => SM.buildHerdSection(...a);
