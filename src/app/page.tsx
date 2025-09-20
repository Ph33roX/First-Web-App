"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addDays, format } from "date-fns";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import TickerAutocomplete, { SelectedTicker } from "@/components/TickerAutocomplete";
import { formatPercent } from "@/lib/utils";
import { createBetFormSchema, type CreateBetInput } from "@/lib/validation";

type ApiQuoteSnapshot = {
  date: string;
  close: number;
  adjClose: number;
};

type ApiLegResult = {
  ticker: string;
  start: ApiQuoteSnapshot;
  end: ApiQuoteSnapshot;
  raw: number;
  rounded: number;
};

type ApiBetResult = {
  a: ApiLegResult;
  b: ApiLegResult;
  winner: "A" | "B" | "Tie";
};

type ApiBetStatus = "OPEN" | "SETTLED" | "INVALID";

type ApiBet = {
  id: string;
  createdAt: string;
  updatedAt: string;
  settledAt: string | null;
  settlementTxId: string | null;
  settlementError: string | null;
  bettorA: string;
  bettorB: string;
  tickerA: string;
  tickerB: string;
  startDate: string;
  endDate: string;
  status: ApiBetStatus;
  result: ApiBetResult | null;
};

const PAGE_LIMIT = 20;

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return format(date, "MMM d, yyyy");
};

const getDefaultDates = () => {
  const today = new Date();
  return {
    startDate: format(today, "yyyy-MM-dd"),
    endDate: format(addDays(today, 7), "yyyy-MM-dd")
  };
};

const resolveErrorMessage = (data: any, fallback: string) => {
  if (!data) return fallback;
  if (typeof data.error === "string") return data.error;
  if (data.error?.formErrors?.length) return data.error.formErrors[0] as string;
  if (data.error?.fieldErrors) {
    const firstFieldError = Object.values(data.error.fieldErrors).flat()[0];
    if (typeof firstFieldError === "string") {
      return firstFieldError;
    }
  }
  return fallback;
};

const sortClosedBets = (bets: ApiBet[]) =>
  [...bets].sort((a, b) => {
    const left = new Date(a.settledAt ?? a.updatedAt ?? a.createdAt).getTime();
    const right = new Date(b.settledAt ?? b.updatedAt ?? b.createdAt).getTime();
    return right - left;
  });

