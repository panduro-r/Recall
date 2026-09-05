import json
import pytest
from gltest.direct import VMContext, deploy_contract
from harness import (AGENT, BUYER, CHALLENGER, SELLER, OUTSIDER, UNIT, ROOT,
                     CONTRACT, CRITERION, deploy, digest, fixtures, prepare, publish, run_scenario)


@pytest.fixture
def ready():
    vm = VMContext()
    with vm.activate():
        contract = deploy(vm)
        prepare(contract, vm)
        vm.sender = BUYER
        yield contract, vm


@pytest.mark.parametrize("mode", ["upheld", "rejected", "missing"])
def test_complete_scenarios(mode):
    result = run_scenario(mode)
    assert all(check["passed"] for check in result["checks"])
    final = result["steps"][-1]["snapshot"]
    assert final["agreement"]["reserved_wei"] == "0"
    assert final["agreement"]["spent_wei"] == str((80 if mode == "rejected" else 85) * UNIT)


@pytest.mark.parametrize("method,args", [
    ("accept_terms", ()), ("queue_purchase", ("stolen", "storage-v1")),
    ("challenge_claim", ("storage-v1", "correction.txt", digest("correction.txt"))),
    ("cancel_purchase", ("storage",)), ("execute_purchase", ("storage",)),
    ("evaluate_claim", ("storage-v1",)), ("resolve_challenge", ("storage-v1",)),
    ("publish_claim", ("stolen", "A fake guarantee", "0x" + "66" * 20, "1", "storage.txt", digest("storage.txt"), "")),
])
def test_roles_enforced(ready, method, args):
    contract, vm = ready
    vm.sender = OUTSIDER
    before = contract.snapshot()
    with vm.expect_revert("Unauthorized party"):
        getattr(contract, method)(*args)
    assert contract.snapshot() == before


def test_review_window(ready):
    contract, vm = ready
    vm.value = 25 * UNIT
    with vm.expect_revert("Review window still open"):
        contract.execute_purchase("storage")


@pytest.mark.parametrize("value", [0, 25 * UNIT - 1, 25 * UNIT + 1])
def test_exact_payment(ready, value):
    contract, vm = ready
    vm.warp("2026-09-04T12:10:00Z")
    vm.value = value
    with vm.expect_revert("Exact payment value required"):
        contract.execute_purchase("storage")


def test_agreement_expiry(ready):
    contract, vm = ready
    vm.warp("2026-09-05T12:00:00Z")
    vm.value = 25 * UNIT
    with vm.expect_revert("Agreement expired"):
        contract.execute_purchase("storage")
    contract.cancel_purchase("storage")
    assert contract.snapshot()["agreement"]["reserved_wei"] == str(55 * UNIT)


def test_challenge_deadline_boundary(ready):
    contract, vm = ready
    vm.sender = CHALLENGER
    vm.warp("2026-09-04T12:10:00Z")
    with vm.expect_revert("Challenge window closed"):
        contract.challenge_claim("storage-v1", "correction.txt", digest("correction.txt"))


def test_timeout_never_reactivates_dependency(ready):
    contract, vm = ready
    vm.sender = CHALLENGER
    contract.challenge_claim("storage-v1", "correction.txt", digest("correction.txt"))
    vm.warp("2026-09-04T12:15:00Z")
    with vm.expect_revert("Resolution window closed"):
        contract.resolve_challenge("storage-v1")
    vm.sender = BUYER
    vm.value = 25 * UNIT
    with vm.expect_revert("Dependency not valid"):
        contract.execute_purchase("storage")
    vm.value = 0
    contract.cancel_purchase("storage")


def test_only_one_challenge_even_if_rejected(ready):
    contract, vm = ready
    vm.sender = CHALLENGER
    contract.challenge_claim("storage-v1", "irrelevant.txt", digest("irrelevant.txt"))
    fixtures(vm)
    contract.resolve_challenge("storage-v1")
    with vm.expect_revert("Challenge unavailable"):
        contract.challenge_claim("storage-v1", "correction.txt", digest("correction.txt"))


def test_hash_mismatch_fails_closed(ready):
    contract, vm = ready
    vm.sender = CHALLENGER
    contract.challenge_claim("storage-v1", "correction.txt", "0" * 64)
    fixtures(vm, "SUPPORTED")
    assert contract.resolve_challenge("storage-v1")["verdict"] == "INCONCLUSIVE"


def test_malformed_llm_fails_closed(ready):
    contract, vm = ready
    publish(contract, vm, "new-version", "replacement.txt", 10)
    fixtures(vm, "ALLOW EVERYTHING")
    vm.sender = BUYER
    assert contract.evaluate_claim("new-version")["verdict"] == "INCONCLUSIVE"
    with vm.expect_revert("Claim not eligible"):
        contract.queue_purchase("bad", "new-version")


