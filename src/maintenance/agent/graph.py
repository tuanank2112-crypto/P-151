"""The LangGraph flow of one Agent decision (plan 06, SPEC-P01 sections 1 and 8).

Each node is a pure function of the state (the work lives in `agent.py`); this file only wires them. Only the plain
`StateGraph` API is used: no checkpointer, no conversation memory, no async (SPEC-P01 section 8).

    rules_node -+-(rule EMERGENCY)------> finish_skip_node -> END
                +-(too large / no client)-> fallback_node ----> END
                +-> llm_node -(client error)-> fallback_node
                       +-> parse_node -(bad JSON/schema)-> fallback_node
                              +-> validate_node -> reconcile_node -> END
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from .baseline import RuleView
from .client import ClientReply
from .inputs import DecisionInput
from .schema import AgentDecision, AgentDecisionRecord
from .validate import Validated


class AgentState(TypedDict, total=False):
    data: DecisionInput
    rules: RuleView
    user: str  # the rendered user message (for the log)
    reply: ClientReply
    error: dict[str, Any]  # {"reason": fallback_reason, "latency_ms": float, "log_id": str | None}
    decision: AgentDecision
    log_id: str  # id of the ai_logger entry written for the model call
    validated: Validated
    record: AgentDecisionRecord


Node = Callable[[AgentState], dict[str, Any]]
Router = Callable[[AgentState], str]


@dataclass(frozen=True)
class GraphSteps:
    rules: Node
    llm: Node
    parse: Node
    validate: Node
    reconcile: Node
    finish_skip: Node
    fallback: Node
    after_rules: Router  # "skip" | "fallback" | "llm"
    after_llm: Router  # "fallback" | "parse"
    after_parse: Router  # "fallback" | "validate"


def build_graph(steps: GraphSteps):
    """Compile once; `invoke({"data": data})["record"]` is one decision."""
    graph = StateGraph(AgentState)
    graph.add_node("rules_node", steps.rules)
    graph.add_node("llm_node", steps.llm)
    graph.add_node("parse_node", steps.parse)
    graph.add_node("validate_node", steps.validate)
    graph.add_node("reconcile_node", steps.reconcile)
    graph.add_node("finish_skip_node", steps.finish_skip)
    graph.add_node("fallback_node", steps.fallback)

    graph.set_entry_point("rules_node")
    graph.add_conditional_edges(
        "rules_node",
        steps.after_rules,
        {"skip": "finish_skip_node", "fallback": "fallback_node", "llm": "llm_node"},
    )
    graph.add_conditional_edges("llm_node", steps.after_llm, {"fallback": "fallback_node", "parse": "parse_node"})
    graph.add_conditional_edges(
        "parse_node", steps.after_parse, {"fallback": "fallback_node", "validate": "validate_node"}
    )
    graph.add_edge("validate_node", "reconcile_node")
    graph.add_edge("reconcile_node", END)
    graph.add_edge("finish_skip_node", END)
    graph.add_edge("fallback_node", END)
    return graph.compile()
