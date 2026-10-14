"use client";

import { Bot, Check, Compass, Copy, Flame, Globe, Info, MessageSquareText, Package, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Guide {
  id: string;
  label: string;
  icon: typeof Globe;
  intro: string;
  paths?: { os: string; path: string }[];
  steps: string[];
  produces: string;
  note?: string;
}

const GUIDES: Guide[] = [
  {
    id: "chrome",
    label: "Chrome",
    icon: Globe,
    intro: "Chrome keeps your browsing history in a file simply called History (it has no extension).",
    paths: [
      { os: "Windows", path: "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\History" },
      { os: "macOS", path: "~/Library/Application Support/Google/Chrome/Default/History" },
      { os: "Linux", path: "~/.config/google-chrome/Default/History" },
    ],
    steps: [
      "Close Chrome completely, or copy the file first. Chrome locks it while it is open.",
      "Paste the path into the File Explorer address bar (Windows), or use Finder → Go → Go to Folder (macOS).",
      "Copy the file called History to your Desktop. Other profiles live in folders named Profile 1, Profile 2 and so on.",
      "Drop that copy into the box above.",
    ],
    produces: "History",
    note: "Chrome on a phone or tablet does not expose this file. Use Google Takeout instead.",
  },
  {
    id: "edge",
    label: "Edge",
    icon: Globe,
    intro: "Edge uses the same format as Chrome, in the same kind of file called History.",
    paths: [
      { os: "Windows", path: "%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\History" },
      { os: "macOS", path: "~/Library/Application Support/Microsoft Edge/Default/History" },
    ],
    steps: [
      "Close Edge completely, or copy the file first. Edge locks it while it is open.",
      "Open the folder above and copy the file called History to your Desktop.",
      "Drop that copy into the box above.",
    ],
    produces: "History",
  },
  {
    id: "firefox",
    label: "Firefox",
    icon: Flame,
    intro: "Firefox stores history in a database called places.sqlite inside your profile folder.",
    paths: [
      { os: "Windows", path: "%APPDATA%\\Mozilla\\Firefox\\Profiles\\<profile>\\places.sqlite" },
      { os: "macOS", path: "~/Library/Application Support/Firefox/Profiles/<profile>/places.sqlite" },
    ],
    steps: [
      "Type about:profiles into the Firefox address bar.",
      "Next to the profile in use, click Open Folder beside Root Directory.",
      "Close Firefox, then copy places.sqlite to your Desktop. Closing Firefox saves its latest changes into the file.",
      "Drop that copy into the box above.",
    ],
    produces: "places.sqlite",
  },
  {
    id: "safari",
    label: "Safari",
    icon: Compass,
    intro: "Safari on a Mac keeps history in a file called History.db.",
    paths: [{ os: "macOS", path: "~/Library/Safari/History.db" }],
    steps: [
      "In Finder choose Go → Go to Folder… and paste the path above.",
      "If macOS blocks access, allow the app under System Settings → Privacy & Security → Full Disk Access, then try again.",
      "Copy History.db to your Desktop.",
      "Drop that copy into the box above.",
    ],
    produces: "History.db",
    note: "iPhone and iPad Safari history syncs to a Mac through iCloud, so the Mac file includes it.",
  },
  {
    id: "takeout",
    label: "Google Takeout",
    icon: Package,
    intro: "The easiest way to get history from a phone, tablet or Chromebook where Chrome sync is on.",
    steps: [
      "Go to takeout.google.com, signed in to your child’s Google account (ideally together).",
      "Choose Deselect all, then tick Chrome.",
      "Click All Chrome data included, deselect everything, and tick only BrowserHistory.",
      "Create the export, download the ZIP and unzip it.",
      "Drop Takeout/Chrome/BrowserHistory.json into the box above.",
    ],
    produces: "BrowserHistory.json",
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    icon: MessageSquareText,
    intro: "ChatGPT can email you a complete export of an account’s conversations.",
    steps: [
      "In ChatGPT open Settings → Data controls → Export data, then confirm.",
      "Open the email OpenAI sends and download the ZIP (the link expires).",
      "Unzip it and drop conversations.json into the box above.",
    ],
    produces: "conversations.json",
    note: "Do this from your child’s account, with them beside you if you can.",
  },
  {
    id: "claude",
    label: "Claude",
    icon: Sparkles,
    intro: "Claude can export all of an account’s conversations.",
    steps: [
      "In Claude open Settings → Privacy → Export data.",
      "Open the email Anthropic sends and download the ZIP.",
      "Unzip it and drop conversations.json into the box above.",
    ],
    produces: "conversations.json",
  },
  {
    id: "characterai",
    label: "Character.AI",
    icon: Bot,
    intro: "Character.AI, Snapchat My AI and Replika have no export button, but a copy and paste works well.",
    steps: [
      "Open the chat, then select the conversation text (Ctrl/Cmd + A) and copy it.",
      "Paste it into Paste a chat transcript in the box above.",
      "Pick the matching platform, then press Add transcript. Repeat for a few recent chats.",
    ],
    produces: "Pasted transcript",
    note: "The most recent late-night chats usually tell you the most.",
  },
];

function CopyPath({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Path copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn’t copy. Select the text instead.");
        }
      }}
      className="group flex w-full items-start gap-3 rounded-xl border border-border bg-muted/60 px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
      aria-label={`Copy path ${text}`}
    >
      <code className="min-w-0 flex-1 font-mono text-[0.78rem] leading-relaxed break-all text-foreground/90">{text}</code>
      <span className="mt-0.5 text-muted-foreground transition-colors group-hover:text-foreground">
        {copied ? <Check className="size-4 text-sev-normal-ink" /> : <Copy className="size-4" />}
      </span>
    </button>
  );
}

