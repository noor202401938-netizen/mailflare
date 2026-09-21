"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Globe2,
  Mail,
  Users,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Send,
  HelpCircle,
  FolderSync,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function GuidePage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <div className="flex items-center gap-2 text-blue-600">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Administrator Handbook</span>
        </div>
        <h1 className="mt-1 text-3xl font-medium text-neutral-900">Setup &amp; Usage Guide</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Everything you need to know about connecting domains, provisioning mailboxes, and managing team members.
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <a href="#connecting-domains" className="group block">
          <Card className="h-full rounded-3xl border-0 bg-white p-5 transition-all hover:bg-blue-50/50 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
              <Globe2 className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-neutral-900">1. Connecting Domains</h3>
            <p className="mt-1 text-xs text-neutral-500">Cloudflare routing, DNS, SPF &amp; Brevo setup</p>
          </Card>
        </a>

        <a href="#creating-mailboxes" className="group block">
          <Card className="h-full rounded-3xl border-0 bg-white p-5 transition-all hover:bg-blue-50/50 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-neutral-900">2. Managing Mailboxes</h3>
            <p className="mt-1 text-xs text-neutral-500">Personal vs Shared mailboxes &amp; aliases</p>
          </Card>
        </a>

        <a href="#adding-members" className="group block">
          <Card className="h-full rounded-3xl border-0 bg-white p-5 transition-all hover:bg-blue-50/50 hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 transition-colors group-hover:bg-purple-600 group-hover:text-white">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-neutral-900">3. Adding Team Members</h3>
            <p className="mt-1 text-xs text-neutral-500">User accounts, roles &amp; shared delegation</p>
          </Card>
        </a>
      </div>

      {/* SECTION 1: CONNECTING DOMAINS */}
      <section id="connecting-domains" className="scroll-mt-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            1
          </div>
          <h2 className="text-xl font-semibold text-neutral-900">Connecting a New Domain</h2>
        </div>

        <Card className="rounded-3xl border-0 bg-white p-6 shadow-sm">
          <CardHeader className="py-0">
            <CardTitle className="text-lg">Step-by-Step Domain Onboarding</CardTitle>
            <CardDescription>
              Mailflare uses Cloudflare Email Routing for receiving inbound emails and Brevo SMTP for sending out.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            {/* Step 1.1 */}
            <div className="flex gap-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                A
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-neutral-900">Add the domain to Mailflare</h4>
                <p className="text-sm text-neutral-600">
                  Navigate to <Link href="/domains" className="font-medium text-blue-600 underline">Domains</Link> and click <strong>Add domain</strong>. Enter your apex domain (e.g. <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-800">yourbrand.com</code>).
                </p>
              </div>
            </div>

            {/* Step 1.2 */}
            <div className="flex gap-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                B
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-neutral-900">Enable Cloudflare Email Routing</h4>
                <p className="text-sm text-neutral-600">
                  In your <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-600 underline">Cloudflare Dashboard <ExternalLink className="h-3 w-3" /></a>:
                </p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-neutral-600">
                  <li>Select your domain and navigate to <strong>Email</strong> &rarr; <strong>Email Routing</strong>.</li>
                  <li>Click <strong>Enable Email Routing</strong>. Cloudflare will prompt you to add its MX records (<code className="rounded bg-neutral-100 px-1 text-xs">route1.mx.cloudflare.net</code>, etc.).</li>
                  <li>Click <strong>Add records automatically</strong>.</li>
                </ol>
              </div>
            </div>

            {/* Step 1.3 */}
            <div className="flex gap-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                C
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-neutral-900">Configure SPF for Brevo Sending</h4>
                <p className="text-sm text-neutral-600">
                  In Cloudflare DNS, add or edit the root <code className="rounded bg-neutral-100 px-1 text-xs">TXT</code> record for SPF so emails sent through Brevo are authenticated and do not go to Spam:
                </p>
                <div className="flex items-center justify-between rounded-2xl bg-neutral-900 px-4 py-3 text-neutral-100">
                  <code className="text-xs sm:text-sm font-mono text-emerald-400">
                    v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-neutral-300 hover:bg-neutral-800 hover:text-white"
                    onClick={() =>
                      copyToClipboard(
                        "v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com ~all",
                        "spf"
                      )
                    }
                  >
                    {copiedKey === "spf" ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 1.4 */}
            <div className="flex gap-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                D
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-neutral-900">Add the Sender Domain in Brevo (DKIM)</h4>
                <p className="text-sm text-neutral-600">
                  In your Brevo dashboard, go to <strong>Senders &amp; IP</strong> &rarr; <strong>Domains</strong> &rarr; <strong>Add a domain</strong>. Brevo will provide a DKIM key (<code className="rounded bg-neutral-100 px-1 text-xs">mail._domainkey</code>). Add that TXT record to Cloudflare DNS for 100% email deliverability.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SECTION 2: MANAGING MAILBOXES */}
      <section id="creating-mailboxes" className="scroll-mt-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
            2
          </div>
          <h2 className="text-xl font-semibold text-neutral-900">Creating &amp; Managing Mailboxes</h2>
        </div>

        <Card className="rounded-3xl border-0 bg-white p-6 shadow-sm">
          <CardHeader className="py-0">
            <CardTitle className="text-lg">Mailbox Types: Personal vs Shared</CardTitle>
            <CardDescription>
              Understand how mailboxes work and when to use each type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Personal Mailbox</Badge>
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  Private inbox dedicated to an individual team member (e.g. <code className="rounded bg-white px-1 text-xs">sarah@sixtyhours.tech</code>). Only that user and the system administrator have access.
                </p>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="border-blue-200 bg-blue-100 text-blue-700">Shared Mailbox</Badge>
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  Department or role mailbox (e.g. <code className="rounded bg-white px-1 text-xs">business@</code>, <code className="rounded bg-white px-1 text-xs">support@</code>, <code className="rounded bg-white px-1 text-xs">sales@</code>). Multiple team members can read, reply, and send emails from this address.
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-neutral-100 pt-4">
              <h4 className="text-sm font-semibold text-neutral-900">How to create a new mailbox:</h4>
              <ol className="list-inside list-decimal space-y-2 text-sm text-neutral-600">
                <li>Go to <Link href="/mailboxes" className="font-medium text-blue-600 underline">Mailboxes</Link> and click <strong>New mailbox</strong>.</li>
                <li>Choose <strong>Personal inbox</strong> (select the owner user) or <strong>Shared inbox</strong>.</li>
                <li>Enter the address username (e.g. <code className="rounded bg-neutral-100 px-1 text-xs">sales</code>) and choose the domain.</li>
                <li>Check <strong>Use all domains</strong> if you want this address to receive mail across all your active domains.</li>
                <li>Click <strong>Create mailbox</strong>. Mailflare automatically provisions Cloudflare routing rules for you!</li>
              </ol>
            </div>

            <div className="space-y-4 border-t border-neutral-100 pt-4">
              <h4 className="text-sm font-semibold text-neutral-900">How to convert an existing mailbox to Shared:</h4>
              <ol className="list-inside list-decimal space-y-2 text-sm text-neutral-600">
                <li>Go to <Link href="/mailboxes" className="font-medium text-blue-600 underline">Mailboxes</Link> and click on the mailbox (e.g. <code className="rounded bg-neutral-100 px-1 text-xs">business</code>).</li>
                <li>Under the <strong>Account</strong> card, change the <strong>Mailbox Type</strong> dropdown from <em>Personal</em> to <strong>Shared Mailbox</strong>.</li>
                <li>Click <strong>Save changes</strong>.</li>
                <li>Scroll down to the <strong>Shared access</strong> card to grant access to your team members!</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SECTION 3: ADDING MEMBERS */}
      <section id="adding-members" className="scroll-mt-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
            3
          </div>
          <h2 className="text-xl font-semibold text-neutral-900">Adding Team Members &amp; Delegation</h2>
        </div>

        <Card className="rounded-3xl border-0 bg-white p-6 shadow-sm">
          <CardHeader className="py-0">
            <CardTitle className="text-lg">User Accounts &amp; Permissions</CardTitle>
            <CardDescription>
              Create accounts for your staff and give them access to shared mailboxes without giving away admin rights.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-5">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-neutral-900">Step 1: Create a team member account</h4>
              <ol className="list-inside list-decimal space-y-2 text-sm text-neutral-600">
                <li>Go to <Link href="/accounts" className="font-medium text-blue-600 underline">Accounts</Link> and click <strong>New account</strong>.</li>
                <li>Enter their username (e.g. <code className="rounded bg-neutral-100 px-1 text-xs">alex</code>) and select the domain.</li>
                <li>Set a secure password for them.</li>
                <li>
                  Choose their <strong>Role</strong>:
                  <ul className="ml-6 mt-1 list-disc space-y-1 text-xs text-neutral-500">
                    <li><strong>User (Recommended)</strong>: Standard team member. Can read/send email, manage their mailbox and shared mailboxes they are granted access to. Cannot access the Admin console.</li>
                    <li><strong>Admin</strong>: Full administrative rights across all domains, mailboxes, accounts, and system settings.</li>
                  </ul>
                </li>
                <li>Click <strong>Create account</strong>. This immediately creates both their login and their personal mailbox.</li>
              </ol>
            </div>

            <div className="space-y-4 border-t border-neutral-100 pt-4">
              <h4 className="text-sm font-semibold text-neutral-900">Step 2: Delegate access to a shared mailbox</h4>
              <ol className="list-inside list-decimal space-y-2 text-sm text-neutral-600">
                <li>Go to <Link href="/mailboxes" className="font-medium text-blue-600 underline">Mailboxes</Link> and select any shared mailbox (e.g. <code className="rounded bg-neutral-100 px-1 text-xs">business</code> or <code className="rounded bg-neutral-100 px-1 text-xs">support</code>).</li>
                <li>Scroll down to the <strong>Shared access</strong> card at the bottom.</li>
                <li>In the dropdown, select the team member&apos;s account you just created.</li>
                <li>Click <strong>Add user</strong>.</li>
              </ol>
            </div>

            <div className="space-y-3 rounded-2xl bg-purple-50/60 p-4 border border-purple-100">
              <h4 className="text-sm font-semibold text-purple-900">Step 3: How the team member uses it</h4>
              <p className="text-sm text-purple-800">
                Your team member simply logs into Mailflare with their email and password. In their top-right account menu, they will see both their personal mailbox and the shared mailbox with a <strong>Shared inbox</strong> badge. They can switch between inboxes with a single click to read and reply to incoming mail or compose new messages directly from the shared address!
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Summary Footer */}
      <Card className="rounded-3xl border-0 bg-gradient-to-br from-neutral-900 to-neutral-800 p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Ready to get started?</h3>
            <p className="text-sm text-neutral-300">
              Jump straight into managing your mailboxes or adding team members.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/mailboxes">
              <Button variant="secondary" className="bg-white text-neutral-900 hover:bg-neutral-100">
                <Mail className="h-4 w-4 mr-2" />
                Go to Mailboxes
              </Button>
            </Link>
            <Link href="/accounts">
              <Button className="bg-blue-600 text-white hover:bg-blue-500">
                <Users className="h-4 w-4 mr-2" />
                Go to Accounts
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
