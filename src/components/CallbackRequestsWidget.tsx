import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  History,
  Loader2,
  PhoneCall,
  PlusCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";

type CallbackRequest = Tables<"callback_requests">;

const PRIORITY_BADGE: Record<
  CallbackRequest["priority"],
  { label: string; className: string }
> = {
  low: {
    label: "Niski",
    className: "bg-muted text-muted-foreground",
  },
  normal: {
    label: "Normalny",
    className: "bg-blue-100 text-blue-700",
  },
  high: {
    label: "Wysoki",
    className: "bg-red-100 text-red-700",
  },
};

const STATUS_BADGE: Record<
  CallbackRequest["status"],
  { label: string; variant: "secondary" | "default" | "outline" | "destructive" }
> = {
  pending: { label: "Do oddzwonienia", variant: "secondary" },
  in_progress: { label: "W trakcie", variant: "default" },
  completed: { label: "Zakończone", variant: "outline" },
  cancelled: { label: "Anulowane", variant: "outline" },
  expired: { label: "Przeniesione", variant: "destructive" },
};

const PRIORITY_ORDER: Record<CallbackRequest["priority"], number> = {
  high: 0,
  normal: 1,
  low: 2,
};

const STATUS_ORDER: Record<CallbackRequest["status"], number> = {
  pending: 0,
  in_progress: 1,
  expired: 2,
  completed: 3,
  cancelled: 4,
};

interface CallbackRequestsWidgetProps {
  className?: string;
}

const DEFAULT_LIMIT = 8;
const MUTATION_STATUSES: Array<CallbackRequest["status"]> = [
  "pending",
  "in_progress",
];

export const CallbackRequestsWidget: React.FC<CallbackRequestsWidgetProps> = ({
  className = "",
}) => {
  const [requests, setRequests] = useState<CallbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [showAllToday, setShowAllToday] = useState(false);
  const [mutating, setMutating] = useState<Set<string>>(new Set());

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split("T")[0];

      let query = supabase
        .from("callback_requests")
        .select("*")
        .in("status", ["pending", "in_progress"])
        .order("priority", { ascending: true })
        .order("callback_date", { ascending: true })
        .order("requested_at", { ascending: true });

      if (!showAllToday) {
        query = query.or(`callback_date.eq.${today},callback_date.lt.${today}`);
      }

      query = query.limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      setRequests(data || []);
    } catch (err) {
      console.error("Error fetching callback requests:", err);
      setError("Nie udało się pobrać próśb o oddzwonienie");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [limit, showAllToday]);

  const markCompleted = async (id: string) => {
    try {
      setMutating((prev) => new Set(prev).add(id));
      const { error } = await supabase
        .from("callback_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await fetchRequests();
    } catch (err) {
      console.error("Error marking callback request as completed:", err);
      setError("Nie udało się oznaczyć prośby jako wykonanej");
    } finally {
      setMutating((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }
      if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }
      return new Date(a.callback_date).getTime() - new Date(b.callback_date).getTime();
    });
  }, [requests]);

  const renderItem = (request: CallbackRequest) => {
    const priorityMeta = PRIORITY_BADGE[request.priority];
    const statusMeta = STATUS_BADGE[request.status];

    const requestedDate = new Date(request.requested_at);
    const requestedAt = requestedDate.toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div
        key={request.id}
        className="border rounded-lg p-4 bg-white shadow-sm hover:shadow transition-shadow"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 flex-1">
            <span className="font-medium text-sm text-gray-900">
              {request.reason}
            </span>
            {request.patient_name && (
              <p className="text-sm text-muted-foreground">
                {request.patient_name}
              </p>
            )}
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <PhoneCall className="h-3.5 w-3.5" />
              <span>{request.phone}</span>
              <span className="text-xs text-muted-foreground">
                {requestedAt}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={`${priorityMeta.className} font-normal uppercase`}
              >
                {priorityMeta.label}
              </Badge>
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <History className="h-3.5 w-3.5" />
              <span>
                Oddzwonić:{" "}
                {new Date(request.callback_date).toLocaleDateString("pl-PL")}
              </span>
            </div>
            {request.preferred_time && (
              <div className="text-xs text-muted-foreground">
                Preferowana pora: {request.preferred_time}
              </div>
            )}
            {MUTATION_STATUSES.includes(request.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markCompleted(request.id)}
                className="flex items-center gap-2 mt-2"
                disabled={mutating.has(request.id)}
              >
                {mutating.has(request.id) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Oznaczanie...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Oddzwoniono
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        {request.message && (
          <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
            {request.message}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Prośby o oddzwonienie</CardTitle>
            <CardDescription>
              Najważniejsze zgłoszenia z telefonicznego agenta
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setShowAllToday((prev) => !prev)}
            >
              <PlusCircle className="h-4 w-4" />
              {showAllToday ? "Tylko dziś" : "Pokaż wszystkie"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRequests()}
              className="flex items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Odświeżanie...
                </>
              ) : (
                <>
                  <History className="h-4 w-4" />
                  Odśwież
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            Ładowanie próśb o oddzwonienie...
          </div>
        ) : sortedRequests.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border border-dashed rounded-md">
            Brak otwartych próśb o oddzwonienie
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRequests.map((request) => renderItem(request))}
          </div>
        )}

        {sortedRequests.length >= limit && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLimit((prev) => prev + DEFAULT_LIMIT)}
            >
              Pokaż więcej
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CallbackRequestsWidget;

