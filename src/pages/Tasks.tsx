import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Play, Check, Trash2, Coffee, Tag, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useTimer } from "@/contexts/TimerContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfLocalDayIso, localDateKey } from "@/lib/dates";
import { formatFocusTime } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  duration_minutes: number;
  completed: boolean;
  section_id: string | null;
  created_at?: string;
}
interface Section { id: string; name: string }

const PRESETS = [15, 25, 45, 60];

export default function Tasks() {
  const { user } = useAuth();
  const { active, start, remaining } = useTimer();
  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
  const sectionFilter = params.get("section");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(25);
  const [sectionId, setSectionId] = useState<string>("none");
  const [todayFocusSeconds, setTodayFocusSeconds] = useState(0);

  useEffect(() => {
    if (open && sectionFilter) setSectionId(sectionFilter);
    else if (open && !sectionFilter) setSectionId("none");
  }, [open, sectionFilter]);

  const loadTodayFocus = async () => {
    if (!user) return;
    const startIso = startOfLocalDayIso();
    const { data } = await supabase
      .from("focus_sessions")
      .select("started_at,duration_seconds")
      .gte("started_at", startIso);
    const today = localDateKey();
    const total = (data ?? []).reduce((acc, s) => {
      if (!s.started_at || localDateKey(new Date(s.started_at)) !== today) return acc;
      return acc + (s.duration_seconds ?? 0);
    }, 0);
    setTodayFocusSeconds(total);
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const startIso = startOfLocalDayIso();
    const [tasksRes, sectionsRes, sessionsRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,duration_minutes,completed,section_id,created_at,completed_at")
        .or(`and(completed.eq.false,created_at.gte.${startIso}),and(completed.eq.true,completed_at.gte.${startIso})`)
        .order("created_at", { ascending: false }),
      supabase.from("sections").select("id,name"),
      supabase
        .from("focus_sessions")
        .select("started_at,duration_seconds")
        .gte("started_at", startIso),
    ]);
    setTasks(tasksRes.data ?? []);
    setSections(sectionsRes.data ?? []);
    const today = localDateKey();
    const sessions = sessionsRes.data ?? [];
    setTodayFocusSeconds(
      sessions.reduce((acc, sess) => {
        if (!sess.started_at || localDateKey(new Date(sess.started_at)) !== today) return acc;
        return acc + (sess.duration_seconds ?? 0);
      }, 0),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("tasks-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "focus_sessions" }, () => {
        void loadTodayFocus();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  const filtered = sectionFilter ? tasks.filter((t) => t.section_id === sectionFilter) : tasks;
  const currentSection = sections.find((s) => s.id === sectionFilter);
  const liveElapsed = active ? active.durationSeconds - remaining : 0;
  const todayFocusLabel = formatFocusTime(todayFocusSeconds + liveElapsed);

  const create = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title: title.trim(),
      duration_minutes: duration,
      section_id: sectionId === "none" ? null : sectionId,
    });
    if (error) { toast.error(error.message); return; }
    setTitle(""); setDuration(25); setSectionId("none"); setOpen(false);
    load();
  };

  const startTask = async (t: Task) => {
    if (active) {
      toast.error("A timer is already running.");
      return;
    }
    await start(t.id, t.title, t.duration_minutes);
    navigate(`/timer/${t.id}`);
  };

  const complete = async (t: Task) => {
    await supabase.from("tasks").update({
      completed: !t.completed,
      completed_at: !t.completed ? new Date().toISOString() : null,
    }).eq("id", t.id);
    load();
  };

  const remove = async (t: Task) => {
    await supabase.from("tasks").delete().eq("id", t.id);
    load();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-cream">
            {currentSection ? currentSection.name : "Tasks"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentSection ? "Filtered by section" : "Everything brewing right now."}
          </p>
          {!loading && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary">
              <Clock className="h-3.5 w-3.5" />
              <span>
                <span className="font-medium tabular-nums">{todayFocusLabel}</span>
                <span className="text-muted-foreground"> focused today</span>
              </span>
            </p>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber">
              <Plus className="mr-1.5 h-4 w-4" /> New task
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-3xl border-0 bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-cream">New task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Read chapter 4…"
                  className="rounded-xl border-0 bg-secondary"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Select value={sectionId} onValueChange={setSectionId}>
                  <SelectTrigger className="rounded-xl border-0 bg-secondary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No section</SelectItem>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDuration(p)}
                      className={`rounded-xl px-3.5 py-1.5 text-sm transition ${
                        duration === p
                          ? "bg-primary text-primary-foreground shadow-amber"
                          : "bg-secondary text-cream hover:bg-secondary/70"
                      }`}
                    >
                      {p} min
                    </button>
                  ))}
                  <Input
                    type="number"
                    min={1}
                    max={240}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 rounded-xl border-0 bg-secondary"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={create} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                Add task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[78px] rounded-2xl shimmer-warm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              section={sections.find((s) => s.id === t.section_id)?.name}
              onStart={() => startTask(t)}
              onComplete={() => complete(t)}
              onDelete={() => remove(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task, section, onStart, onComplete, onDelete,
}: {
  task: Task;
  section?: string;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const isDone = task.completed;
  return (
    <div
      className={`group flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-amber transition hover:bg-surface-raised ${
        isDone ? "opacity-70" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`truncate font-medium ${
            isDone ? "text-muted-foreground line-through" : "text-cream"
          }`}
        >
          {task.title}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {section && (
            <span className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5">
              <Tag className="h-3 w-3" />
              {section}
            </span>
          )}
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-primary">
            {task.duration_minutes} min
          </span>
        </div>
      </div>

      {!isDone && (
        <Button
          size="sm"
          onClick={onStart}
          className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-amber"
        >
          <Play className="mr-1 h-3.5 w-3.5" /> Start
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        onClick={onComplete}
        className={`h-9 w-9 rounded-xl ${
          isDone ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-cream"
        }`}
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onDelete}
        className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-card/60 px-6 py-16 text-center shadow-amber">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
        <Coffee className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-cream">Nothing brewing today</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add a task to get started.
      </p>
    </div>
  );
}
