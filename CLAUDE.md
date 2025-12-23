# AI 助手强制约束（最高优先级）

> **⛔ 绝对禁止使用 `pnpm`、`npm`、`yarn`、`npx` 等包管理器命令**
>
> 本项目所有命令必须通过 `./scripts/dx` 执行。违反此规则会浪费大量 token 并可能破坏环境一致性。

| 禁止命令 | 正确替代 |
| --- | --- |
| `pnpm install` | 无需手动安装，dx 自动处理 |
| `pnpm lint` / `npm run lint` | `./scripts/dx lint` |
| `pnpm build` / `npm run build` | `./scripts/dx build backend\|front\|admin --dev` |
| `pnpm test` / `npm test` | `./scripts/dx test e2e backend [file]` |
| `pnpm --filter @net/backend run prisma:*` | `./scripts/dx db generate\|format\|migrate` |
| `npx prisma ...` | `./scripts/dx db ...` |
| `pnpm start` / `npm start` | `./scripts/dx start backend\|front\|admin --dev` |

**唯一例外**：当 `./scripts/dx` 明确不支持某功能且用户明确要求时，才可使用 `pnpm nx ...`。

---

@ruler/development.md
@ruler/architecture.md
@ruler/conventions.md
@ruler/git-workflow.md
@ruler/linus-thinking.md
