/* eslint-disable ts/no-require-imports */
// supertest 鍦?ts-jest(CJS) 鐜涓嬬殑瀵煎嚭鍏煎澶勭悊锛堜娇鐢ㄥ叿鍚嶅鍑洪伩鍏?default 浜掓搷浣滈棶棰橈級
export const supertestRequest: any = (require('supertest') as any).default || require('supertest')
