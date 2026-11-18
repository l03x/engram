import { useMutation } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderOpenIcon,
  GalleryVerticalEndIcon,
  type LucideIcon,
  PlayIcon,
  SettingsIcon,
  SquareArrowOutUpRightIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { type CSSProperties, type ReactElement, useState } from "react";
import { Link, useNavigate } from "react-router";

import { FormError } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import {
  type Collection,
  collectionDecks,
  collectionStudyUrl,
  type DeckLeaf,
  type DeckNode,
  deckDisplayName,
} from "@/lib/collections";
import { downloadFromApi } from "@/lib/download";
import { plural, studyCountsText } from "@/lib/format";
import type { Deck } from "@/lib/types";
import { DeckSettingsDialog } from "@/routes/deck/DeckSettingsDialog";
import { MembersDialog } from "@/routes/deck/MembersDialog";
import { CollectionSettingsDialog } from "@/routes/decks/CollectionSettingsDialog";
import { CollectionShareDialog } from "@/routes/decks/CollectionShareDialog";

// Collection dialogs are keyed by the collection's path, deck dialogs by the deck's id.
type DialogKind = "share" | "settings" | "deck-members" | "deck-settings";
type OpenDialog = (kind: DialogKind, key: string) => void;

interface RowHandlers {
  open: Set<string>;
  onToggle: (key: string) => void;
  onDialog: OpenDialog;
  onExport: (deck: Deck) => void;
}

type RowAction = { label: string; icon: LucideIcon; onSelect: () => void } | "separator";