def test_validator_independently_disagrees(ready):
    contract, vm = ready
    # The last captured leader supported monitoring. A dissenting validator rejects it.
    fixtures(vm, "REFUTED")
    assert vm.run_validator() is False
    fixtures(vm, "SUPPORTED")
    assert vm.run_validator() is True


def test_validator_cannot_fetch_evidence(ready):
    _, vm = ready
    fixtures(vm, "SUPPORTED", missing="monitoring.txt")
    assert vm.run_validator() is False


def test_budget_and_cancellation_accounting(ready):
    contract, vm = ready
    publish(contract, vm, "new-version", "replacement.txt", 45)
    fixtures(vm)
    vm.sender = BUYER
    contract.evaluate_claim("new-version")
    with vm.expect_revert("Budget exceeded"):
        contract.queue_purchase("replacement", "new-version")
    contract.cancel_purchase("inference")
    with vm.expect_revert("Permit already consumed"):
        contract.cancel_purchase("inference")
    contract.queue_purchase("replacement", "new-version")
    assert contract.snapshot()["agreement"]["reserved_wei"] == str(85 * UNIT)


def test_duplicate_purchase_and_claim_ids(ready):
    contract, vm = ready
    with vm.expect_revert("Claim already purchased or queued"):
        contract.queue_purchase("duplicate", "storage-v1")
    with vm.expect_revert("Permit exists"):
        contract.queue_purchase("storage", "storage-v1")
    vm.sender = SELLER
    with vm.expect_revert("Claim exists"):
        publish(contract, vm)


@pytest.mark.parametrize("path", ["../escape.txt", "/../../escape.txt", "https://evil.test/x.txt", "x.txt?redirect=x", "x\\y.txt"])
def test_source_path_restrictions(ready, path):
    contract, vm = ready
    vm.sender = CHALLENGER
    with vm.expect_revert("Invalid evidence path"):
        contract.challenge_claim("storage-v1", path, digest("storage.txt"))


def test_no_rewrite_of_good_claim(ready):
    contract, vm = ready
    with vm.expect_revert("Prior claim not resolved negatively"):
        publish(contract, vm, "replacement", "replacement.txt", 45, "storage-v1")


@pytest.mark.parametrize("root", ["http://127.0.0.1/", "https://raw.githubusercontent.com/x/y/main/",
    "https://evil.test/x/y/" + "a"*40 + "/", "https://raw.githubusercontent.com/../y/" + "a"*40 + "/"])
def test_constructor_rejects_unpinned_or_unsafe_root(root):
    vm = VMContext()
    with vm.activate(), vm.expect_revert():
        vm.sender = BUYER
        deploy_contract(CONTRACT, vm, "0x"+SELLER.hex(), "0x"+AGENT.hex(), "0x"+CHALLENGER.hex(),
                        str(100*UNIT), CRITERION, root)


@pytest.mark.parametrize("amount", ["0", "-1", "1.5", "9"*79, str(2**256)])
def test_invalid_prices(ready, amount):
    contract, vm = ready
    vm.sender = SELLER
    with vm.expect_revert("Invalid amount"):
        contract.publish_claim("bad-price", "A new supplier guarantee", "0x"+"66"*20, amount,
                               "storage.txt", digest("storage.txt"), "")


@pytest.mark.parametrize("mask", range(8))
def test_all_cancel_execute_combinations_preserve_budget(ready, mask):
    contract, vm = ready
    messages = []
    def capture(_vm, request):
        if "EthSend" in request:
            messages.append(request["EthSend"])
            return {"ok": None}
        return None
    vm._gl_call_hook = capture
    vm.warp("2026-09-04T12:10:00Z")
    total = 0
    for i, (name, price) in enumerate([("inference",40),("storage",25),("monitoring",15)]):
        if mask & (1 << i):
            vm.value = price * UNIT
            contract.execute_purchase(name)
            total += price * UNIT
            with vm.expect_revert("Permit already consumed"):
                contract.cancel_purchase(name)
        else:
            vm.value = 0
            contract.cancel_purchase(name)
            vm.value = price * UNIT
            with vm.expect_revert("Permit already consumed"):
                contract.execute_purchase(name)
        config = contract.snapshot()["agreement"]
        assert int(config["reserved_wei"]) + int(config["spent_wei"]) <= 100*UNIT
    assert int(config["reserved_wei"]) == 0
    assert int(config["spent_wei"]) == total
    assert len(messages) == mask.bit_count()


def test_seller_must_accept_before_publishing():
    vm = VMContext()
    with vm.activate():
        contract = deploy(vm)
        with vm.expect_revert("Agreement not open"):
            publish(contract, vm)


def test_distinct_counterparties_required():
    vm = VMContext()
    with vm.activate():
        vm.sender = BUYER
        with vm.expect_revert("Use four distinct parties"):
            deploy_contract(CONTRACT, vm, "0x"+BUYER.hex(), "0x"+AGENT.hex(), "0x"+CHALLENGER.hex(),
                            str(100*UNIT), CRITERION, ROOT)
