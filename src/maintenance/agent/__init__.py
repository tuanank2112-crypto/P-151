"""Plan 06 reasoning-agent package.

WP1 only ships the pure contract modules (`schema`, `inputs`) because `models.Case.agent_decision` needs
`AgentDecisionRecord`. This file stays docstring-only on purpose: importing anything here would create an import
cycle with `src.maintenance.models` (plan 06 Q20).
"""
