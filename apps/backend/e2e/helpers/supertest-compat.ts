/* eslint-disable ts/no-require-imports */
// supertest 在 ts-jest(CJS) 环境下的导出兼容处理（使用具名导出避开 default 互操作问题）
export const supertestRequest: any = (require('supertest') as any).default || require('supertest')
