import { RolesBuilder } from 'nest-access-control'

export enum AppRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

export enum AppResource {
  ROLE = 'role',
  SETTINGS = 'settings',
  ADMIN_USER = 'admin_user',
  ADMIN_MENU = 'admin_menu',
  PORTFOLIO_ACCOUNT = 'portfolio_account',
  STRATEGY_TEMPLATE = 'strategy_template',
  STRATEGY_INSTANCE = 'strategy_instance',
  LLM_STRATEGY = 'llm_strategy',
  LLM_STRATEGY_INSTANCE = 'llm_strategy_instance',
  MARKET_SYMBOL = 'market_symbol',
  DATA_PULL_TASK = 'data_pull_task',
  ORDERBOOK_CONFIG = 'orderbook_config',
  EXCHANGE_CONFIG = 'exchange_config',
}

export const RBAC_PERMISSIONS = new RolesBuilder()

RBAC_PERMISSIONS.grant(AppRole.USER)
  .createOwn(AppResource.PORTFOLIO_ACCOUNT)
  .readOwn(AppResource.PORTFOLIO_ACCOUNT)
  .updateOwn(AppResource.PORTFOLIO_ACCOUNT)

RBAC_PERMISSIONS.grant(AppRole.MODERATOR).extend(AppRole.USER)

RBAC_PERMISSIONS.grant(AppRole.ADMIN)
  .extend(AppRole.MODERATOR)
  .createAny(AppResource.PORTFOLIO_ACCOUNT)
  .readAny(AppResource.PORTFOLIO_ACCOUNT)
  .updateAny(AppResource.PORTFOLIO_ACCOUNT)
  .readAny(AppResource.STRATEGY_TEMPLATE)
  .createAny(AppResource.STRATEGY_TEMPLATE)
  .updateAny(AppResource.STRATEGY_TEMPLATE)
  .deleteAny(AppResource.STRATEGY_TEMPLATE)
  .readAny(AppResource.STRATEGY_INSTANCE)
  .createAny(AppResource.STRATEGY_INSTANCE)
  .updateAny(AppResource.STRATEGY_INSTANCE)
  .deleteAny(AppResource.STRATEGY_INSTANCE)
  .readAny(AppResource.LLM_STRATEGY)
  .createAny(AppResource.LLM_STRATEGY)
  .updateAny(AppResource.LLM_STRATEGY)
  .deleteAny(AppResource.LLM_STRATEGY)
  .readAny(AppResource.LLM_STRATEGY_INSTANCE)
  .createAny(AppResource.LLM_STRATEGY_INSTANCE)
  .updateAny(AppResource.LLM_STRATEGY_INSTANCE)
  .deleteAny(AppResource.LLM_STRATEGY_INSTANCE)
  .readAny(AppResource.MARKET_SYMBOL)
  .createAny(AppResource.MARKET_SYMBOL)
  .updateAny(AppResource.MARKET_SYMBOL)
  .deleteAny(AppResource.MARKET_SYMBOL)
  .readAny(AppResource.DATA_PULL_TASK)
  .createAny(AppResource.DATA_PULL_TASK)
  .updateAny(AppResource.DATA_PULL_TASK)
  .deleteAny(AppResource.DATA_PULL_TASK)
  .readAny(AppResource.ORDERBOOK_CONFIG)
  .createAny(AppResource.ORDERBOOK_CONFIG)
  .updateAny(AppResource.ORDERBOOK_CONFIG)
  .deleteAny(AppResource.ORDERBOOK_CONFIG)
  .readAny(AppResource.EXCHANGE_CONFIG)
  .createAny(AppResource.EXCHANGE_CONFIG)
  .updateAny(AppResource.EXCHANGE_CONFIG)
  .deleteAny(AppResource.EXCHANGE_CONFIG)
  .readAny(AppResource.ADMIN_MENU)
  .readAny(AppResource.ADMIN_USER)
  .readAny(AppResource.SETTINGS)
  .createAny(AppResource.SETTINGS)
  .updateAny(AppResource.SETTINGS)
  .deleteAny(AppResource.SETTINGS)

RBAC_PERMISSIONS.grant(AppRole.SUPER_ADMIN)
  .extend(AppRole.ADMIN)
  .readAny(AppResource.ROLE)
  .createAny(AppResource.ROLE)
  .updateAny(AppResource.ROLE)
  .deleteAny(AppResource.ROLE)
  .readAny(AppResource.ADMIN_USER)
  .createAny(AppResource.ADMIN_USER)
  .updateAny(AppResource.ADMIN_USER)
  .deleteAny(AppResource.ADMIN_USER)
  .readAny(AppResource.ADMIN_MENU)
  .createAny(AppResource.ADMIN_MENU)
  .updateAny(AppResource.ADMIN_MENU)
  .deleteAny(AppResource.ADMIN_MENU)


