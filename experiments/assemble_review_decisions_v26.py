"""Reproducible local assembly only. No wallet or network functionality."""
import ast
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "experiments/provider_review_decisions_v26.py"
CONTRACT = ROOT / "experiments/contracts/provider_review_decisions_v26.py"
INPUT_HELPERS = ROOT / "experiments/provider_review_facts_v19.py"
INPUT_SHA256 = "12cb00c477629284411f60e1cb49adc0f47a7cb7a5299b480ba540bc1fe33f07"
SDK = "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng"

ENTRYPOINT = '''

class ProviderReviewDecisionsV26(gl.contract.Contract):
    state: str

    def __init__(self, evidence_json: str):
        if gl.message.value != u256(0):
            raise gl.vm.UserError("Review accepts no payment")
        ctx = context(evidence_json)
        if not ctx["complete"]:
            raise gl.vm.UserError("Incomplete evidence; no assessment")

        def agree_condition(key):
            def model(prompt):
                return gl.nondet.exec_prompt(prompt, response_format="json")

            def propose():
                return assess_condition(ctx, key, model)

            def native_audit(request):
                # Exact internal path from the pinned Studio Next SDK, not the
                # older docs' genlayer.gl import path. The SDK template decoder
                # returns native bool; strings/dicts/integers cannot vote yes.
                import genlayer._internal.on_chain.gl_call as gl_call
                from genlayer.nondet import _decode_nondet
                return gl_call.gl_call_generic({"ExecPromptTemplate": request}, _decode_nondet).get()

            def validator(result):
                if not isinstance(result, gl.vm.Return):
                    return False
                diagnostics = []
                accepted = validate_condition(ctx, key, result.calldata, model, native_audit, diagnostics)
                if diagnostics:
                    print("RECALL_V25_VALIDATION:" + canonical(diagnostics))
                return accepted

            # Each condition has its OWN consensus boundary. Do not require one
            # validator vote to match every independent condition at once.
            return gl.vm.run_nondet(propose, validator)

        answers = [agree_condition(key) for key in ctx["schema"]]
        assessment = assemble(ctx, answers)
        self.state = canonical({"version": 26, "kind": "provider-review-decisions-candidate",
            "release_cleared": False, "protocol_sha256": PROTOCOL_SHA256,
            "account": gl.message.sender_address.as_hex, "digest": ctx["digest"],
            "evidence_json": evidence_json, "complete": True,
            "review_status": "completed", "assessment": assessment})

    @gl.public.view
    def snapshot(self) -> dict:
        return json.loads(self.state)
'''


def runtime_core():
    source = INPUT_HELPERS.read_text()
    assert hashlib.sha256(source.encode()).hexdigest() == INPUT_SHA256, "Pinned input helpers changed"
    names = {"canonical", "require", "passages", "context", "evidence_index", "FIELDS", "CRITERIA"}
    helpers = [ast.get_source_segment(source, node) for node in ast.parse(source).body
        if isinstance(node, ast.FunctionDef) and node.name in names
        or isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in names for t in node.targets)]
    core = ENGINE.read_text()
    start = core.index("# BEGIN PINNED INPUT HELPERS")
    end = core.index("# END PINNED INPUT HELPERS") + len("# END PINNED INPUT HELPERS")
    return core[:start] + "import math\n\n" + "\n\n".join(helpers) + "\n\nbase_context = context\n" + core[end:]


def render_contract():
    core = runtime_core()
    return ('# v0.3.0\n# { "Depends": "' + SDK + '" }\n\n'
        '# LOCAL CANDIDATE: not release-cleared; no implicit deployment authorization.\n'
        'import genlayer as gl\nfrom genlayer.types import u256\n\n'
        'PROTOCOL_SHA256 = "' + hashlib.sha256(core.encode()).hexdigest() + '"\n\n' + core + ENTRYPOINT)


if __name__ == "__main__":
    import sys
    if "--source" in sys.argv:
        print(render_contract(), end="")
    else:
        assert CONTRACT.read_text() == render_contract(), "Source drift"
        print(json.dumps({"matches": True, "release_cleared": False,
            "protocol_sha256": hashlib.sha256(runtime_core().encode()).hexdigest(),
            "contract_sha256": hashlib.sha256(CONTRACT.read_bytes()).hexdigest()}))
