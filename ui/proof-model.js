import {verifiedPermitPayment} from "./wallet.js";

// Build an expected review from agreement state, not from the receipt's claims.
export function recordedPayment(report, permit) {
  if(!permit)return null;
  const session=report.session;
  const review={action:"execute_purchase",contract:session.contract,account:session.snapshot.agreement.buyer,
    args:[permit.id],recipient:permit.recipient,value_wei:permit.amount_wei};
  return report.receipts.find(receipt=>verifiedPermitPayment(permit,session,[{hash:receipt.hash,receipt,review}]))||null;
}

export function recordedOutcome(report, claim) {
  const permit=report.session.snapshot.permits.find(p=>p.claim_id===claim.id);
  const payment=recordedPayment(report,permit);
  if(payment)return {label:"Paid · transfer verified",tone:"good",permit,payment};
  if(permit?.status==="CANCELLED")return {label:"Canceled · not paid",tone:"bad",permit,payment:null};
  return {label:"Payment not verified",tone:"neutral",permit,payment:null};
}