export default function DashboardPage() {
  const { toast } = useToast();
  const [ongoingBets, setOngoingBets] = useState<ApiBet[]>([]);
  const [closedBets, setClosedBets] = useState<ApiBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [tickerADetails, setTickerADetails] = useState<SelectedTicker | null>(null);
  const [tickerBDetails, setTickerBDetails] = useState<SelectedTicker | null>(null);

  const defaults = useMemo(() => getDefaultDates(), []);

  const form = useForm<CreateBetInput>({
    resolver: zodResolver(createBetFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      bettorA: "",
      bettorB: "",
      tickerA: "",
      tickerB: "",
      ...defaults
    }
  });

  const tickerAValue = form.watch("tickerA");
  const tickerBValue = form.watch("tickerB");

  useEffect(() => {
    form.register("tickerA");
    form.register("tickerB");
  }, [form]);

  const refreshBets = useCallback(async () => {
    setLoading(true);
    try {
      const fetchJson = async <T,>(url: string) => {
        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(resolveErrorMessage(data, `Request failed for ${url}`));
        }
        return data as T;
      };

      const [openData, settledData, invalidData] = await Promise.all([
        fetchJson<{ items: ApiBet[] }>(`/api/bets?status=OPEN&limit=${PAGE_LIMIT}`),
        fetchJson<{ items: ApiBet[] }>(`/api/bets?status=SETTLED&limit=${PAGE_LIMIT}`),
        fetchJson<{ items: ApiBet[] }>(`/api/bets?status=INVALID&limit=${PAGE_LIMIT}`)
      ]);

      setOngoingBets(openData.items);
      setClosedBets(sortClosedBets([...settledData.items, ...invalidData.items]));
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to load bets",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refreshBets();
  }, [refreshBets]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify(values)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(resolveErrorMessage(data, "Failed to create bet"));
      }

      toast({
        title: "Bet created",
        description: `Tracking ${values.bettorA} vs ${values.bettorB}`
      });

      const resetDefaults = getDefaultDates();
      form.reset({
        bettorA: "",
        bettorB: "",
        tickerA: "",
        tickerB: "",
        ...resetDefaults
      });
      setTickerADetails(null);
      setTickerBDetails(null);
      refreshBets();
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to create bet",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const handleCheck = useCallback(
    async (id: string) => {
      setCheckingId(id);
      try {
        const response = await fetch("/api/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          cache: "no-store",
          body: JSON.stringify({ id })
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 202) {
          toast({
            title: "Settlement pending",
            description: data.reason ?? "Waiting for the next available market close."
          });
          refreshBets();
          return;
        }

        if (!response.ok) {
          throw new Error(resolveErrorMessage(data, "Unable to settle bet"));
        }

        if (data.status === "INVALID") {
          toast({
            title: "Bet marked invalid",
            description: data.settlementError ?? "Missing market data for this bet."
          });
        } else {
          const winnerLabel = data.result?.winner === "Tie"
            ? "Tie"
            : data.result?.winner === "A"
              ? data.bettorA
              : data.bettorB;
          toast({
            title: "Bet settled",
            description: `Winner: ${winnerLabel ?? "Tie"}`
          });
        }

        refreshBets();
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to settle bet",
          description: error instanceof Error ? error.message : "Unknown error"
        });
      } finally {
        setCheckingId(null);
      }
    },
    [refreshBets, toast]
  );

  const ongoingContent = useMemo(() => {
    if (loading && ongoingBets.length === 0) {
      return <p className="text-sm text-muted-foreground">Loading ongoing bets...</p>;
    }

    if (ongoingBets.length === 0) {
      return <p className="text-sm text-muted-foreground">No ongoing bets yet. Create one to get started.</p>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bettors</TableHead>
            <TableHead>Tickers</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ongoingBets.map((bet) => (
            <TableRow key={bet.id}>
              <TableCell className="font-medium">{bet.bettorA} vs {bet.bettorB}</TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span>{bet.tickerA}</span>
                  <span>{bet.tickerB}</span>
                </div>
              </TableCell>
              <TableCell>{formatDate(bet.startDate)}</TableCell>
              <TableCell>{formatDate(bet.endDate)}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleCheck(bet.id)}
                    disabled={checkingId === bet.id}
                  >
                    {checkingId === bet.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check now"}
                  </Button>
                  {bet.settlementError && (
                    <p className="max-w-xs text-xs text-muted-foreground">{bet.settlementError}</p>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }, [checkingId, handleCheck, loading, ongoingBets]);

  const closedContent = useMemo(() => {
    if (loading && closedBets.length === 0) {
      return <p className="text-sm text-muted-foreground">Loading closed bets...</p>;
    }

    if (closedBets.length === 0) {
      return <p className="text-sm text-muted-foreground">No closed bets yet.</p>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bettors</TableHead>
            <TableHead>Tickers</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Winner</TableHead>
            <TableHead>A Return</TableHead>
            <TableHead>B Return</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {closedBets.map((bet) => {
            const isInvalid = bet.status === "INVALID";
            const result = bet.result;
            const winnerLabel = result
              ? result.winner === "Tie"
                ? "Tie"
                : result.winner === "A"
                  ? bet.bettorA
                  : bet.bettorB
              : "--";

            return (
              <TableRow key={bet.id}>
                <TableCell className="font-medium">{bet.bettorA} vs {bet.bettorB}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span>{bet.tickerA}</span>
                    <span>{bet.tickerB}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={isInvalid ? "destructive" : "default"}>{isInvalid ? "Invalid" : "Settled"}</Badge>
                </TableCell>
                <TableCell>
                  {result ? (
                    <Badge variant={result.winner === "Tie" ? "secondary" : "default"}>{winnerLabel}</Badge>
                  ) : (
                    <Badge variant="secondary">--</Badge>
                  )}
                </TableCell>
                <TableCell>{formatPercent(result?.a.rounded)}</TableCell>
                <TableCell>{formatPercent(result?.b.rounded)}</TableCell>
                <TableCell className="max-w-sm text-sm text-muted-foreground">
                  {bet.settlementError ?? ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }, [closedBets, loading]);

  const isSubmitting = form.formState.isSubmitting;
  const isSubmitDisabled = !form.formState.isValid || isSubmitting;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Side Bets</h1>
        <p className="text-muted-foreground">Friendly wagers on stock performance made simple.</p>
      </div>

      <Tabs defaultValue="new">
        <TabsList aria-label="Bet management sections">
          <TabsTrigger value="new">New Bet</TabsTrigger>
          <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
          <TabsTrigger value="completed">Closed</TabsTrigger>
        </TabsList>
        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Create a new bet</CardTitle>
              <CardDescription>Enter both bettors, tickers, and date range to start tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bettorA">Bettor A</Label>
                    <Input id="bettorA" {...form.register("bettorA")} placeholder="Alice" />
                    {form.formState.errors.bettorA && (
                      <p className="text-sm text-destructive">{form.formState.errors.bettorA.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bettorB">Bettor B</Label>
                    <Input id="bettorB" {...form.register("bettorB")} placeholder="Bob" />
                    {form.formState.errors.bettorB && (
                      <p className="text-sm text-destructive">{form.formState.errors.bettorB.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tickerA">Ticker A</Label>
                    <TickerAutocomplete
                      id="tickerA"
                      value={tickerAValue}
                      onChange={(v) => {
                        form.setValue("tickerA", v, { shouldDirty: true, shouldValidate: true });
                        setTickerADetails(null);
                      }}
                      onSelect={(t) => {
                        form.setValue("tickerA", t.symbol, { shouldDirty: true, shouldValidate: true });
                        setTickerADetails(t);
                      }}
                      placeholder="AAPL"
                    />
                    {tickerADetails?.name && (
                      <div className="mt-2 text-sm">
                        <div className="font-medium">
                          {tickerADetails.symbol} — {tickerADetails.name}
                        </div>
                        {tickerADetails.description && (
                          <p className="mt-1 text-muted-foreground">{tickerADetails.description}</p>
                        )}
                      </div>
                    )}
                    {form.formState.errors.tickerA && (
                      <p className="text-sm text-destructive">{form.formState.errors.tickerA.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tickerB">Ticker B</Label>
                    <TickerAutocomplete
                      id="tickerB"
                      value={tickerBValue}
                      onChange={(v) => {
                        form.setValue("tickerB", v, { shouldDirty: true, shouldValidate: true });
                        setTickerBDetails(null);
                      }}
                      onSelect={(t) => {
                        form.setValue("tickerB", t.symbol, { shouldDirty: true, shouldValidate: true });
                        setTickerBDetails(t);
                      }}
                      placeholder="MSFT"
                    />
                    {tickerBDetails?.name && (
                      <div className="mt-2 text-sm">
                        <div className="font-medium">
                          {tickerBDetails.symbol} — {tickerBDetails.name}
                        </div>
                        {tickerBDetails.description && (
                          <p className="mt-1 text-muted-foreground">{tickerBDetails.description}</p>
                        )}
                      </div>
                    )}
                    {form.formState.errors.tickerB && (
                      <p className="text-sm text-destructive">{form.formState.errors.tickerB.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start date</Label>
                    <Input id="startDate" type="date" {...form.register("startDate")} />
                    {form.formState.errors.startDate && (
                      <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End date</Label>
                    <Input id="endDate" type="date" {...form.register("endDate")} />
                    {form.formState.errors.endDate && (
                      <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitDisabled}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <span>Create bet</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ongoing">{ongoingContent}</TabsContent>
        <TabsContent value="completed">{closedContent}</TabsContent>
      </Tabs>
    </div>
  );
}
