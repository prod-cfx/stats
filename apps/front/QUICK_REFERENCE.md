# 快速参考指南

## Toast 通知使用

```typescript
import { useToast } from '@/components/ui/toast'

function MyComponent() {
  const { success, error, warning, info } = useToast()
  
  // 成功通知
  success('操作成功', '数据已保存')
  
  // 错误通知
  error('操作失败', '请稍后重试')
  
  // 警告通知
  warning('注意', '此操作不可撤销')
  
  // 信息通知
  info('提示', '新功能已上线')
}
```

## 加载状态使用

```typescript
import { LoadingState, Spinner, Skeleton } from '@/components/ui/loading'

// 1. 智能加载包装器
<LoadingState
  isLoading={loading}
  error={error}
  loadingFallback={<Spinner />}
  errorFallback={<ErrorMessage />}
>
  <YourContent />
</LoadingState>

// 2. 骨架屏
<Skeleton width="100%" height="20px" />
<StrategyCardSkeleton />
<TableRowSkeleton columns={5} />

// 3. 按钮加载
<button disabled={loading}>
  {loading && <ButtonSpinner />}
  提交
</button>
```

## 数据获取 Hooks

```typescript
import { useAsync, useMutation } from '@/hooks/use-async'
import { useStrategiesPage, useSubscribeStrategy } from '@/hooks/use-strategies'

// 1. 获取数据
const { data, loading, error, execute } = useAsync(() => fetchData())

// 2. 使用策略 Hook
const { data: strategies, loading } = useStrategiesPage()
const { data: strategy } = useStrategyDetail(id)
const { data: myStrategies } = useMyStrategies()

// 3. 修改数据
const { mutate, loading } = useMutation(updateData, {
  onSuccess: (data) => {
    success('更新成功')
  },
  onError: (error) => {
    showError('更新失败', error.message)
  }
})

// 调用
await mutate({ id: '1', name: 'New Name' })
```

## 错误处理最佳实践

```typescript
try {
  await apiCall()
  success('操作成功')
} catch (error) {
  // 1. 认证错误
  if (error instanceof AuthenticationError) {
    showError('请先登录')
    router.push('/login')
    return
  }
  
  // 2. 通用错误
  const message = getErrorMessage(error)
  showError('操作失败', message)
}
```

## 页面模式

```typescript
'use client'

import { useAsync } from '@/hooks/use-async'
import { LoadingState, Skeleton } from '@/components/ui/loading'

export default function MyPage() {
  const { data, loading, error } = useAsync(fetchPageData)
  
  return (
    <LoadingState
      isLoading={loading}
      error={error}
      loadingFallback={<Skeleton height={400} />}
    >
      {data && <Content data={data} />}
    </LoadingState>
  )
}
```

## 组件最佳实践

### 按钮状态
```typescript
<button
  onClick={handleSubmit}
  disabled={loading}
  className="..."
>
  {loading && <ButtonSpinner />}
  {loading ? '提交中...' : '提交'}
</button>
```

### 列表加载
```typescript
<LoadingState
  isLoading={loading}
  loadingFallback={
    <>
      <ItemSkeleton />
      <ItemSkeleton />
      <ItemSkeleton />
    </>
  }
>
  {items.map(item => <Item key={item.id} {...item} />)}
</LoadingState>
```

### 空状态
```typescript
<EmptyState
  icon={<Icon />}
  title="暂无数据"
  description="还没有任何内容"
  action={
    <button onClick={handleCreate}>
      创建第一个
    </button>
  }
/>
```
