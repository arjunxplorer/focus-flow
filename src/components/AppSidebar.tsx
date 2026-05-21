import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Coffee, ListChecks, BarChart3, Clock, Plus, LogOut, Trash2, X } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useSections } from "@/hooks/useSections";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queries/keys";
import type { Section } from "@/lib/queries/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const collapsedNavClass = "flex size-full items-center justify-center";
const expandedNavClass = "flex w-full items-center gap-3";

const MAX_SECTIONS = 6;

export type { Section };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const activeSection = params.get("section");

  const { data: sections = [] } = useSections();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const invalidateSections = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sections(userId) });
  };

  const cancelAdding = () => {
    setAdding(false);
    setName("");
  };

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
      invalidateSections();
    }
  };

  const deleteSection = async (id: string) => {
    await supabase.from("sections").delete().eq("id", id);
    invalidateSections();
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className={collapsed ? "items-center px-2 py-4" : "px-4 py-5"}>
        <div className={collapsed ? "flex justify-center" : "flex items-center gap-2.5"}>
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-amber",
              collapsed ? "h-8 w-8" : "h-9 w-9",
            )}
          >
            <Coffee className={cn(collapsed ? "h-4 w-4" : "h-4.5 w-4.5")} strokeWidth={2.2} />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-semibold text-cream">Focus Flow</div>
              <div className="text-xs text-muted-foreground">Late-night sessions</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("px-2", collapsed && "flex flex-col items-center px-0")}>
        <SidebarGroup className={cn(collapsed && "p-2")}>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/" && !activeSection}
                  className="rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  <NavLink to="/" end className={collapsed ? collapsedNavClass : expandedNavClass}>
                    <ListChecks className="h-4 w-4" />
                    {!collapsed && <span>Tasks</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"} className="rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                  <NavLink to="/dashboard" className={collapsed ? collapsedNavClass : expandedNavClass}>
                    <BarChart3 className="h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/history"} className="rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                  <NavLink to="/history" className={collapsed ? collapsedNavClass : expandedNavClass}>
                    <Clock className="h-4 w-4" />
                    {!collapsed && <span>History</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/80">Sections</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((s) => (
                <SidebarMenuItem key={s.id}>
                  <SidebarMenuButton
                    isActive={activeSection === s.id}
                    onClick={() => navigate(`/?section=${s.id}`)}
                    className="rounded-xl data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    <span className="h-2 w-2 rounded-full bg-primary/70" />
                    <span className="flex-1 truncate">{s.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    onClick={() => void deleteSection(s.id)}
                    className="rounded-lg text-muted-foreground hover:text-destructive"
                    aria-label="Delete section"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
                <SidebarMenuItem>
                  {adding ? (
                    <div className="flex items-center gap-1.5 px-2 py-1">
                      <Input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void addSection();
                          if (e.key === "Escape") cancelAdding();
                        }}
                        placeholder="Reading…"
                        className="h-8 flex-1 rounded-lg bg-secondary border-0"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-cream"
                        onClick={cancelAdding}
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className={collapsed ? "flex items-center justify-center p-2" : "p-3"}>
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
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
