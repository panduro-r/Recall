import json


CONTRACT_PATH = "contracts/intent_latch.py"
MANDATE = (
    "This agent may pay the existing vendor Linear up to 0.05 test GEN for a "
    "monthly renewal. Annual plans, new vendors, and larger payments require my approval."
)
RECIPIENT = "0x1111111111111111111111111111111111111111"
AMOUNT_WEI = 39_000_000_000_000_000


def payment_action(**overrides):
    action = {
        "type": "subscription_payment",
        "vendor": "Linear",
        "amount_gen": "0.039",
        "amount_wei": str(AMOUNT_WEI),
        "billing_period": "monthly",
        "is_existing_subscription": True,
        "recipient": RECIPIENT,
        "description": "Renew the team workspace plan",
    }
    action.update(overrides)
    return json.dumps(action)


def mock_decision(direct_vm, verdict="APPROVE", reason_code="ALLOWED"):
    direct_vm.mock_llm(
        r".*",
        json.dumps({
            "verdict": verdict,
            "reason_code": reason_code,
            "matched_rule": "Existing monthly Linear renewal up to 0.05 test GEN",
            "explanation": "The proposed payment matches the active mandate.",
        }),
    )


def authorize_ready_payment(contract, direct_vm, direct_alice, request_id="req-approved"):
    direct_vm.sender = direct_alice
    contract.register_mandate("software-ops", MANDATE)
    mock_decision(direct_vm)
    contract.authorize_payment("software-ops", request_id, payment_action())


def test_registers_and_reads_mandate(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice

    contract.register_mandate("software-ops", MANDATE)
    stored = contract.get_mandate("software-ops")

    assert stored["id"] == "software-ops"
    assert stored["mandate"] == MANDATE
    assert stored["owner"].lower() == ("0x" + direct_alice.hex()).lower()


def test_non_owner_cannot_replace_mandate(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    contract.register_mandate("software-ops", MANDATE)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the mandate owner can update it"):
        contract.register_mandate("software-ops", "Anything is allowed")


def test_rejected_payment_withholds_execution_permit(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    contract.register_mandate("software-ops", MANDATE)
    mock_decision(direct_vm, verdict="REJECT", reason_code="TERM_VIOLATION")

    result = contract.authorize_payment(
        "software-ops",
        "req-rejected",
        payment_action(billing_period="annual"),
    )

    assert result["verdict"] == "REJECT"
    assert result["reason_code"] == "TERM_VIOLATION"
    stored = contract.get_decision("req-rejected")
    assert stored["execution"]["status"] == "WITHHELD"
    assert stored["requested_by"].lower() == ("0x" + direct_alice.hex()).lower()


def test_approved_payment_issues_exact_single_use_permit(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    authorize_ready_payment(contract, direct_vm, direct_alice)

    stored = contract.get_decision("req-approved")
    assert stored["decision"]["verdict"] == "APPROVE"
    assert stored["execution"] == {
        "status": "READY",
        "recipient": RECIPIENT,
        "amount_wei": str(AMOUNT_WEI),
    }


def test_rejects_invalid_payment_json(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    contract.register_mandate("software-ops", MANDATE)

    with direct_vm.expect_revert("Payment must be valid JSON"):
        contract.authorize_payment("software-ops", "req-invalid", "not-json")


def test_rejects_payment_without_execution_fields(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    contract.register_mandate("software-ops", MANDATE)

    with direct_vm.expect_revert("Payment requires recipient"):
        contract.authorize_payment("software-ops", "req-missing", '{"vendor":"Linear"}')


def test_request_ids_are_single_use(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    authorize_ready_payment(contract, direct_vm, direct_alice, request_id="req-single")

    with direct_vm.expect_revert("Request already decided"):
        contract.authorize_payment("software-ops", "req-single", payment_action())


def test_rejected_payment_cannot_execute(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    contract.register_mandate("software-ops", MANDATE)
    mock_decision(direct_vm, verdict="REJECT", reason_code="LIMIT_EXCEEDED")
    contract.authorize_payment("software-ops", "req-blocked", payment_action())
    direct_vm.value = AMOUNT_WEI

    with direct_vm.expect_revert("Payment was not approved"):
        contract.execute_payment("req-blocked")


def test_only_original_requester_can_execute(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    authorize_ready_payment(contract, direct_vm, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = AMOUNT_WEI

    with direct_vm.expect_revert("Only the original requester"):
        contract.execute_payment("req-approved")


def test_execution_value_must_match_approved_amount(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    authorize_ready_payment(contract, direct_vm, direct_alice)
    direct_vm.value = AMOUNT_WEI + 1

    with direct_vm.expect_revert("Transferred value does not match"):
        contract.execute_payment("req-approved")


def test_approved_payment_executes_once(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    authorize_ready_payment(contract, direct_vm, direct_alice)
    direct_vm.value = AMOUNT_WEI
    emitted = []

    def capture_message(_vm, request):
        if "EthSend" in request:
            emitted.append(request["EthSend"])
            return {"ok": None}
        return None

    direct_vm._gl_call_hook = capture_message
    result = contract.execute_payment("req-approved")

    assert result["status"] == "SCHEDULED"
    assert result["recipient"] == RECIPIENT
    assert result["amount_wei"] == str(AMOUNT_WEI)
    assert len(emitted) == 1
    assert contract.get_decision("req-approved")["execution"]["status"] == "SCHEDULED"

    with direct_vm.expect_revert("Payment permit already consumed"):
        contract.execute_payment("req-approved")
