'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  Bot,
  Check,
  CircleHelp,
  Clock3,
  FileCheck2,
  LockKeyhole,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  authorizePayment,
  connectWallet,
  executePayment,
  getConnectedAccount,
  isContractConfigured,
  saveMandate,
} from '@/lib/genlayer';

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: {
          name: string;
          title: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
          execute(
            input: unknown,
          ): Record<string, unknown> | Promise<Record<string, unknown>>;
        },
        options?: { signal?: AbortSignal },
      ): void | Promise<void>;
    };
  }
}

type Verdict = 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
type ExecutionStatus = 'WITHHELD' | 'READY' | 'SCHEDULED';
type Decision = {
  verdict: Verdict;
  title: string;
  reason: string;
  rule: string;
};
type Permit = { requestId: string; amountWei: bigint };

const defaultMandate =
  'This agent may pay the existing vendor Linear up to 0.05 test GEN for a monthly renewal. Annual plans, new vendors, and larger payments require my approval.';
const defaultRecipient = '0x1111111111111111111111111111111111111111';
const initialDecision: Decision = {
  verdict: 'REJECT',
  title: 'Payment blocked',
  reason:
    'The proposed annual billing period conflicts with the monthly-only mandate.',
  rule: 'Annual plans require explicit approval',
};
const decisionStyles: Record<Verdict, { label: string; className: string }> = {
  APPROVE: { label: 'Approved', className: 'verdict-approved' },
  REJECT: { label: 'Rejected', className: 'verdict-rejected' },
  MANUAL_REVIEW: { label: 'Needs review', className: 'verdict-review' },
};

function parseGen(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,18})?$/.test(normalized))
    throw new Error('Enter a valid test GEN amount with up to 18 decimals.');
  const [whole, fraction = ''] = normalized.split('.');
  const wei =
    BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0') || '0');
  if (wei <= 0n)
    throw new Error('The payment amount must be greater than zero.');
  return wei;
}

function evaluatePayment(
  mandate: string,
  amount: string,
  billingPeriod: string,
  vendor: string,
): Decision {
  const normalized = mandate.toLowerCase();
  const numericAmount = Number(amount);
  if (billingPeriod === 'Annual' && normalized.includes('annual'))
    return initialDecision;
  const limit = normalized.match(/(\d+(?:\.\d+)?)\s*(?:test\s*)?gen/)?.[1];
  if (limit && numericAmount > Number(limit)) {
    return {
      verdict: 'REJECT',
      title: 'Payment blocked',
      reason: `The proposed ${numericAmount} test GEN payment exceeds the ${limit} test GEN limit.`,
      rule: `Maximum authorized payment is ${limit} test GEN`,
    };
  }
  if (
    normalized.includes('existing') &&
    vendor.trim().toLowerCase() !== 'linear'
  ) {
    return {
      verdict: 'MANUAL_REVIEW',
      title: 'Your approval is required',
      reason: `${vendor || 'This vendor'} is not identified as an existing vendor in the mandate.`,
      rule: 'New vendors require explicit approval',
    };
  }
  return {
    verdict: 'APPROVE',
    title: 'Payment permit ready',
    reason:
      'The vendor, amount, and billing period comply with the active mandate.',
    rule: 'Existing monthly Linear renewal under 0.05 test GEN',
  };
}