// Right-click (or a long press) on a row. Each action is also on the deck's page or in the
// collection's "More actions" menu, for anyone who can't right-click.
function RowContextMenu({ actions, children }: { actions: RowAction[]; children: ReactElement }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {actions.map((action, index) =>
          action === "separator" ? (
            <ContextMenuSeparator key={`separator-${String(index)}`} />
          ) : (
            <ContextMenuItem key={action.label} onSelect={action.onSelect}>
              <action.icon aria-hidden />
              {action.label}
            </ContextMenuItem>
          ),
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function findDeck(nodes: DeckNode[], id: string): Deck | undefined {
  for (const node of nodes) {
    if (node.kind === "deck") {
      if (node.deck.id === id) return node.deck;
      continue;
    }
    const found = findDeck(node.children, id);
    if (found) return found;
  }
  return undefined;
}

function findCollection(nodes: DeckNode[], key: string): Collection | undefined {
  for (const node of nodes) {
    if (node.kind !== "collection") continue;
    if (node.key === key) return node;
    const found = findCollection(node.children, key);
    if (found) return found;
  }
  return undefined;
}

const STORAGE_KEY = "engram-open-collections";

function storedOpenCollections(): Set<string> {
  // Storage can throw in private windows or with site data blocked; start all closed.
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((key) => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

function useOpenCollections(): [Set<string>, (key: string) => void] {
  const [open, setOpen] = useState(storedOpenCollections);
  const toggle = (key: string) => {
    const next = new Set(open);
    if (!next.delete(key)) next.add(key);
    setOpen(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Not remembered after a reload; the collection still opens now.
    }
  };
  return [open, toggle];
}

// Nested rows line their icon up with the name of the collection above: icons are 1rem wide
// with a 0.75rem gap.
function indent(depth: number): { className: string; style: CSSProperties } {
  return {
    className: "ps-[calc(1rem+var(--depth)*1.75rem)] sm:ps-[calc(1.25rem+var(--depth)*1.75rem)]",
    style: { "--depth": depth } as CSSProperties,
  };
}

const rowClass =
  "relative flex items-center gap-3 py-4 pe-4 transition-colors duration-(--duration-fast) hover:bg-muted data-[state=open]:bg-muted sm:pe-5";

function DeckRow({
  node,
  depth,
  handlers,
}: {
  node: DeckLeaf;
  depth: number;
  handlers: RowHandlers;
}) {
  const { deck } = node;
  const navigate = useNavigate();
  const hasWork = deck.due_count + deck.new_count > 0;
  const rowIndent = indent(depth);
  const deckUrl = `/decks/${deck.id}`;
  const actions: RowAction[] = [
    {
      label: "Open",
      icon: SquareArrowOutUpRightIcon,
      onSelect: () => void navigate(deckUrl),
    },
    {
      label: "Open in a new tab",
      icon: ExternalLinkIcon,
      onSelect: () => {
        window.open(deckUrl, "_blank", "noopener");
      },
    },
    ...(hasWork
      ? [{ label: "Study", icon: PlayIcon, onSelect: () => void navigate(`${deckUrl}/study`) }]
      : []),
    "separator",
    {
      label: "Export as JSON",
      icon: DownloadIcon,
      onSelect: () => {
        handlers.onExport(deck);
      },
    },
    {
      label: deck.role === "owner" ? "Share deck" : "Members",
      icon: deck.role === "owner" ? UserPlusIcon : UsersIcon,
      onSelect: () => {
        handlers.onDialog("deck-members", deck.id);
      },
    },
    {
      label: "Deck settings",
      icon: SettingsIcon,
      onSelect: () => {
        handlers.onDialog("deck-settings", deck.id);
      },
    },
  ];
  return (
    <RowContextMenu actions={actions}>
      <li className={cn(rowClass, rowIndent.className)} style={rowIndent.style}>
        <GalleryVerticalEndIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="grid min-w-0 flex-1 gap-1">
          {/* The link covers the whole row; the Study button sits above it. */}
          <Link
            to={`/decks/${deck.id}`}
            className="truncate font-medium after:absolute after:inset-0 after:content-['']"
          >
            {node.name}
          </Link>
          <p className="text-sm text-muted-foreground tabular-nums">
            {studyCountsText(deck.due_count, deck.new_count)} · {plural(deck.card_count, "card")}
            {deck.role !== "owner" && <> · shared with you as {deck.role}</>}
          </p>
        </div>
        {hasWork ? (
          <Button asChild variant="secondary" size="sm" className="relative">
            <Link to={`/decks/${deck.id}/study`} aria-label={`Study ${deckDisplayName(deck.name)}`}>
              <PlayIcon aria-hidden />
              Study
            </Link>
          </Button>
        ) : (
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </li>
    </RowContextMenu>
  );
}

function CollectionRow({
  node,
  depth,
  handlers,
}: {
  node: Collection;
  depth: number;
  handlers: RowHandlers;
}) {
  const { open, onToggle, onDialog } = handlers;
  const navigate = useNavigate();
  const isOpen = open.has(node.key);
  const listId = `collection-${encodeURIComponent(node.key)}`;
  const rowIndent = indent(depth);
  const displayName = deckDisplayName(node.key);
  const ownsDecks = collectionDecks(node).some((deck) => deck.role === "owner");
  const hasWork = node.dueCount + node.newCount > 0;
  // The same two actions as the "More actions" menu, which stays for keyboards and touch.
  const shared: Exclude<RowAction, "separator">[] = [
    {
      label: ownsDecks ? "Share collection" : "Members",
      icon: ownsDecks ? UserPlusIcon : UsersIcon,
      onSelect: () => {
        onDialog("share", node.key);
      },
    },
    {
      label: "Collection settings",
      icon: SettingsIcon,
      onSelect: () => {
        onDialog("settings", node.key);
      },
    },
  ];
  const actions: RowAction[] = [
    {
      label: isOpen ? "Collapse" : "Expand",
      icon: isOpen ? ChevronsDownUpIcon : ChevronsUpDownIcon,
      onSelect: () => {
        onToggle(node.key);
      },
    },
    ...(hasWork
      ? [
          {
            label: "Study collection",
            icon: PlayIcon,
            onSelect: () => void navigate(collectionStudyUrl(node.key)),
          },
        ]
      : []),
    "separator",
    ...shared,
  ];
  return (
    <li>
      <RowContextMenu actions={actions}>
        <div className={cn(rowClass, rowIndent.className)} style={rowIndent.style}>
          {isOpen ? (
            <FolderOpenIcon className="size-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <FolderIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          {/* The toggle covers the whole row; Study and the menu sit above it. */}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={listId}
            onClick={() => {
              onToggle(node.key);
            }}
            className="grid min-w-0 flex-1 gap-1 text-left after:absolute after:inset-0 after:content-['']"
          >
            <span className="truncate font-medium">{node.name}</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {studyCountsText(node.dueCount, node.newCount)} · {plural(node.deckCount, "deck")} ·{" "}
              {plural(node.cardCount, "card")}
            </span>
          </button>
          {hasWork && (
            <Button asChild variant="secondary" size="sm" className="relative">
              <Link to={collectionStudyUrl(node.key)} aria-label={`Study ${displayName}`}>
                <PlayIcon aria-hidden />
                Study
              </Link>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label={`More actions for ${displayName}`}
              >
                <EllipsisIcon aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {shared.map((action) => (
                <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
                  <action.icon aria-hidden />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) ease-standard",
              isOpen && "rotate-180",
            )}
            aria-hidden
          />
        </div>
      </RowContextMenu>
      {/* Slides open by animating the row height from 0 to the content's. Closed decks stay
          in the page, inert, so they can't be focused or read out while hidden. */}
      <div
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows] duration-(--duration-base) ease-standard",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        inert={!isOpen}
      >
        <ul id={listId} className="min-h-0 divide-y divide-border border-t border-border">
          <DeckNodes nodes={node.children} depth={depth + 1} handlers={handlers} />
        </ul>
      </div>
    </li>
  );
}

function DeckNodes({
  nodes,
  depth,
  handlers,
}: {
  nodes: DeckNode[];
  depth: number;
  handlers: RowHandlers;
}) {
  return nodes.map((node) =>
    node.kind === "deck" ? (
      <DeckRow key={node.deck.id} node={node} depth={depth} handlers={handlers} />
    ) : (
      <CollectionRow key={`collection:${node.key}`} node={node} depth={depth} handlers={handlers} />
    ),
  );
}

export function DeckTree({ nodes }: { nodes: DeckNode[] }) {
  const [open, toggle] = useOpenCollections();
  // The dialog stays mounted after closing so it can animate out. It looks its collection or
  // deck up by key on every render, so counts stay current, and a renamed collection or a
  // deleted deck closes it.
  const [dialog, setDialog] = useState<{ kind: DialogKind; key: string; open: boolean } | null>(
    null,
  );
  const collection = dialog && findCollection(nodes, dialog.key);
  const deck = dialog && findDeck(nodes, dialog.key);
  const onOpenChange = (isOpen: boolean) => {
    if (dialog) setDialog({ ...dialog, open: isOpen });
  };
  const exportDeck = useMutation({
    mutationFn: (target: Deck) => downloadFromApi(`/decks/${target.id}/export`, "deck.engram.json"),
  });
  const handlers: RowHandlers = {
    open,
    onToggle: toggle,
    onDialog: (kind, key) => {
      setDialog({ kind, key, open: true });
    },
    onExport: (target) => {
      exportDeck.mutate(target);
    },
  };
  return (
    <>
      <FormError error={exportDeck.error} />
      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
        <DeckNodes nodes={nodes} depth={0} handlers={handlers} />
      </ul>
      {collection && dialog.kind === "share" && (
        <CollectionShareDialog
          key={collection.key}
          collection={collection}
          open={dialog.open}
          onOpenChange={onOpenChange}
        />
      )}
      {collection && dialog.kind === "settings" && (
        <CollectionSettingsDialog
          key={collection.key}
          collection={collection}
          open={dialog.open}
          onOpenChange={onOpenChange}
        />
      )}
      {deck && dialog.kind === "deck-members" && (
        <MembersDialog key={deck.id} deck={deck} open={dialog.open} onOpenChange={onOpenChange} />
      )}
      {deck && dialog.kind === "deck-settings" && (
        <DeckSettingsDialog
          key={deck.id}
          deck={deck}
          open={dialog.open}
          onOpenChange={onOpenChange}
        />
      )}
    </>
  );
}
