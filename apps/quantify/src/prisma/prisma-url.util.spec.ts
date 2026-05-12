import { withPrismaPoolParams } from './prisma-url.util'

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
