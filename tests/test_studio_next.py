"""Fee-enabled transport tests. No network, signatures, or wallet access."""
import hashlib
from copy import deepcopy

import pytest
import rlp
from eth_abi import decode
from genlayer_py.abi import calldata

import studio_next as flow
from purchase_flow import receipt, execution, consensus_result

ACCOUNT = "0x" + "1" * 40
SOURCE = b"# migration fixture\n"


@pytest.fixture
def network():
    values = {"eth_chainId": hex(61997), "eth_gasPrice": "0x0",
        "sim_getConsensusContract": {"address": flow.ROUTER},
        "sim_getFeeConfig": {"enabled": True, "policy": {"genPerTimeUnit": "1",
            "storageUnitPrice": "250000000", "receiptGasPrice": "250000000",
            "timeUnitOverlayBps": "1500", "messageFeeParamsBudgetFloor": "76548000000000"}},
        "eth_getBalance": hex(10**18), "eth_estimateGas": hex(1000000),
        "eth_getTransactionCount": "0x0"}
    calls = []
    def read(method, params):
        calls.append((method, params))
        return deepcopy(values[method])
    return values, read, calls


def test_envelope_separates_protocol_fee_from_contract_value(network):
    from genlayer_py.transactions.fees import ADD_TRANSACTION_WITH_FEES_ARGUMENT_TYPES, ADD_TRANSACTION_WITH_FEES_SELECTOR
    _, read, calls = network
    plan = flow.prepare_deployment(ACCOUNT, SOURCE, ["evidence"], read=read, now=100)
    tx, review = plan["transaction"], plan["review"]
    assert review["chain_id"] == 61997 and tx["chainId"] == "0xf22d"
    assert tx["to"] == flow.ROUTER and review["contract"] == flow.ZERO
    assert review["value_wei"] == "0"
    assert int(tx["value"], 16) == int(review["protocol_fee_wei"]) > 0
    assert int(tx["value"], 16) <= flow.MAX_FEE_WEI
    assert tx["data"][2:10] == ADD_TRANSACTION_WITH_FEES_SELECTOR
    params = decode(ADD_TRANSACTION_WITH_FEES_ARGUMENT_TYPES, bytes.fromhex(tx["data"][10:]))[0]
    assert params[:4] == (ACCOUNT, flow.ZERO, 5, 3)
    assert params[6] == 0 and params[9] == ()  # no contract value / child payments
    parts = rlp.decode(params[8])
    assert parts[0] == SOURCE and calldata.decode(parts[1]) == {"args": ["evidence"]}
    assert review["source_sha256"] == hashlib.sha256(SOURCE).hexdigest()
    assert not any("send" in method.lower() for method, _ in calls)
    assert flow.prepare_deployment(ACCOUNT, SOURCE, ["evidence"], read=read, now=101)["intent_id"] == plan["intent_id"]


@pytest.mark.parametrize("method,value", [
    ("eth_chainId", hex(61999)), ("eth_gasPrice", "0x1"),
    ("sim_getConsensusContract", {"address": flow.ZERO}),
    ("sim_getFeeConfig", {"enabled": False}), ("eth_getBalance", "0x0"),
    ("eth_estimateGas", "0x0"), ("eth_estimateGas", hex(100000001))])
def test_changed_network_or_insufficient_budget_fail_closed(network, method, value):
    values, read, calls = network
    values[method] = value
    with pytest.raises(ValueError):
        flow.prepare_deployment(ACCOUNT, SOURCE, [], read=read)
    assert not any("send" in name.lower() for name, _ in calls)


def test_price_spike_hits_absolute_cap(network):
    values, read, _ = network
    values["sim_getFeeConfig"]["policy"]["genPerTimeUnit"] = str(10**18)
    with pytest.raises(ValueError, match="safety limit"):
        flow.prepare_deployment(ACCOUNT, SOURCE, [], read=read)


@pytest.mark.parametrize("method", ["eth_sendRawTransaction", "eth_sendTransaction", "sim_fundAccount", "unknown"])
def test_public_reader_rejects_writes(method):
    with pytest.raises(ValueError, match="Read-only"):
        flow.rpc(method, [])


def test_old_receipts_never_silently_move_to_next(network):
    values, read, _ = network
    values["eth_getTransactionByHash"] = None
    with pytest.raises(ValueError, match="network changed"):
        receipt("0x" + "a" * 64, read)
    assert receipt("0x" + "a" * 64, read, chain_id=61997)["status"] == "NOT_FOUND"
    values["eth_chainId"] = hex(61999)
    assert receipt("0x" + "a" * 64, read)["status"] == "NOT_FOUND"
    with pytest.raises(ValueError):
        receipt("0x" + "a" * 64, read, chain_id=61997)


@pytest.mark.parametrize("code,name,expected", [(1,"FINISHED_WITH_RETURN","SUCCESS"),
    (2,"FINISHED_WITH_ERROR","ERROR"), (3,"TIMEOUT","ERROR"),
    (4,"NONDET_DISAGREE","ERROR"), (5,"DETERMINISTIC_VIOLATION","ERROR"),
    (0,"NOT_VOTED","UNKNOWN"), (1,"FINISHED_WITH_ERROR","UNKNOWN"), (99,"UNKNOWN","UNKNOWN")])
def test_next_finality_is_not_execution_success(code, name, expected):
    tx = {"status": "FINALIZED", "result": 1, "result_name": "MAJORITY_AGREE",
          "txExecutionResult": code, "txExecutionResultName": name}
    assert consensus_result(tx, 61997) == "MAJORITY_AGREE"
    assert execution(tx, 61997) == expected
    assert consensus_result(tx) == "UNKNOWN"  # same number has different legacy meaning


def test_next_missing_execution_does_not_trust_leader_success():
    tx = {"status": "FINALIZED", "result": 1, "result_name": "MAJORITY_AGREE",
          "consensus_data": {"leader_receipt": [{"mode": "leader", "execution_result": "SUCCESS"}]}}
    assert execution(tx, 61997) == "UNKNOWN"
    tx.update(txExecutionResult=1, txExecutionResultName="FINISHED_WITH_RETURN", result=2, result_name="MAJORITY_DISAGREE")
    assert execution(tx, 61997) == "ERROR"


def test_fee_record_cannot_mask_contract_value(network):
    values, read, _ = network
    h = "0x" + "a" * 64
    tx = {"hash": h, "status": "FINALIZED", "value": 0, "result": 1,
          "result_name": "MAJORITY_AGREE", "txExecutionResult": 2,
          "txExecutionResultName": "FINISHED_WITH_ERROR",
          "fees": {"userValue": "0", "deposit": "20000000000033882"}}
    values["eth_getTransactionByHash"] = tx
    row = receipt(h, read, chain_id=61997)
    assert row["execution"] == "ERROR" and row["protocol_fee_deposit_wei"] == tx["fees"]["deposit"]
    tx["fees"]["userValue"] = "1"
    with pytest.raises(ValueError, match="Contract value"):
        receipt(h, read, chain_id=61997)