export function ExportGuides() {
  return (
    <div className="mt-12">
      <div className="max-w-xl">
        <h3 className="text-title text-xl sm:text-2xl">How do I export?</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Pick where the history or chats live. Each guide takes a couple of minutes.
        </p>
      </div>

      <Tabs defaultValue="chrome" className="mt-5 gap-5">
        <TabsList
          variant="line"
          className="h-auto w-full flex-wrap justify-start gap-1.5 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto"
        >
          {GUIDES.map((g) => (
            <TabsTrigger
              key={g.id}
              value={g.id}
              className={cn(
                "h-9 flex-none gap-1.5 rounded-full border-border bg-card px-3.5 text-[0.85rem] text-muted-foreground shadow-soft",
                "hover:border-ring/40 data-active:border-primary data-active:bg-primary data-active:text-primary-foreground",
                "group-data-[variant=line]/tabs-list:data-active:bg-primary dark:group-data-[variant=line]/tabs-list:data-active:bg-primary",
                "dark:data-active:border-primary dark:data-active:text-primary-foreground",
                "after:hidden",
              )}
            >
              <g.icon className="size-3.5" />
              {g.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {GUIDES.map((g) => (
          <TabsContent key={g.id} value={g.id} className="animate-in duration-300 fade-in-0 slide-in-from-bottom-1">
            <div className="nl-card grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-[0.95rem] leading-relaxed">{g.intro}</p>
                <ol className="mt-5 space-y-3">
                  {g.steps.map((s, i) => (
                    <li key={s} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[0.7rem] font-semibold text-accent-foreground tabular-nums">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="space-y-3">
                {g.paths && (
                  <>
                    <p className="eyebrow">File location</p>
                    <div className="space-y-2.5">
                      {g.paths.map((p) => (
                        <div key={p.os}>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">{p.os}</p>
                          <CopyPath text={p.path} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between rounded-xl bg-accent/60 px-3.5 py-2.5 text-sm">
                  <span className="text-muted-foreground">You will upload</span>
                  <code className="font-mono text-[0.8rem] font-medium text-accent-foreground">{g.produces}</code>
                </div>
                {g.note && (
                  <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {g.note}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