export default function Home() {
  const [mandate, setMandate] = useState(defaultMandate);
  const [vendor, setVendor] = useState('Linear');
  const [amount, setAmount] = useState('0.039');
  const [billingPeriod, setBillingPeriod] = useState('Annual');
  const [description, setDescription] = useState(
    'Renew the team workspace plan',
  );
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [decision, setDecision] = useState<Decision>(initialDecision);
  const [executionStatus, setExecutionStatus] =
    useState<ExecutionStatus>('WITHHELD');
  const [permit, setPermit] = useState<Permit | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [decisionCount, setDecisionCount] = useState(1);
  const [executionCount, setExecutionCount] = useState(0);
  const [account, setAccount] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const verdict = useMemo(() => decisionStyles[decision.verdict], [decision]);

  useEffect(() => {
    void getConnectedAccount().then((connected) => {
      setAccount(connected);
      if (connected) setRecipient(connected);
    });
  }, []);

  useEffect(() => {
    if (!document.modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = document.modelContext.registerTool(
      {
        name: 'preview_agent_payment',
        title: 'Preview agent payment',
        description:
          'Stage a payment in IntentLatch and display whether it fits a plain-language mandate. This preview never transfers funds.',
        inputSchema: {
          type: 'object',
          properties: {
            mandate: { type: 'string', minLength: 1, maxLength: 600 },
            vendor: { type: 'string', minLength: 1 },
            amountGen: { type: 'number', exclusiveMinimum: 0 },
            billingPeriod: {
              type: 'string',
              enum: ['Monthly', 'Annual', 'One-time'],
            },
            description: { type: 'string', minLength: 1 },
          },
          required: [
            'mandate',
            'vendor',
            'amountGen',
            'billingPeriod',
            'description',
          ],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute(input) {
          const value = input as {
            mandate?: unknown;
            vendor?: unknown;
            amountGen?: unknown;
            billingPeriod?: unknown;
            description?: unknown;
          };
          if (
            typeof value.mandate !== 'string' ||
            typeof value.vendor !== 'string' ||
            typeof value.amountGen !== 'number' ||
            typeof value.billingPeriod !== 'string' ||
            typeof value.description !== 'string'
          ) {
            throw new Error('Invalid payment preview input.');
          }
          const next = evaluatePayment(
            value.mandate,
            String(value.amountGen),
            value.billingPeriod,
            value.vendor,
          );
          setMandate(value.mandate);
          setVendor(value.vendor);
          setAmount(String(value.amountGen));
          setBillingPeriod(value.billingPeriod);
          setDescription(value.description);
          setDecision(next);
          setExecutionStatus(next.verdict === 'APPROVE' ? 'READY' : 'WITHHELD');
          setPermit(null);
          setDecisionCount((count) => count + 1);
          return {
            verdict: next.verdict,
            reason: next.reason,
            matchedRule: next.rule,
          };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function invalidatePermit() {
    setPermit(null);
    setExecutionStatus('WITHHELD');
  }

  async function handleConnect() {
    setErrorMessage('');
    try {
      const connected = await connectWallet();
      setAccount(connected);
      if (recipient === defaultRecipient) setRecipient(connected);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Wallet connection failed.',
      );
    }
  }

  async function handleCheck() {
    setIsChecking(true);
    setErrorMessage('');
    setPermit(null);
    try {
      if (!/^0x[0-9a-fA-F]{40}$/.test(recipient))
        throw new Error('Enter a valid 0x recipient address.');
      const amountWei = parseGen(amount);
      let next: Decision;
      let status: ExecutionStatus;
      const requestId = `payment-${Date.now()}`;

      if (isContractConfigured) {
        const activeAccount = account ?? (await connectWallet());
        setAccount(activeAccount);
        const mandateId = `software-payments-${activeAccount.toLowerCase()}`;
        await saveMandate(activeAccount, mandateId, mandate);
        const record = await authorizePayment(
          activeAccount,
          mandateId,
          requestId,
          {
            type: 'subscription_payment',
            vendor,
            amount_gen: amount,
            amount_wei: amountWei.toString(),
            billing_period: billingPeriod.toLowerCase(),
            is_existing_subscription: vendor.trim().toLowerCase() === 'linear',
            recipient,
            description,
          },
        );
        const result = record.decision;
        next = {
          verdict: result.verdict,
          title:
            result.verdict === 'APPROVE'
              ? 'Payment permit ready'
              : result.verdict === 'REJECT'
                ? 'Payment blocked'
                : 'Your approval is required',
          reason: result.explanation,
          rule: result.matched_rule,
        };
        status = record.execution.status;
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        next = evaluatePayment(mandate, amount, billingPeriod, vendor);
        status = next.verdict === 'APPROVE' ? 'READY' : 'WITHHELD';
      }

      setDecision(next);
      setExecutionStatus(status);
      setDecisionCount((value) => value + 1);
      if (status === 'READY') setPermit({ requestId, amountWei });
    } catch (error) {
      setExecutionStatus('WITHHELD');
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'The authorization check failed.',
      );
    } finally {
      setIsChecking(false);
    }
  }

  async function handleExecute() {
    if (!account || !permit || !isContractConfigured) return;
    setIsExecuting(true);
    setErrorMessage('');
    try {
      const record = await executePayment(
        account,
        permit.requestId,
        permit.amountWei,
      );
      setExecutionStatus(record.execution.status);
      setExecutionCount((value) => value + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'The protected payment failed.',
      );
    } finally {
      setIsExecuting(false);
    }
  }

  const consequence =
    executionStatus === 'SCHEDULED'
      ? 'Transfer scheduled for finalization'
      : executionStatus === 'READY'
        ? 'Single-use payment permit issued'
        : decision.verdict === 'MANUAL_REVIEW'
          ? 'Transfer withheld for manual review'
          : 'Transfer blocked';

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <a
            href="#workspace"
            className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground">
              <LockKeyhole className="size-[18px]" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold leading-4">
                IntentLatch
              </span>
              <span className="block text-[11px] leading-4 text-muted-foreground">
                Agent payment firewall
              </span>
            </span>
          </a>
          <div className="flex items-center gap-2.5">
            <span className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:flex">
              <span
                className={`size-2 rounded-full ${isContractConfigured ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`}
              />
              {isContractConfigured ? 'Studionet live' : 'Contract preview'}
            </span>
            <Button
              variant="outline"
              size="lg"
              className="h-9 px-3.5"
              onClick={handleConnect}
            >
              <span className="size-2 rounded-full bg-[var(--primary)]" />
              {account
                ? `${account.slice(0, 6)}…${account.slice(-4)}`
                : 'Connect wallet'}
            </Button>
          </div>
        </div>
      </header>

      <section
        id="workspace"
        className="mx-auto max-w-[1440px] px-5 pb-10 pt-8 sm:px-8 sm:pt-10"
      >
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Protected policy · Software payments
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-[2.5rem] sm:leading-[1.08]">
              No agent payment moves without a mandate.
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-muted-foreground">
              GenLayer validators interpret your rules, issue an exact
              single-use permit, and release test GEN only after approval.
            </p>
          </div>
          <div className="flex items-center gap-5 border-y border-border py-3 text-sm lg:border-y-0 lg:py-0">
            <div>
              <span className="block font-semibold">{decisionCount}</span>
              <span className="text-xs text-muted-foreground">
                decisions checked
              </span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <span className="block font-semibold">{executionCount}</span>
              <span className="text-xs text-muted-foreground">
                payments executed
              </span>
            </div>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[minmax(0,1.07fr)_minmax(380px,.93fr)]">
          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="step-index">1</span>
                  <h2 className="text-lg font-semibold">
                    Set the payment mandate
                  </h2>
                </div>
                <p className="ml-9 mt-1 text-sm text-muted-foreground">
                  Describe what this agent may pay for and the limits it must
                  obey.
                </p>
              </div>
              <span className="hidden rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground sm:inline-flex">
                Owner controlled
              </span>
            </div>
            <div className="mt-6">
              <Label htmlFor="mandate" className="mb-2">
                Authorization policy
              </Label>
              <Textarea
                id="mandate"
                value={mandate}
                onChange={(event) => {
                  setMandate(event.target.value);
                  invalidatePermit();
                }}
                className="min-h-32 resize-none bg-background p-3.5 text-[15px] leading-6"
                maxLength={600}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <FileCheck2 className="size-3.5" /> Plain-language rules
                </span>
                <span>{mandate.length}/600</span>
              </div>
            </div>

            <div className="my-7 h-px bg-border" />
            <div>
              <div className="flex items-center gap-2">
                <span className="step-index">2</span>
                <h2 className="text-lg font-semibold">
                  Inspect the agent’s payment
                </h2>
              </div>
              <p className="ml-9 mt-1 text-sm text-muted-foreground">
                The approved recipient and amount are locked into the permit.
              </p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={vendor}
                  onChange={(event) => {
                    setVendor(event.target.value);
                    invalidatePermit();
                  }}
                  className="h-10 px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      invalidatePermit();
                    }}
                    className="h-10 pr-20"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    test GEN
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing">Billing period</Label>
                <select
                  id="billing"
                  value={billingPeriod}
                  onChange={(event) => {
                    setBillingPeriod(event.target.value);
                    invalidatePermit();
                  }}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option>Monthly</option>
                  <option>Annual</option>
                  <option>One-time</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Purpose</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    invalidatePermit();
                  }}
                  className="h-10 px-3"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="recipient">Recipient address</Label>
                <Input
                  id="recipient"
                  value={recipient}
                  onChange={(event) => {
                    setRecipient(event.target.value);
                    invalidatePermit();
                  }}
                  spellCheck={false}
                  className="h-10 px-3 font-mono text-xs"
                />
              </div>
            </div>
            <Button
              onClick={handleCheck}
              disabled={isChecking || isExecuting || !mandate.trim()}
              size="lg"
              className="mt-6 h-11 w-full px-4 sm:w-auto"
            >
              {isChecking ? (
                <>
                  <Sparkles className="animate-pulse" /> Reaching consensus…
                </>
              ) : (
                <>
                  Authorize payment <ArrowRight />
                </>
              )}
            </Button>
            {errorMessage && (
              <p
                role="alert"
                className="mt-3 text-sm font-medium text-destructive"
              >
                {errorMessage}
              </p>
            )}
          </div>

          <aside
            className="flex min-h-[600px] flex-col border-t border-border bg-[var(--panel)] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8"
            aria-live="polite"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bot className="size-4 text-primary" aria-hidden="true" />
                Validator consensus
              </div>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" /> latest decision
              </span>
            </div>
            <div className={`mt-7 rounded-2xl p-5 ${verdict.className}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="verdict-badge">
                  {decision.verdict === 'APPROVE' ? (
                    <Check />
                  ) : decision.verdict === 'REJECT' ? (
                    <X />
                  ) : (
                    <TriangleAlert />
                  )}
                  {verdict.label}
                </span>
                <span className="text-xs font-semibold">Consensus reached</span>
              </div>
              <h2 className="mt-8 text-2xl font-semibold tracking-[-0.025em]">
                {decision.title}
              </h2>
              <p className="mt-2 text-sm leading-6 opacity-85">
                {decision.reason}
              </p>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Decision evidence</h3>
              <dl className="mt-3 divide-y divide-border border-y border-border">
                <div className="grid grid-cols-[110px_1fr] gap-4 py-3.5 text-sm">
                  <dt className="text-muted-foreground">Matched rule</dt>
                  <dd className="font-medium">{decision.rule}</dd>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-4 py-3.5 text-sm">
                  <dt className="text-muted-foreground">Proposed by</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    <Bot className="size-3.5 text-primary" /> Operations agent
                  </dd>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-4 py-3.5 text-sm">
                  <dt className="text-muted-foreground">Consequence</dt>
                  <dd className="font-medium">{consequence}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <Banknote className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Execution gate</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    A permit works once, for this recipient and this exact
                    amount.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleExecute}
                disabled={
                  !isContractConfigured ||
                  !account ||
                  !permit ||
                  executionStatus !== 'READY' ||
                  isExecuting
                }
                className="mt-4 h-10 w-full"
              >
                {isExecuting ? (
                  <>
                    <Sparkles className="animate-pulse" /> Scheduling transfer…
                  </>
                ) : executionStatus === 'SCHEDULED' ? (
                  <>
                    <Check /> Transfer scheduled
                  </>
                ) : (
                  <>
                    <Send /> Execute {amount || '0'} test GEN
                  </>
                )}
              </Button>
              {!isContractConfigured && executionStatus === 'READY' && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Preview only—deploy the contract to move test GEN.
                </p>
              )}
            </div>

            <div className="mt-auto flex items-start gap-3 pt-7 text-xs leading-5 text-muted-foreground">
              <CircleHelp
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                {isContractConfigured
                  ? 'Authorization is recorded by GenLayer consensus. Approved transfers are emitted only on finalization.'
                  : 'Preview mode mirrors the contract states but cannot issue or consume an on-chain permit.'}
              </p>
            </div>
          </aside>
        </div>
        <footer className="flex flex-col justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>IntentLatch · Built for the GenLayer agentic economy</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> Exact-value permits · requester
            bound · replay protected
          </span>
        </footer>
      </section>
    </main>
  );
}
