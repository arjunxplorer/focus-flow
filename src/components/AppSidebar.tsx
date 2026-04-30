import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Coffee, ListChecks, BarChart3, Clock, Plus, LogOut, Tag, Trash2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_SECTIONS = 6;

export interface Section {
  id: string;
  name: string;
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const activeSection = params.get("section");

  const [sections, setSections] = useState<Section[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("sections").select("id,name").order("created_at");
    setSections(data ?? []);
  };

  useEffect(() => { load(); }, [user]);

  const addSection = async () => {
    if (!user || !name.trim()) return;
    if (sections.length >= MAX_SECTIONS) {
      toast.error(`You can have at most ${MAX_SECTIONS} sections.`);
      return;
    }
    const { error } = await supabase.from("sections").insert({ user_id: user.id, name: name.trim() });
    if (error) {
      if (error.message?.includes("SECTION_LIMIT_REACHED")) {
        toast.error(`You can have at most ${MAX_SECTIONS} sections.`);
      } else {
        toast.error(error.message);
      }
    } else {
      setName("");
      setAdding(false);
      load();
    }
  };

  const deleteSection = async (id: string) => {
    await supabase.from("sections").delete().eq("id", id);
    load();
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-amber">
            <Coffee className="h-4.5 w-4.5" strokeWidth={2.2} />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-semibold text-cream">Focus Flow</div>
              <div className="text-xs text-muted-foreground">Late-night sessions</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/"} className="rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                  <NavLink to="/" className="flex items-center gap-3">
                    <ListChecks className="h-4 w-4" />
                    {!collapsed && <span>Tasks</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"} className="rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                  <NavLink to="/dashboard" className="flex items-center gap-3">
                    <BarChart3 className="h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/history"} className="rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                  <NavLink to="/history" className="flex items-center gap-3">
                    <Clock className="h-4 w-4" />
                    {!collapsed && <span>History</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/80">
            {!collapsed ? "Sections" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/" && !activeSection}
                  onClick={() => navigate("/")}
                  className="rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  <Tag className="h-4 w-4" />
                  {!collapsed && <span>All tasks</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {sections.map((s) => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton
                    isActive={activeSection === s.id}
                    onClick={() => navigate(`/?section=${s.id}`)}
                    className="group rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    <span className="h-2 w-2 rounded-full bg-primary/70" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{s.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSection(s.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete section"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {!collapsed && (
                <SidebarMenuItem>
                  {adding ? (
                    <div className="flex gap-1.5 px-2 py-1">
                      <Input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addSection();
                          if (e.key === "Escape") { setAdding(false); setName(""); }
                        }}
                        placeholder="Reading…"
                        className="h-8 rounded-lg bg-secondary border-0"
                      />
                    </div>
                  ) : sections.length >= MAX_SECTIONS ? (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <SidebarMenuButton
                              disabled
                              className="rounded-xl text-muted-foreground/50 cursor-not-allowed"
                            >
                              <Plus className="h-4 w-4" />
                              <span>New section</span>
                            </SidebarMenuButton>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="rounded-lg bg-popover text-cream text-xs">
                          Maximum {MAX_SECTIONS} sections reached
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <SidebarMenuButton onClick={() => setAdding(true)} className="rounded-xl text-muted-foreground hover:text-cream">
                      <Plus className="h-4 w-4" />
                      <span>New section</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-secondary/60 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
              {(user.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <div className="truncate text-cream">{user.email}</div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-cream"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
        {collapsed && (
          <Button size="icon" variant="ghost" className="rounded-xl" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
