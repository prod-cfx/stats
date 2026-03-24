/* eslint-disable perfectionist/sort-imports */
import type { AdminMenu } from '@/prisma/prisma.types'
import { AdminMenuType } from '@ai/shared'
import type { AdminUserInfoDto } from '../dto/admin-user-info.dto'

type MenuNode = AdminMenu & { children: MenuNode[] }

export const buildAuthorizedMenuTree = (
  menus: AdminMenu[],
  permissionCodes: Set<string>,
): AdminUserInfoDto['menus'] => {
  const allowAll = permissionCodes.has('*')
  const nodeMap = new Map<string, MenuNode>()
  const roots: MenuNode[] = []

  menus.forEach(menu => {
    nodeMap.set(menu.id, { ...menu, children: [] })
  })

  nodeMap.forEach(node => {
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(node)
        return
      }
    }
    roots.push(node)
  })

  const filterNode = (node: MenuNode): AdminUserInfoDto['menus'][number] | null => {
    const children = node.children
      .map(child => filterNode(child))
      .filter((child): child is AdminUserInfoDto['menus'][number] => Boolean(child))

    const nodeCode = node.code ?? null
    const nodeAllowed = allowAll || (nodeCode ? permissionCodes.has(nodeCode) : false)
    const shouldInclude =
      (node.type as string) === AdminMenuType.DIRECTORY ? nodeAllowed || children.length > 0 : nodeAllowed

    if (!shouldInclude) return null

    return {
      id: node.id,
      parentId: node.parentId ?? null,
      name: node.title,
      route: node.path ?? null,
      icon: node.icon ?? null,
      sortOrder: node.sort,
      code: nodeCode,
      type: node.type as AdminMenuType,
      children,
    }
  }

  return roots
    .map(root => filterNode(root))
    .filter((node): node is AdminUserInfoDto['menus'][number] => Boolean(node))
}


