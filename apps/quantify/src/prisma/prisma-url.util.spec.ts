import { prismaPoolParamsFromEnv, withPrismaPoolParams } from './prisma-url.util'

describe('withPrismaPoolParams', () => {
  it('appends Prisma pool parameters to PostgreSQL URLs', () => {
    expect(
      withPrismaPoolParams('postgresql://user:pass@localhost:5432/quantify', {
        connectionLimit: 50,
        poolTimeout: 10,
      }),
    ).toBe('postgresql://user:pass@localhost:5432/quantify?connection_limit=50&pool_timeout=10')
  })

  it('does not override existing parameters', () => {
    expect(
      withPrismaPoolParams(
        'postgresql://user:pass@localhost:5432/quantify?connection_limit=20&pool_timeout=5&schema=public',
        {
          connectionLimit: 50,
          poolTimeout: 10,
        },
      ),
    ).toBe('postgresql://user:pass@localhost:5432/quantify?connection_limit=20&pool_timeout=5&schema=public')
  })

  it.each([
    [''],
    ['__SET_IN_env.local__'],
    ['not a url'],
  ])('returns %p unchanged when it cannot safely update the URL', url => {
    expect(
      withPrismaPoolParams(url, {
        connectionLimit: 50,
        poolTimeout: 10,
      }),
    ).toBe(url)
  })
})

describe('prismaPoolParamsFromEnv', () => {
  it('reads positive Prisma pool values from quantify env', () => {
    expect(prismaPoolParamsFromEnv({
      QUANTIFY_PRISMA_CONNECTION_LIMIT: '64',
      QUANTIFY_PRISMA_POOL_TIMEOUT: '12',
    })).toEqual({
      connectionLimit: 64,
      poolTimeout: 12,
    })
  })

  it('falls back to production defaults for invalid values', () => {
    expect(prismaPoolParamsFromEnv({
      QUANTIFY_PRISMA_CONNECTION_LIMIT: '0',
      QUANTIFY_PRISMA_POOL_TIMEOUT: 'nope',
    })).toEqual({
      connectionLimit: 50,
      poolTimeout: 10,
    })
  })
})
