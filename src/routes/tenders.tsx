import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchTenders, type Tender } from "@/lib/tenders-api";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_OPTIONS[0];

export const Route = createFileRoute("/tenders")({
  component: TendersPage,
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFee(value: number | null) {
  if (value === null) return "Not specified";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

function getSafeTenderUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function getPageItems(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const items: Array<number | "ellipsis"> = [];

  if (start > 1) {
    items.push(1);
    if (start > 2) items.push("ellipsis");
  }
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages) {
    if (end < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);
  }

  return items;
}

function TendersPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchTenders(controller.signal)
      .then((response) => {
        setTenders(response.tenders);
        setGeneratedAt(response.generated_at);
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load tenders.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const filteredTenders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return tenders;
    return tenders.filter((tender) =>
      [
        tender.tender_ref,
        tender.title,
        tender.procuring_entity,
        tender.entity_type,
        tender.venue,
      ].some((value) => value.toLocaleLowerCase().includes(query)),
    );
  }, [search, tenders]);

  const totalPages = Math.ceil(filteredTenders.length / pageSize);
  const page = Math.min(currentPage, Math.max(totalPages, 1));
  const pageTenders = filteredTenders.slice((page - 1) * pageSize, page * pageSize);
  const firstItem = filteredTenders.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, filteredTenders.length);
  const pageItems = getPageItems(page, totalPages);

  const changeSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  return (
    <AppShell title="Tenders">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Kenya Tenders</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse current procurement opportunities from tenders.go.ke.
            </p>
            {generatedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Data updated {formatDate(generatedAt)}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="gap-2 self-start sm:self-auto"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Tender opportunities</CardTitle>
                <CardDescription>
                  {isLoading ? "Loading available tenders…" : `${filteredTenders.length} tenders`}
                </CardDescription>
              </div>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder="Search tenders..."
                aria-label="Search tenders"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setRefreshKey((key) => key + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : isLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tenders…
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Tender reference</TableHead>
                      <TableHead className="min-w-64">Opportunity</TableHead>
                      <TableHead className="min-w-48">Procuring entity</TableHead>
                      <TableHead className="whitespace-nowrap">Published</TableHead>
                      <TableHead className="whitespace-nowrap">Closing date</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Fee</TableHead>
                      <TableHead className="text-right">Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageTenders.map((tender) => (
                      <TenderRow key={tender.tender_id} tender={tender} />
                    ))}
                    {pageTenders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                          {search.trim()
                            ? "No tenders match your search."
                            : "No tenders are currently available."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="mt-4 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span>
                      Showing {firstItem}–{lastItem} of {filteredTenders.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap">Rows per page</span>
                      <Select
                        value={String(pageSize)}
                        onValueChange={(value) => {
                          setPageSize(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-20" aria-label="Rows per page">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={String(option)}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {totalPages > 1 && (
                    <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                      <PaginationContent>
                        <PaginationItem>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
                            disabled={page <= 1}
                            aria-label="Go to previous page"
                          >
                            Previous
                          </Button>
                        </PaginationItem>
                        {pageItems.map((item, index) => (
                          <PaginationItem key={`${item}-${index}`}>
                            {item === "ellipsis" ? (
                              <PaginationEllipsis />
                            ) : (
                              <Button
                                variant={item === page ? "outline" : "ghost"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(item)}
                                aria-label={`Go to page ${item}`}
                                aria-current={item === page ? "page" : undefined}
                              >
                                {item}
                              </Button>
                            )}
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setCurrentPage((value) => Math.min(totalPages, value + 1))
                            }
                            disabled={page >= totalPages}
                            aria-label="Go to next page"
                          >
                            Next
                          </Button>
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function TenderRow({ tender }: { tender: Tender }) {
  const tenderUrl = getSafeTenderUrl(tender.tender_url);
  const isClosed = new Date(tender.close_at).getTime() <= Date.now();

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-medium">{tender.tender_ref}</TableCell>
      <TableCell>
        <div className="font-medium text-foreground">{tender.title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{tender.venue}</div>
      </TableCell>
      <TableCell>
        <div>{tender.procuring_entity}</div>
        <Badge variant="secondary" className="mt-1 font-normal">
          {tender.entity_type}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {formatDate(tender.published_at)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div>{formatDate(tender.close_at)}</div>
        <Badge variant={isClosed ? "outline" : "default"} className="mt-1">
          {isClosed ? "Closed" : "Open"}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">{formatFee(tender.tender_fee)}</TableCell>
      <TableCell className="text-right">
        {tenderUrl ? (
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <a href={tenderUrl} target="_blank" rel="noopener noreferrer">
              View <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Unavailable</span>
        )}
      </TableCell>
    </TableRow>
  );
}
