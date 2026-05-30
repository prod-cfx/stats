# Stage4 Staging Acceptance Report

- env: staging
- generatedAt: 2026-05-30T11:12:10.552Z
- corpus: 33/33 (100%)
- atom deploy-ready: 35/36 (97.22%)
- attempt-1 pass: 100%
- backtest/deploy IR hash parity: all pass cases equal

## Blockers

| blocker | count |
| --- | ---: |
| none | 0 |

## Category Coverage

| category | pass | total | pct |
| --- | ---: | ---: | ---: |
| action_lifecycle | 1 | 1 | 100% |
| add_position | 2 | 2 | 100% |
| data_source_binding | 5 | 5 | 100% |
| dca | 2 | 2 | 100% |
| execution_program | 1 | 1 | 100% |
| grid | 1 | 1 | 100% |
| mean_reversion | 3 | 3 | 100% |
| multi_symbol | 1 | 1 | 100% |
| multi_timeframe | 1 | 1 | 100% |
| portfolio_risk | 4 | 4 | 100% |
| simple_trend | 12 | 12 | 100% |

## Cases

| case | result | session | blocker | ir hash | deploy ir hash |
| --- | --- | --- | --- | --- | --- |
| stage4-simple-trend-ema-cross-stop-sizing | pass | stage4-staging-01-stage4-simple-trend-ema-cross-stop-sizing |  | sha256:6540cf282f90d5fe33c04a3356d8492754e6be02f63b1ca5c93dd966417fa7fa | sha256:6540cf282f90d5fe33c04a3356d8492754e6be02f63b1ca5c93dd966417fa7fa |
| stage4-simple-trend-ema-open-close-long | pass | stage4-staging-02-stage4-simple-trend-ema-open-close-long |  | sha256:e4c1ba141fc5694b9335928ef3a2f2f722646031c0e912fe467b86161ef83c7e | sha256:e4c1ba141fc5694b9335928ef3a2f2f722646031c0e912fe467b86161ef83c7e |
| stage4-simple-trend-short-trailing | pass | stage4-staging-03-stage4-simple-trend-short-trailing |  | sha256:9f12a029dea623e2798a0082e0f527baea9d55b3338da8563eeb8f26225fa08d | sha256:9f12a029dea623e2798a0082e0f527baea9d55b3338da8563eeb8f26225fa08d |
| stage4-mean-reversion-rsi-partial-tp | pass | stage4-staging-04-stage4-mean-reversion-rsi-partial-tp |  | sha256:86009c6a7f3d62f6b9063c5577e1b1384c12dae14b8d442339e482bbf3372c85 | sha256:86009c6a7f3d62f6b9063c5577e1b1384c12dae14b8d442339e482bbf3372c85 |
| stage4-mean-reversion-rsi-short-cycle | pass | stage4-staging-05-stage4-mean-reversion-rsi-short-cycle |  | sha256:c15fa6bf0b1031f0eb2572b72ce28464c6d4f28c8e05d4597bb2551eb9b332d6 | sha256:c15fa6bf0b1031f0eb2572b72ce28464c6d4f28c8e05d4597bb2551eb9b332d6 |
| stage4-mean-reversion-rsi-long-cycle | pass | stage4-staging-06-stage4-mean-reversion-rsi-long-cycle |  | sha256:5dfc52c25527075d936199761e8c94dda0519dc47526e062d48c13407f0dbf19 | sha256:5dfc52c25527075d936199761e8c94dda0519dc47526e062d48c13407f0dbf19 |
| stage4-breakout-volume-max-loss | pass | stage4-staging-07-stage4-breakout-volume-max-loss |  | sha256:e13870d7800f5505f20682e60017002d9c3e6ebc3d0ca9519e630d88e613ab6e | sha256:e13870d7800f5505f20682e60017002d9c3e6ebc3d0ca9519e630d88e613ab6e |
| stage4-breakout-volume-trailing-long | pass | stage4-staging-08-stage4-breakout-volume-trailing-long |  | sha256:da33643ea9da4b93533bc2df3ba1fa40cc0e7cc65f7f4fb83b87aebfb4296665 | sha256:da33643ea9da4b93533bc2df3ba1fa40cc0e7cc65f7f4fb83b87aebfb4296665 |
| stage4-breakout-pullback-hold-long | pass | stage4-staging-09-stage4-breakout-pullback-hold-long |  | sha256:a78be5b86b7678475a189476506a2665a01b4b842c1bae4ada2916bb8a6a4927 | sha256:a78be5b86b7678475a189476506a2665a01b4b842c1bae4ada2916bb8a6a4927 |
| stage4-breakdown-short-stop | pass | stage4-staging-10-stage4-breakdown-short-stop |  | sha256:887d538bc5d1d56053017f2a373b6f12a6b81216e3b73c0ae9b83c9ea95c5f7f | sha256:887d538bc5d1d56053017f2a373b6f12a6b81216e3b73c0ae9b83c9ea95c5f7f |
| stage4-time-window-trend-entry | pass | stage4-staging-11-stage4-time-window-trend-entry |  | sha256:7a930c031bbac0dfa0d245f7ba4de97db1560744afef366707875ee5a336f46c | sha256:7a930c031bbac0dfa0d245f7ba4de97db1560744afef366707875ee5a336f46c |
| stage4-trend-cooldown-after-stop | pass | stage4-staging-12-stage4-trend-cooldown-after-stop |  | sha256:50bc881b8ea90e299b87fdf4fa453cb01c9bdb9c2f944170e7fe86d4f397fd29 | sha256:50bc881b8ea90e299b87fdf4fa453cb01c9bdb9c2f944170e7fe86d4f397fd29 |
| stage4-short-trend-cooldown-after-stop | pass | stage4-staging-13-stage4-short-trend-cooldown-after-stop |  | sha256:e6d7836fa96d5feb2a9f84fc2982f80f4fe7437ac17d461d96c3f14a2181c509 | sha256:e6d7836fa96d5feb2a9f84fc2982f80f4fe7437ac17d461d96c3f14a2181c509 |
| stage4-grid-range-risk-sizing | pass | stage4-staging-14-stage4-grid-range-risk-sizing |  | sha256:0387efbb710243cf929daded68570c171dfae6cf020d39118df17a2cf9c6aaf9 | sha256:0387efbb710243cf929daded68570c171dfae6cf020d39118df17a2cf9c6aaf9 |
| stage4-dca-schedule-budget | pass | stage4-staging-15-stage4-dca-schedule-budget |  | sha256:26c9c6d28fe4662a3f8e741c5f15daa90a59a9b1591fab962b8b5a577e0bf2b9 | sha256:26c9c6d28fe4662a3f8e741c5f15daa90a59a9b1591fab962b8b5a577e0bf2b9 |
| stage4-dca-schedule-fixed-ratio | pass | stage4-staging-16-stage4-dca-schedule-fixed-ratio |  | sha256:238837d0aa0784d62998c38c69c10cebe6bf42558f6cee86a9b37e98c8a6cc14 | sha256:238837d0aa0784d62998c38c69c10cebe6bf42558f6cee86a9b37e98c8a6cc14 |
| stage4-add-position-pyramiding | pass | stage4-staging-17-stage4-add-position-pyramiding |  | sha256:7cce6b4618611f6f6ff9df180e1529759098112eec78fdf9dabc1299d2d5c222 | sha256:7cce6b4618611f6f6ff9df180e1529759098112eec78fdf9dabc1299d2d5c222 |
| stage4-short-add-position-pyramiding | pass | stage4-staging-18-stage4-short-add-position-pyramiding |  | sha256:020bf397d67942205cba9871c610c239b4e24b8a482d55dfe27a640d8d447eb9 | sha256:020bf397d67942205cba9871c610c239b4e24b8a482d55dfe27a640d8d447eb9 |
| stage4-portfolio-risk-drawdown-only | pass | stage4-staging-19-stage4-portfolio-risk-drawdown-only |  | sha256:6cc973c66d99767aa2cf8a15ffbacf70aab0642bd3df73342fda6ff9189ae6eb | sha256:6cc973c66d99767aa2cf8a15ffbacf70aab0642bd3df73342fda6ff9189ae6eb |
| stage4-portfolio-risk-short-drawdown-only | pass | stage4-staging-20-stage4-portfolio-risk-short-drawdown-only |  | sha256:86551da5019e1c249acb86d2944ea904b972c00a88eb4a4b8f550b69542645b9 | sha256:86551da5019e1c249acb86d2944ea904b972c00a88eb4a4b8f550b69542645b9 |
| stage4-indicator-threshold-long-filter | pass | stage4-staging-21-stage4-indicator-threshold-long-filter |  | sha256:0fbb51bd480d090b29b513ee110e3c0f1238c4a6ce423df0543a9554103d0150 | sha256:0fbb51bd480d090b29b513ee110e3c0f1238c4a6ce423df0543a9554103d0150 |
| stage4-indicator-threshold-short-filter | pass | stage4-staging-22-stage4-indicator-threshold-short-filter |  | sha256:7154d68adbbe14ceef289bd823d0c75ba899b9633f769b556e54fc281f8d0d98 | sha256:7154d68adbbe14ceef289bd823d0c75ba899b9633f769b556e54fc281f8d0d98 |
| stage4-portfolio-risk-drawdown-exposure | pass | stage4-staging-23-stage4-portfolio-risk-drawdown-exposure |  | sha256:bc34e8ce5ffdf472fb80220e73ea9e727a69e8317a6faded25f8b12a75a76add | sha256:bc34e8ce5ffdf472fb80220e73ea9e727a69e8317a6faded25f8b12a75a76add |
| stage4-multi-timeframe-trend-confirmation | pass | stage4-staging-24-stage4-multi-timeframe-trend-confirmation |  | sha256:17917dad23ba014ce770261b0d964c3d0222c5383e7fbcf11f20fb78cc4de57e | sha256:17917dad23ba014ce770261b0d964c3d0222c5383e7fbcf11f20fb78cc4de57e |
| stage4-multi-symbol-shared-risk | pass | stage4-staging-25-stage4-multi-symbol-shared-risk |  | sha256:73ecd64a4ce2cb2dc448499c21b34c2357feb24a36e9ba9f26f574512076f9ab | sha256:73ecd64a4ce2cb2dc448499c21b34c2357feb24a36e9ba9f26f574512076f9ab |
| stage4-regime-gate-trend-filter | pass | stage4-staging-26-stage4-regime-gate-trend-filter |  | sha256:1cfdce2ac1bac803fb13499a9cb9426f8c5e010b592c70203af60d5ea65cdd7d | sha256:1cfdce2ac1bac803fb13499a9cb9426f8c5e010b592c70203af60d5ea65cdd7d |
| stage4-orderbook-data-source-binding | pass | stage4-staging-27-stage4-orderbook-data-source-binding |  | sha256:7c1e9d8b18d4713ed448238327fdda1159ded93ba053fb26a4ff76cb6e971136 | sha256:7c1e9d8b18d4713ed448238327fdda1159ded93ba053fb26a4ff76cb6e971136 |
| stage4-funding-data-source-binding | pass | stage4-staging-28-stage4-funding-data-source-binding |  | sha256:cfb64e4e3807d8179ca36723f7107fcdbd2d79b4606fda36eda04d4191ba2698 | sha256:cfb64e4e3807d8179ca36723f7107fcdbd2d79b4606fda36eda04d4191ba2698 |
| stage4-open-interest-data-source-binding | pass | stage4-staging-29-stage4-open-interest-data-source-binding |  | sha256:182291413a5d40f8a966563aae5424ee43636cbe4bc8af29aa63296a849980d3 | sha256:182291413a5d40f8a966563aae5424ee43636cbe4bc8af29aa63296a849980d3 |
| stage4-liquidation-data-source-binding | pass | stage4-staging-30-stage4-liquidation-data-source-binding |  | sha256:2ea2412c12d24c5679d32e6a7b047e914f345c65882957d6d2a0e01429942b0c | sha256:2ea2412c12d24c5679d32e6a7b047e914f345c65882957d6d2a0e01429942b0c |
| stage4-webhook-event-source-binding | pass | stage4-staging-31-stage4-webhook-event-source-binding |  | sha256:55b9fe8892e9bd8277523bd2c7b56521056916d283c28331d7aa69c453ea7d36 | sha256:55b9fe8892e9bd8277523bd2c7b56521056916d283c28331d7aa69c453ea7d36 |
| stage4-action-reverse-position | pass | stage4-staging-32-stage4-action-reverse-position |  | sha256:0ea1a4641a184c308f0ff9aa0b7fdea4762581246a056432114bc169d1ee568f | sha256:0ea1a4641a184c308f0ff9aa0b7fdea4762581246a056432114bc169d1ee568f |
| stage4-program-fixed-grid-gated | pass | stage4-staging-33-stage4-program-fixed-grid-gated |  | sha256:bb6f0f7d243e4aa393632ff334e7b060556d3ddd06c0b3e5d60c7cbfd3b6eaf8 | sha256:bb6f0f7d243e4aa393632ff334e7b060556d3ddd06c0b3e5d60c7cbfd3b6eaf8 |

