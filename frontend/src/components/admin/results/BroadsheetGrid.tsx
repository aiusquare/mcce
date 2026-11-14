import { useRef, useState, useEffect, useCallback } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Navigation,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cleanCorruptedChars } from "@/lib/api";

interface BroadsheetGridProps {
  broadsheet: any;
  displayedStudents: any[];
}

export function BroadsheetGrid({ broadsheet, displayedStudents }: BroadsheetGridProps) {
  if (!broadsheet) return null;

  const currentCourses = broadsheet.current_courses || [];
  const carryoverCourses = broadsheet.carryover_courses || [];

  const containerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);

  // Active scroller tracking to completely eliminate scroll event feedback loops
  const activeScrollerRef = useRef<"main" | "top" | "bottom" | null>(null);
  const scrollTimeoutRef = useRef<any>(null);

  const [selectedRow, setSelectedRow] = useState<number>(0);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"compact" | "page" | "fullscreen">("compact");
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(2400);

  // Manage body scroll locking when in fullscreen mode
  useEffect(() => {
    if (viewMode === "fullscreen") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [viewMode]);

  // Handle ESC key to exit fullscreen mode
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && viewMode === "fullscreen") {
        setViewMode("compact");
      }
    };
    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [viewMode]);

  // Measure and keep tableScrollWidth in sync with container DOM
  useEffect(() => {
    const updateScrollWidth = () => {
      if (containerRef.current) {
        const tableEl = containerRef.current.querySelector("table");
        const sw = Math.max(
          containerRef.current.scrollWidth,
          tableEl?.scrollWidth ?? 0,
          tableEl?.offsetWidth ?? 0
        );
        if (sw > 0) {
          setTableScrollWidth(sw);
        }
      }
    };

    updateScrollWidth();
    const timer1 = setTimeout(updateScrollWidth, 100);
    const timer2 = setTimeout(updateScrollWidth, 400);

    window.addEventListener("resize", updateScrollWidth);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener("resize", updateScrollWidth);
    };
  }, [currentCourses.length, carryoverCourses.length, displayedStudents.length, viewMode]);

  // Set active scroller token with debounce
  const setActiveScroller = (scroller: "main" | "top" | "bottom") => {
    if (activeScrollerRef.current === null) {
      activeScrollerRef.current = scroller;
    }
    clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      activeScrollerRef.current = null;
    }, 120);
  };

  // Synchronized scroll handlers between main container, top scrollbar, and floating bottom scrollbar
  const handleMainScroll = useCallback(() => {
    if (activeScrollerRef.current !== null && activeScrollerRef.current !== "main") {
      return;
    }
    setActiveScroller("main");
    const sl = containerRef.current?.scrollLeft ?? 0;
    if (topScrollRef.current && topScrollRef.current.scrollLeft !== sl) {
      topScrollRef.current.scrollLeft = sl;
    }
    if (bottomScrollRef.current && bottomScrollRef.current.scrollLeft !== sl) {
      bottomScrollRef.current.scrollLeft = sl;
    }
  }, []);

  const handleTopScroll = useCallback(() => {
    if (activeScrollerRef.current !== null && activeScrollerRef.current !== "top") {
      return;
    }
    setActiveScroller("top");
    const sl = topScrollRef.current?.scrollLeft ?? 0;
    if (containerRef.current && containerRef.current.scrollLeft !== sl) {
      containerRef.current.scrollLeft = sl;
    }
    if (bottomScrollRef.current && bottomScrollRef.current.scrollLeft !== sl) {
      bottomScrollRef.current.scrollLeft = sl;
    }
  }, []);

  const handleBottomScroll = useCallback(() => {
    if (activeScrollerRef.current !== null && activeScrollerRef.current !== "bottom") {
      return;
    }
    setActiveScroller("bottom");
    const sl = bottomScrollRef.current?.scrollLeft ?? 0;
    if (containerRef.current && containerRef.current.scrollLeft !== sl) {
      containerRef.current.scrollLeft = sl;
    }
    if (topScrollRef.current && topScrollRef.current.scrollLeft !== sl) {
      topScrollRef.current.scrollLeft = sl;
    }
  }, []);

  const handleWheelOnScrollbar = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    if (delta !== 0 && containerRef.current) {
      containerRef.current.scrollLeft += delta;
    }
  }, []);

  // Step scroll horizontally (Left / Right)
  const scrollHorizontal = useCallback((direction: "left" | "right", amount = 320) => {
    const container = containerRef.current;
    if (!container) return;
    const delta = direction === "left" ? -amount : amount;
    container.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  // Step scroll vertically (Up / Down) - handles both inner container and outer window
  const scrollVertical = useCallback((direction: "up" | "down", amount = 160) => {
    const container = containerRef.current;
    if (!container) return;
    const delta = direction === "up" ? -amount : amount;

    if (container.scrollHeight > container.clientHeight + 20) {
      container.scrollBy({ top: delta, behavior: "smooth" });
    } else {
      window.scrollBy({ top: delta, behavior: "smooth" });
    }
  }, []);

  // Keep selected row scrolled into view vertically both in container and on screen
  const scrollRowIntoView = useCallback((rowIndex: number) => {
    if (rowIndex < 0 || !containerRef.current) return;
    const rowEl = containerRef.current.querySelector(
      `[data-row-index="${rowIndex}"]`
    ) as HTMLElement | null;

    if (rowEl) {
      const container = containerRef.current;
      const rowTop = rowEl.offsetTop;
      const rowHeight = rowEl.offsetHeight;
      const headerHeight = 72; // sticky thead height
      const scrollY = container.scrollTop;
      const visibleHeight = container.clientHeight;

      if (rowTop < scrollY + headerHeight) {
        container.scrollTo({
          top: Math.max(0, rowTop - headerHeight - 8),
          behavior: "smooth",
        });
      } else if (rowTop + rowHeight > scrollY + visibleHeight) {
        container.scrollTo({
          top: rowTop + rowHeight - visibleHeight + 8,
          behavior: "smooth",
        });
      }

      // Check viewport visibility for natural page scrolling
      const rect = rowEl.getBoundingClientRect();
      if (rect.top < 120) {
        window.scrollBy({ top: rect.top - 140, behavior: "smooth" });
      } else if (rect.bottom > window.innerHeight - 80) {
        window.scrollBy({ top: rect.bottom - window.innerHeight + 100, behavior: "smooth" });
      }
    }
  }, []);

  useEffect(() => {
    scrollRowIntoView(selectedRow);
  }, [selectedRow, scrollRowIntoView]);

  // Global window keyboard listener - arrow keys work immediately without clicking first
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in forms, search bars, selects, or textareas
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName;
      if (
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        activeEl?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      const container = containerRef.current;
      if (!container || displayedStudents.length === 0) return;

      const colStep = e.shiftKey ? 380 : 180;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          container.scrollBy({ left: -colStep, behavior: "smooth" });
          break;

        case "ArrowRight":
          e.preventDefault();
          container.scrollBy({ left: colStep, behavior: "smooth" });
          break;

        case "ArrowDown":
          e.preventDefault();
          setSelectedRow((prev) => Math.min(displayedStudents.length - 1, prev + 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedRow((prev) => Math.max(0, prev - 1));
          break;

        case "PageDown":
          e.preventDefault();
          if (container.scrollHeight > container.clientHeight + 20) {
            container.scrollBy({ top: container.clientHeight * 0.75, behavior: "smooth" });
          } else {
            window.scrollBy({ top: window.innerHeight * 0.65, behavior: "smooth" });
          }
          break;

        case "PageUp":
          e.preventDefault();
          if (container.scrollHeight > container.clientHeight + 20) {
            container.scrollBy({ top: -container.clientHeight * 0.75, behavior: "smooth" });
          } else {
            window.scrollBy({ top: -window.innerHeight * 0.65, behavior: "smooth" });
          }
          break;

        case "Home":
          e.preventDefault();
          if (e.ctrlKey) {
            setSelectedRow(0);
            container.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            container.scrollTo({ left: 0, behavior: "smooth" });
          }
          break;

        case "End":
          e.preventDefault();
          if (e.ctrlKey) {
            setSelectedRow(displayedStudents.length - 1);
            container.scrollTo({
              top: container.scrollHeight,
              left: container.scrollWidth,
              behavior: "smooth",
            });
          } else {
            container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [displayedStudents.length]);

  // Section jump handler with exact DOM offset calculation
  const scrollToSection = useCallback(
    (
      section:
        | "start"
        | "current"
        | "carryover"
        | "gpa"
        | "remarks"
        | "top"
        | "bottom"
    ) => {
      const container = containerRef.current;
      if (!container) return;

      const frozenLeftWidth = 286; // S/N (46) + Name/Matric (240)

      if (section === "top") {
        setSelectedRow(0);
        container.scrollTo({ top: 0, behavior: "smooth" });
        container.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (section === "bottom") {
        setSelectedRow(displayedStudents.length - 1);
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
        container.scrollIntoView({ behavior: "smooth", block: "end" });
        return;
      }

      if (section === "start") {
        container.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }

      if (section === "remarks") {
        container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
        return;
      }

      // Query the specific section header cell to compute exact target scrollLeft
      let selector = "";
      if (section === "current") selector = '[data-section="current-courses"]';
      else if (section === "carryover") selector = '[data-section="carryover-courses"]';
      else if (section === "gpa") selector = '[data-section="stats-current"]';

      const headerEl = selector ? (container.querySelector(selector) as HTMLElement | null) : null;
      if (headerEl) {
        const targetLeft = Math.max(0, headerEl.offsetLeft - frozenLeftWidth);
        container.scrollTo({ left: targetLeft, behavior: "smooth" });
      } else {
        // Fallback offset calculation
        if (section === "current") {
          container.scrollTo({ left: frozenLeftWidth, behavior: "smooth" });
        } else if (section === "carryover") {
          container.scrollTo({ left: frozenLeftWidth + currentCourses.length * 75, behavior: "smooth" });
        } else if (section === "gpa") {
          container.scrollTo({
            left: frozenLeftWidth + (currentCourses.length + carryoverCourses.length) * 75,
            behavior: "smooth",
          });
        }
      }
    },
    [currentCourses.length, carryoverCourses.length, displayedStudents.length]
  );

  return (
    <div className="space-y-3 relative">
      {/* Fullscreen Backdrop Overlay */}
      {viewMode === "fullscreen" && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
          onClick={() => setViewMode("compact")}
        />
      )}

      {/* Visual Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground p-2.5 px-3 bg-muted/20 border rounded-md print:hidden">
        <span className="font-semibold text-slate-700 dark:text-slate-200">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300"></span>
          <span>Scored (Score + Grade)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block px-1 rounded bg-red-100 text-red-800 font-bold text-[10px]">
            ABS
          </span>
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block px-1 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
            NR
          </span>
          <span>Not Reported / Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-500">—</span>
          <span>Not Registered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-purple-600">*</span>
          <span>Provisional CGPA (Incomplete)</span>
        </div>
      </div>

      {/* Navigation Keys & Interactive Scroll Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg text-xs print:hidden shadow-xs">
        {/* Left: Global Nav Key Status & Step Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Navigation className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-slate-800 dark:text-slate-100">Nav Controls:</span>
            <span className="inline-flex items-center gap-0.5 font-mono text-[10px]">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border shadow-xs font-semibold">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border shadow-xs font-semibold">↓</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border shadow-xs font-semibold">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border shadow-xs font-semibold">→</kbd>
            </span>
          </div>

          <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
            Active Everywhere
          </Badge>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Explicit Scroll Step Buttons */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 text-slate-700 dark:text-slate-200 hover:text-primary font-semibold"
              onClick={() => scrollHorizontal("left", 320)}
              title="Scroll Left (← or Shift + ←)"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
              Left
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 text-slate-700 dark:text-slate-200 hover:text-primary font-semibold"
              onClick={() => scrollHorizontal("right", 320)}
              title="Scroll Right (→ or Shift + →)"
            >
              Right
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 text-slate-700 dark:text-slate-200 hover:text-primary"
              onClick={() => scrollVertical("up", 180)}
              title="Scroll Up (↑)"
            >
              <ArrowUp className="h-3.5 w-3.5 mr-0.5" />
              Up
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 text-slate-700 dark:text-slate-200 hover:text-primary"
              onClick={() => scrollVertical("down", 180)}
              title="Scroll Down (↓)"
            >
              Down
              <ArrowDown className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>

        {/* Right: Section Jumps & View Mode */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Section Jumps */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground font-medium hidden lg:inline">Jump:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2 text-slate-700 hover:text-primary"
              onClick={() => scrollToSection("start")}
              title="Jump to Student Identification (Left)"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Start
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2 text-primary hover:bg-primary/5 font-semibold"
              onClick={() => scrollToSection("current")}
              title="Jump to Current Courses"
            >
              Courses ({currentCourses.length})
            </Button>
            {carryoverCourses.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-2 text-destructive hover:bg-destructive/5 font-semibold"
                onClick={() => scrollToSection("carryover")}
                title="Jump to Carryover Courses"
              >
                Carryovers ({carryoverCourses.length})
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2 text-emerald-700 hover:bg-emerald-50 font-semibold"
              onClick={() => scrollToSection("gpa")}
              title="Jump to GPA, CGPA & Stats"
            >
              GPA & Stats
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-2 text-slate-700 hover:text-primary"
              onClick={() => scrollToSection("remarks")}
              title="Jump to Remarks & Standing (Right)"
            >
              Remarks
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-600 hover:text-primary"
              onClick={() => scrollToSection("top")}
              title="Scroll to Top of Broadsheet"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-600 hover:text-primary"
              onClick={() => scrollToSection("bottom")}
              title="Scroll to Bottom of Broadsheet"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* View Mode Selector: Boxed vs Page Flow vs Fullscreen */}
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-md border p-0.5 bg-muted/40">
              <button
                type="button"
                className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                  viewMode === "compact"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("compact")}
                title="Boxed view: Scrollable frame"
              >
                Boxed
              </button>
              <button
                type="button"
                className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                  viewMode === "page"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("page")}
                title="Page Flow view: Natural full height page scroll"
              >
                Page Flow
              </button>
            </div>

            <Button
              type="button"
              variant={viewMode === "fullscreen" ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px] px-2 text-slate-700"
              onClick={() => setViewMode(viewMode === "fullscreen" ? "compact" : "fullscreen")}
              title={viewMode === "fullscreen" ? "Exit Fullscreen (Esc)" : "Maximize Broadsheet to Full Screen"}
            >
              {viewMode === "fullscreen" ? (
                <>
                  <Minimize2 className="h-3 w-3 mr-1" />
                  Exit
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3 mr-1" />
                  Focus Full
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {displayedStudents.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border rounded-lg print:hidden">
          No students found matching the selected criteria.
        </div>
      ) : (
        <TooltipProvider delayDuration={150}>
          <div className="rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 bg-background flex flex-col">
            {/* Top Synchronized Horizontal Scrollbar */}
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              onWheel={handleWheelOnScrollbar}
              className="w-full overflow-x-auto border-b bg-slate-100/95 dark:bg-slate-800/95 py-1.5 px-1 print:hidden select-none [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.7)_transparent]"
              title="Top Horizontal Scrollbar: Drag or wheel to scroll table horizontally"
            >
              <div style={{ width: tableScrollWidth, height: 8 }} />
            </div>

            {/* Main Table Container: Direct scroll parent of table */}
            <div
              ref={containerRef}
              tabIndex={0}
              role="region"
              aria-label="Result Broadsheet Grid"
              onScroll={handleMainScroll}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={
                viewMode === "fullscreen"
                  ? "fixed inset-2 z-50 overflow-auto border-2 border-primary/30 rounded-xl shadow-2xl bg-background p-3 focus:outline-none focus:ring-2 focus:ring-primary/50 select-none scroll-smooth"
                  : viewMode === "page"
                  ? "relative w-full overflow-x-auto overflow-y-visible focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background select-none scroll-smooth print:overflow-visible"
                  : "relative w-full overflow-auto max-h-[65vh] min-h-[380px] focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background select-none scroll-smooth print:overflow-visible print:max-h-none"
              }
            >
              <table className="w-full caption-bottom text-xs border-separate border-spacing-0 w-max min-w-full print:w-full">
                <TableHeader className="sticky top-0 z-30 bg-muted/95 backdrop-blur-xs shadow-sm print:static">
                  <TableRow className="bg-muted/90 hover:bg-muted/90">
                    <TableHead
                      data-section="student-info"
                      rowSpan={2}
                      className="w-[46px] min-w-[46px] max-w-[46px] sticky top-0 left-0 z-40 bg-slate-100 dark:bg-slate-800 border-r border-b border-l border-slate-200 dark:border-slate-700 text-center font-bold"
                    >
                      S/N
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="w-[240px] min-w-[240px] max-w-[240px] sticky top-0 left-[46px] z-40 bg-slate-100 dark:bg-slate-800 border-r-2 border-r-slate-300 dark:border-r-slate-700 border-b border-slate-200 dark:border-slate-700 font-bold shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] text-left px-3"
                    >
                      Name / Matric No
                    </TableHead>

                    {/* Current Courses Group */}
                    <TableHead
                      data-section="current-courses"
                      colSpan={Math.max(1, currentCourses.length)}
                      className="text-center border-r border-b border-slate-200 dark:border-slate-700 bg-primary/10 text-primary font-bold uppercase tracking-wide"
                    >
                      Current Courses
                    </TableHead>

                    {/* Carryover Courses Group */}
                    <TableHead
                      data-section="carryover-courses"
                      colSpan={Math.max(1, carryoverCourses.length)}
                      className="text-center border-r border-b border-slate-200 dark:border-slate-700 bg-destructive/10 text-destructive font-bold uppercase tracking-wide"
                    >
                      Carryover Courses
                    </TableHead>

                    {/* Current Stats */}
                    <TableHead
                      data-section="stats-current"
                      colSpan={4}
                      className="text-center border-r border-b border-slate-200 dark:border-slate-700 bg-blue-100/70 dark:bg-blue-950/70 font-bold text-blue-900 dark:text-blue-200"
                    >
                      Current
                    </TableHead>
                    {/* Previous Stats */}
                    <TableHead
                      data-section="stats-previous"
                      colSpan={4}
                      className="text-center border-r border-b border-slate-200 dark:border-slate-700 bg-orange-100/70 dark:bg-orange-950/70 font-bold text-orange-900 dark:text-orange-200"
                    >
                      Previous
                    </TableHead>
                    {/* Cumulative Stats */}
                    <TableHead
                      data-section="stats-cumulative"
                      colSpan={4}
                      className="text-center border-r border-b border-slate-200 dark:border-slate-700 bg-green-100/70 dark:bg-green-950/70 font-bold text-green-900 dark:text-green-200"
                    >
                      Cumulative
                    </TableHead>

                    <TableHead
                      data-section="remarks"
                      rowSpan={2}
                      className="text-center min-w-[150px] border-r border-b border-slate-200 dark:border-slate-700 align-bottom font-bold"
                    >
                      Remark & Standing
                    </TableHead>
                  </TableRow>

                  {/* Subheaders */}
                  <TableRow className="bg-muted/70 hover:bg-muted/70">
                    {/* Current Courses Columns */}
                    {currentCourses.length > 0 ? (
                      currentCourses.map((c: any, cIdx: number) => (
                        <TableHead
                          key={`curr_head_${c.course_id || c.course_code}_${cIdx}`}
                          className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[70px] bg-primary/5"
                          title={c.course_title}
                        >
                          <div className="font-bold text-[10px] uppercase whitespace-nowrap">
                            {c.course_code}
                          </div>
                          <div className="font-normal text-[10px] text-muted-foreground">
                            ({c.credit_units})
                          </div>
                        </TableHead>
                      ))
                    ) : (
                      <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[40px] bg-primary/5 text-primary font-bold">
                        —
                      </TableHead>
                    )}

                    {/* Carryover Courses Columns */}
                    {carryoverCourses.length > 0 ? (
                      carryoverCourses.map((c: any, cIdx: number) => (
                        <TableHead
                          key={`co_head_${c.course_id || c.course_code}_${cIdx}`}
                          className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[70px] bg-destructive/5 text-destructive font-bold"
                          title={c.course_title}
                        >
                          <div className="font-bold text-[10px] uppercase whitespace-nowrap">
                            {c.course_code}
                          </div>
                          <div className="font-normal text-[10px]">({c.credit_units})</div>
                        </TableHead>
                      ))
                    ) : (
                      <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[40px] bg-destructive/5 text-destructive font-bold">
                        —
                      </TableHead>
                    )}

                    {/* Current Stats */}
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-blue-50/70 dark:bg-blue-950/50">TCR</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-blue-50/70 dark:bg-blue-950/50">TCE</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-blue-50/70 dark:bg-blue-950/50">TQP</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[45px] text-[10px] font-bold bg-blue-100/70 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200">GPA</TableHead>

                    {/* Previous Stats */}
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-orange-50/70 dark:bg-orange-950/50">CCR</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-orange-50/70 dark:bg-orange-950/50">CCE</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-orange-50/70 dark:bg-orange-950/50">CGP</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[45px] text-[10px] font-bold bg-orange-100/70 dark:bg-orange-900/50 text-orange-900 dark:text-orange-200">CGPA</TableHead>

                    {/* Cumulative Stats */}
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-green-50/70 dark:bg-green-950/50">CCR</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-green-50/70 dark:bg-green-950/50">CCE</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[36px] text-[10px] bg-green-50/70 dark:bg-green-950/50">CGP</TableHead>
                    <TableHead className="text-center px-1 border-r border-b border-slate-200 dark:border-slate-700 min-w-[45px] text-[10px] font-bold bg-green-100/70 dark:bg-green-900/50 text-green-900 dark:text-green-200">CGPA</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {displayedStudents.map((student: any, idx: number) => {
                    const em = (student.entry_mode || "").toLowerCase();
                    const isDE =
                      em.includes("direct") ||
                      em === "de" ||
                      (student.matric_number && /[A-Za-z]+2\/\d+\/\d+/.test(student.matric_number));

                    const isComplete = student.is_complete !== false;
                    const cumCcr = Number(student.cumulative?.registered_credits ?? 0);
                    const cumCgpaNum = parseFloat(String(student.cumulative?.cgpa ?? "0"));
                    const standing: string =
                      student.academic_standing ||
                      (!isComplete
                        ? "INCOMPLETE"
                        : cumCcr > 0
                        ? cumCgpaNum < 1.0
                          ? "WITHDRAWAL"
                          : cumCgpaNum < 1.5
                          ? "PROBATION"
                          : "GOOD_STANDING"
                        : "NONE");

                    const cgpaCellClass =
                      standing === "WITHDRAWAL"
                        ? "bg-red-100/70 text-red-800 font-bold"
                        : standing === "PROBATION"
                        ? "bg-amber-100/70 text-amber-800 font-bold"
                        : !isComplete
                        ? "bg-purple-50 text-purple-900 font-bold"
                        : "bg-green-100/30 text-green-800 font-bold";

                    const baseRemark = String(student.remark || "-")
                      .replace(/\s*\((WITHDRAWAL|PROBATION)\)\s*$/i, "")
                      .trim();

                    const isRowSelected = selectedRow === idx;

                    return (
                      <TableRow
                        key={student.student_id || idx}
                        data-row-index={idx}
                        onClick={() => {
                          setSelectedRow(idx);
                        }}
                        className={`cursor-pointer transition-colors border-b print:break-inside-avoid ${
                          isRowSelected
                            ? "bg-blue-50/80 dark:bg-blue-950/50 ring-1 ring-primary/40"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <TableCell
                          className={`w-[46px] min-w-[46px] max-w-[46px] text-center sticky left-0 z-20 font-mono text-[11px] border-r border-b border-l border-slate-200 dark:border-slate-800 print:static ${
                            isRowSelected
                              ? "bg-blue-100 dark:bg-blue-900 font-bold text-primary border-l-4 border-l-primary"
                              : "bg-background"
                          }`}
                        >
                          {idx + 1}
                        </TableCell>
                        <TableCell
                          className={`w-[240px] min-w-[240px] max-w-[240px] sticky left-[46px] z-20 border-r-2 border-r-slate-300 dark:border-r-slate-700 border-b border-slate-200 dark:border-slate-800 print:static shadow-[3px_0_6px_-2px_rgba(0,0,0,0.12)] px-3 py-2 ${
                            isRowSelected
                              ? "bg-blue-100/90 dark:bg-blue-900/90"
                              : "bg-background"
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="font-semibold text-foreground text-xs leading-snug break-words">
                              {cleanCorruptedChars(
                                student.full_name ||
                                  `${student.last_name}, ${student.first_name} ${student.middle_name || ""}`
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                {student.matric_number || student.admission_number || "-"}
                              </span>
                              {isDE && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200 print:hidden">
                                  DE
                                </span>
                              )}
                            </div>
                            {(student.session_of_entry || student.entry_session || student.session_name) && (
                              <div className="flex items-center text-[10px] text-muted-foreground font-sans print:text-[8px]">
                                <span className="px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  Entry cohort: {student.session_of_entry || student.entry_session || student.session_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Current Course Cells */}
                        {currentCourses.length > 0 ? (
                          currentCourses.map((c: any, cIdx: number) => {
                            const res =
                              student.current_results?.[c.course_id] ??
                              student.current_results?.[c.course_code];
                            const isNR = res?.status === "missing";
                            const isScore = res?.status === "scored";
                            const valStr = String(res?.display_value ?? "-");
                            const isAbs = valStr === "ABS" || valStr.includes("ABS");
                            const isFail = isScore && valStr.includes("F");

                            const tooltipText = isScore
                              ? `CA: ${res.ca_score ?? "—"} | Exam: ${res.exam_score ?? "—"} | Total: ${res.total_score ?? "—"} (${res.grade ?? "—"})${
                                  res.batch_status ? ` [${res.batch_status}]` : ""
                                }`
                              : isNR
                              ? "Score Not Reported (Pending)"
                              : "Not Registered";

                            return (
                              <Tooltip key={`curr_cell_${c.course_id || c.course_code}_${cIdx}`}>
                                <TooltipTrigger asChild>
                                  <TableCell
                                    className={`text-center border-r border-b border-slate-200 dark:border-slate-800 px-1 py-1.5 font-medium min-w-[70px] whitespace-nowrap cursor-default ${
                                      isNR
                                        ? "bg-amber-50/50 text-amber-700 font-bold"
                                        : isAbs
                                        ? "bg-red-50 text-red-700 font-bold"
                                        : isFail
                                        ? "text-red-600 font-semibold"
                                        : ""
                                    }`}
                                  >
                                    {isAbs ? (
                                      <span className="px-1 py-0.5 rounded bg-red-100 text-red-800 text-[10px]">
                                        ABS
                                      </span>
                                    ) : isNR ? (
                                      <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                                        NR
                                      </span>
                                    ) : isFail ? (
                                      <span className="text-destructive font-bold">{valStr}</span>
                                    ) : (
                                      valStr || "—"
                                    )}
                                  </TableCell>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs font-medium">
                                  <div className="font-bold">{c.course_code} - {c.course_title}</div>
                                  <div>{tooltipText}</div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })
                        ) : (
                          <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 px-1 py-1.5 font-medium min-w-[40px]">
                            —
                          </TableCell>
                        )}

                        {/* Carryover Course Cells */}
                        {carryoverCourses.length > 0 ? (
                          carryoverCourses.map((c: any, cIdx: number) => {
                            let rawVal = null;
                            if (Array.isArray(student.carryover_results)) {
                              rawVal = student.carryover_results[cIdx];
                            } else if (
                              student.carryover_results &&
                              typeof student.carryover_results === "object"
                            ) {
                              rawVal =
                                student.carryover_results[c.course_id] ??
                                student.carryover_results[c.course_code];
                            }
                            const valStr = String(rawVal ?? "-");
                            const isCoFailOrAbs =
                              valStr === "ABS" || valStr.includes("ABS") || valStr.includes("F");
                            return (
                              <TableCell
                                key={`co_cell_${c.course_id || c.course_code}_${cIdx}`}
                                className={`text-center border-r border-b border-slate-200 dark:border-slate-800 px-1 py-1.5 font-medium min-w-[70px] whitespace-nowrap bg-destructive/5 ${
                                  isCoFailOrAbs ? "text-destructive font-bold" : "text-destructive/80"
                                }`}
                              >
                                {isCoFailOrAbs ? (
                                  <span className="text-destructive font-bold">{valStr}</span>
                                ) : (
                                  valStr || "—"
                                )}
                              </TableCell>
                            );
                          })
                        ) : (
                          <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 px-1 py-1.5 font-medium min-w-[40px] bg-destructive/5 text-destructive/80">
                            —
                          </TableCell>
                        )}

                        {/* Current Stats */}
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-blue-50/10 font-mono">
                          {student.current.registered_credits}
                        </TableCell>
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-blue-50/10 font-mono">
                          {student.current.earned_credits}
                        </TableCell>
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-blue-50/10 font-mono">
                          {student.current.quality_points}
                        </TableCell>
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 font-bold bg-blue-100/30 text-blue-900 font-mono">
                          {student.current.gpa}
                        </TableCell>

                        {/* Previous Stats */}
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-orange-50/10 font-mono">
                          {student.previous.registered_credits}
                        </TableCell>
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-orange-50/10 font-mono">
                          {student.previous.earned_credits}
                        </TableCell>
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-orange-50/10 font-mono">
                          {student.previous.quality_points}
                        </TableCell>
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 font-bold bg-orange-100/30 text-orange-900 font-mono">
                          {student.previous.cgpa}
                        </TableCell>

                        {/* Cumulative Stats */}
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-green-50/10 font-mono">
                          {student.cumulative.registered_credits}
                        </TableCell>
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-green-50/10 font-mono">
                          {student.cumulative.earned_credits}
                        </TableCell>
                        <TableCell className="text-center border-r border-b border-slate-200 dark:border-slate-800 bg-green-50/10 font-mono">
                          {student.cumulative.quality_points}
                        </TableCell>
                        <TableCell className={`text-center border-r border-b border-slate-200 dark:border-slate-800 font-mono ${cgpaCellClass}`}>
                          {student.cumulative.cgpa}
                          {!isComplete && (
                            <span className="text-purple-600 font-bold ml-0.5" title="Provisional CGPA (Incomplete Scores)">
                              *
                            </span>
                          )}
                        </TableCell>

                        {/* Remark & Standing */}
                        <TableCell className="text-center px-2 border-r border-b border-slate-200 dark:border-slate-800 text-[10px] font-medium leading-tight">
                          <div className="flex flex-col items-center gap-1">
                            {baseRemark === "PASS" ? (
                              <span className="text-green-700 font-bold">{baseRemark}</span>
                            ) : baseRemark === "-" ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="text-destructive font-semibold">{baseRemark}</span>
                            )}
                            {standing === "WITHDRAWAL" && (
                              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 font-bold text-[9px] uppercase tracking-wide">
                                WITHDRAWAL
                              </span>
                            )}
                            {standing === "PROBATION" && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[9px] uppercase tracking-wide">
                                PROBATION
                              </span>
                            )}
                            {standing === "INCOMPLETE" && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300 font-bold text-[9px] uppercase tracking-wide">
                                INCOMPLETE
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>

            {/* Sticky Floating Bottom Horizontal Scrollbar & Quick Actions */}
            <div className="sticky bottom-0 z-40 bg-slate-900/95 dark:bg-slate-950/95 text-slate-100 backdrop-blur-md border-t border-slate-700/70 shadow-[0_-6px_20px_rgba(0,0,0,0.25)] print:hidden flex flex-col">
              {/* Full-width Synchronized Scrollbar */}
              <div
                ref={bottomScrollRef}
                onScroll={handleBottomScroll}
                onWheel={handleWheelOnScrollbar}
                className="w-full overflow-x-auto py-1 px-1 bg-slate-800/90 border-b border-slate-700/60 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.85)_rgba(30,41,59,0.7)]"
                title="Bottom Horizontal Scrollbar: Drag to pan across broadsheet"
              >
                <div style={{ width: tableScrollWidth, height: 8 }} />
              </div>

              {/* Action and Navigation Toolbar */}
              <div className="px-3 py-2 flex flex-col md:flex-row items-center justify-between gap-2.5">
                {/* Left: Step navigation controls & Quick Pills */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-semibold"
                      onClick={() => scrollHorizontal("left", 320)}
                      title="Scroll Left (Shift + ←)"
                    >
                      <ChevronLeft className="h-4 w-4 mr-0.5" />
                      Left
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-semibold"
                      onClick={() => scrollHorizontal("right", 320)}
                      title="Scroll Right (Shift + →)"
                    >
                      Right
                      <ChevronRight className="h-4 w-4 ml-0.5" />
                    </Button>
                  </div>

                  <div className="h-4 w-px bg-slate-700 hidden sm:block" />

                  {/* Section quick pills */}
                  <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                    <button
                      type="button"
                      onClick={() => scrollToSection("start")}
                      className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 font-medium transition-colors cursor-pointer"
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection("current")}
                      className="px-2 py-0.5 rounded text-blue-300 hover:text-blue-100 hover:bg-slate-800 font-medium transition-colors cursor-pointer"
                    >
                      Current
                    </button>
                    {carryoverCourses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => scrollToSection("carryover")}
                        className="px-2 py-0.5 rounded text-rose-300 hover:text-rose-100 hover:bg-slate-800 font-medium transition-colors cursor-pointer"
                      >
                        Carryovers
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => scrollToSection("gpa")}
                      className="px-2 py-0.5 rounded text-emerald-300 hover:text-emerald-100 hover:bg-slate-800 font-medium transition-colors cursor-pointer"
                    >
                      Stats/GPA
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection("remarks")}
                      className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 font-medium transition-colors cursor-pointer"
                    >
                      Remarks
                    </button>
                  </div>
                </div>

                {/* Right: Student Row Selector & Status */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-300 text-[11px] font-mono hidden sm:inline">
                    Row {selectedRow + 1} / {displayedStudents.length}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
                      onClick={() => {
                        setSelectedRow((prev) => Math.max(0, prev - 1));
                      }}
                      title="Previous Student (↑)"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-800"
                      onClick={() => {
                        setSelectedRow((prev) => Math.min(displayedStudents.length - 1, prev + 1));
                      }}
                      title="Next Student (↓)"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
