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
import { betFormClientSchema, type BetFormClientInput } from "@/lib/validation";

type ApiBet = {
  id: string;
  createdAt: string;
  bettorA: string;
  bettorB: string;
  tickerA: string;
  tickerB: string;
  startDate: string;
  endDate: string;
  status: "open" | "completed";
  result: null | {
    aReturn: number;
    bReturn: number;
    winner: "A" | "B" | "Tie";
  };
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

export default function DashboardPage() {
  const { toast } = useToast();
  const [ongoingBets, setOngoingBets] = useState<ApiBet[]>([]);
  const [completedBets, setCompletedBets] = useState<ApiBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [tickerADetails, setTickerADetails] = useState<SelectedTicker | null>(null);
  const [tickerBDetails, setTickerBDetails] = useState<SelectedTicker | null>(null);

  const defaults = useMemo(() => getDefaultDates(), []);

  const form = useForm<BetFormClientInput>({
    resolver: zodResolver(betFormClientSchema),
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
      const [openResponse, completedResponse] = await Promise.all([
        fetch(`/api/bets?status=open&limit=${PAGE_LIMIT}`),
        fetch(`/api/bets?status=completed&limit=${PAGE_LIMIT}`)
      ]);

      if (!openResponse.ok) {
        const error = await openResponse.json().catch(() => ({}));
        throw new Error(error?.error ?? "Failed to load open bets");
      }
      if (!completedResponse.ok) {
        const error = await completedResponse.json().catch(() => ({}));
        throw new Error(error?.error ?? "Failed to load completed bets");
      }

      const openData = (await openResponse.json()) as { items: ApiBet[] };
      const completedData = (await completedResponse.json()) as { items: ApiBet[] };

      setOngoingBets(openData.items);
      setCompletedBets(completedData.items);
    } catch (error) {
      console.error(error);
      toast({ title: "Unable to load bets", description: error instanceof Error ? error.message : "" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refreshBets();
  }, [refreshBets]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      ...values,
      tickerA: values.tickerA.toUpperCase(),
      tickerB: values.tickerB.toUpperCase()
    };

    try {
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error?.error ?? "Failed to create bet");
      }

      toast({
        title: "Bet created",
        description: `Tracking ${payload.bettorA} vs ${payload.bettorB}`
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
        description: error instanceof Error ? error.message : ""
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
          body: JSON.stringify({ id })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to check bet");
        }

        toast({
          title: "Bet settled",
          description: `Winner: ${data.result?.winner ?? "Tie"}`
        });
        refreshBets();
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to settle bet",
          description: error instanceof Error ? error.message : ""
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
                <Button
                  size="sm"
                  onClick={() => handleCheck(bet.id)}
                  disabled={checkingId === bet.id}
                >
                  {checkingId === bet.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check now"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }, [checkingId, handleCheck, loading, ongoingBets]);

  const completedContent = useMemo(() => {
    if (loading && completedBets.length === 0) {
      return <p className="text-sm text-muted-foreground">Loading completed bets...</p>;
    }

    if (completedBets.length === 0) {
      return <p className="text-sm text-muted-foreground">No completed bets yet.</p>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bettors</TableHead>
            <TableHead>Tickers</TableHead>
            <TableHead>Winner</TableHead>
            <TableHead>A Return</TableHead>
            <TableHead>B Return</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {completedBets.map((bet) => (
            <TableRow key={bet.id}>
              <TableCell className="font-medium">{bet.bettorA} vs {bet.bettorB}</TableCell>
              <TableCell>
                <div className="flex flex-col text-sm">
                  <span>{bet.tickerA}</span>
                  <span>{bet.tickerB}</span>
                </div>
              </TableCell>
              <TableCell>
                {bet.result ? (
                  <Badge variant={bet.result.winner === "Tie" ? "secondary" : "default"}>
                    {bet.result.winner === "Tie" ? "Tie" : bet.result.winner === "A" ? bet.bettorA : bet.bettorB}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
              </TableCell>
              <TableCell>{bet.result ? formatPercent(bet.result.aReturn) : "--"}</TableCell>
              <TableCell>{bet.result ? formatPercent(bet.result.bReturn) : "--"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }, [completedBets, loading]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Side Bets</h1>
        <p className="text-muted-foreground">Friendly wagers on stock performance made simple.</p>
      </div>

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">New Bet</TabsTrigger>
          <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
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
                  <Button type="submit">Create bet</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ongoing">{ongoingContent}</TabsContent>
        <TabsContent value="completed">{completedContent}</TabsContent>
      </Tabs>
    </div>
  );
}
