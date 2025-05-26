
'use client';

import * as React from 'react'; // Import React
import type {
  Task,
  Member,
  HolidayCalendar,
  PublicHoliday,
} from '@/types/sprint-data';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  ReferenceArea,
  Rectangle,
} from 'recharts';
import { ChartConfig, ChartContainer } from '@/components/ui/chart';
import {
  Tooltip as UITooltip,
  TooltipContent as UITooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  format,
  parseISO,
  differenceInDays,
  addDays,
  isWithinInterval,
  getDay,
  eachDayOfInterval,
  isValid,
  isSameDay,
  isBefore,
} from 'date-fns';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

const weekendColor = 'hsl(var(--weekend-color))'; // Use CSS variable for dynamic theme
const devTaskBarColor = 'hsl(var(--primary))';
const reviewTaskBarColor = 'hsl(var(--chart-5))'; // Pink/Rose for Review
const qaTaskBarColor = 'hsl(var(--chart-2))'; // Teal/Aqua for QA
const bufferTaskBarColor = 'hsl(var(--muted))'; // Muted grey for Buffer
const holidayColorBase = [
  'hsl(var(--holiday-1))',
  'hsl(var(--holiday-2))',
  'hsl(var(--holiday-3))',
];

// --- Helper Functions ---
const parseEstimatedTimeToDays = (
  timeString: string | undefined | null
): number | null => {
  if (!timeString) return null;
  timeString = timeString.trim().toLowerCase();
  let totalDays = 0;
  const parts = timeString.match(/(\d+w)?\s*(\d+d)?/);
  if (!parts || (parts[1] === undefined && parts[2] === undefined)) {
    const simpleDays = parseInt(timeString, 10);
    if (!isNaN(simpleDays) && simpleDays >= 0) return simpleDays;
    return null;
  }
  const weekPart = parts[1];
  const dayPart = parts[2];
  if (weekPart) {
    const weeks = parseInt(weekPart.replace('w', ''), 10);
    if (!isNaN(weeks)) totalDays += weeks * 5;
  }
  if (dayPart) {
    const days = parseInt(dayPart.replace('d', ''), 10);
    if (!isNaN(days)) totalDays += days;
  }
  if (totalDays === 0 && /^\d+$/.test(timeString)) {
    const simpleDays = parseInt(timeString, 10);
    if (!isNaN(simpleDays) && simpleDays >= 0) return simpleDays;
  }
  return totalDays >= 0
    ? totalDays
    : timeString === '0' || timeString === '0d'
      ? 0
      : null;
};

const isNonWorkingDay = (date: Date, memberHolidays: Set<string>): boolean => {
  const dayOfWeek = getDay(date);
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;
  if (!memberHolidays || memberHolidays.size === 0) return false;
  const dateString = format(date, 'yyyy-MM-dd');
  return memberHolidays.has(dateString);
};

const calculateEndDateSkippingNonWorkingDays = (
  startDate: Date,
  workingDays: number,
  memberHolidays: Set<string>
): Date => {
  let currentDate = new Date(startDate);
  let workingDaysCounted = 0;
  while (isNonWorkingDay(currentDate, memberHolidays)) {
    currentDate = addDays(currentDate, 1);
  }
  if (workingDays <= 0) return currentDate;
  while (workingDaysCounted < workingDays) {
    if (!isNonWorkingDay(currentDate, memberHolidays)) {
      workingDaysCounted++;
    }
    if (workingDaysCounted < workingDays) {
      currentDate = addDays(currentDate, 1);
      while (isNonWorkingDay(currentDate, memberHolidays)) {
        currentDate = addDays(currentDate, 1);
      }
    }
  }
  return currentDate;
};

const getNextWorkingDay = (date: Date, memberHolidays: Set<string>): Date => {
  let nextDay = addDays(date, 1);
  while (isNonWorkingDay(nextDay, memberHolidays)) {
    nextDay = addDays(nextDay, 1);
  }
  return nextDay;
};

// --- End Helper Functions ---

interface SprintTimelineChartProps {
  tasks: Task[];
  sprintStartDate: string | undefined;
  sprintEndDate: string | undefined;
  members: Member[];
  holidayCalendars: HolidayCalendar[];
  viewMode: 'task' | 'assignee';
}

interface ChartDataPoint {
  name: string;
  index: number;
  devRange?: [number, number];
  reviewRange?: [number, number]; // New field for Review
  qaRange?: [number, number];
  bufferRange?: [number, number];
  tooltip: string;
  assignee?: string;
  assigneeId?: string | null;
  originalTask?: Task;
}

interface AssigneeHolidayInfo {
  assigneeId: string | null;
  name: string;
  color: string;
  calendarName: string;
}

export default function SprintTimelineChart({
  tasks,
  sprintStartDate,
  sprintEndDate,
  members,
  holidayCalendars,
  viewMode,
}: SprintTimelineChartProps) {
  const [clientNow, setClientNow] = useState<Date | null>(null);

  const sprintStart = useMemo(
    () => (sprintStartDate ? parseISO(sprintStartDate) : null),
    [sprintStartDate]
  );
  const sprintEnd = useMemo(
    () => (sprintEndDate ? parseISO(sprintEndDate) : null),
    [sprintEndDate]
  );

  const getSprintDays = () => {
    if (
      !sprintStart ||
      !sprintEnd ||
      !isValid(sprintStart) ||
      !isValid(sprintEnd)
    )
      return 0;
    return differenceInDays(sprintEnd, sprintStart) + 1;
  };
  const sprintDays = useMemo(
    () => getSprintDays(),
    [sprintStart, sprintEnd]
  );

  useEffect(() => {
    setClientNow(new Date());
  }, []);

  const memberHolidayMap = useMemo(() => {
    const map = new Map<
      string,
      { holidays: Set<string>; calendarId: string | null }
    >();
    members.forEach((member) => {
      const calendarId = member.holidayCalendarId;
      const calendar = holidayCalendars.find((cal) => cal.id === calendarId);
      const holidays = new Set<string>();
      if (calendar) {
        calendar.holidays.forEach((holiday) => {
          if (holiday.date) {
            try {
              const parsedDate = parseISO(holiday.date + 'T00:00:00Z');
              if (isValid(parsedDate)) {
                holidays.add(format(parsedDate, 'yyyy-MM-dd'));
              }
            } catch (e) {
              console.error('Error parsing holiday date', e);
            }
          }
        });
      }
      map.set(member.id, { holidays, calendarId });
    });
    return map;
  }, [members, holidayCalendars]);

  const chartData = useMemo(() => {
    if (
      !tasks ||
      tasks.length === 0 ||
      !sprintStart ||
      !sprintEnd ||
      !isValid(sprintStart) ||
      !isValid(sprintEnd)
    ) {
      return [];
    }
    const sprintLengthDays = differenceInDays(sprintEnd, sprintStart) + 1;

    const processedTasks = tasks
      .map((task, index) => {
        const assigneeName = task.assignee;
        const assigneeMember = members.find((m) => m.name === assigneeName);
        const assigneeId = assigneeMember?.id ?? null;
        const memberHolidayData = assigneeId
          ? memberHolidayMap.get(assigneeId)
          : undefined;
        const memberHolidays = memberHolidayData?.holidays ?? new Set<string>();

        if (!task.startDate || !isValid(parseISO(task.startDate))) return null;
        let taskStartObj: Date;
        try {
          taskStartObj = parseISO(task.startDate!);
        } catch (e) {
          return null;
        }

        let currentPhaseStartDate = new Date(taskStartObj);
        while (isNonWorkingDay(currentPhaseStartDate, memberHolidays)) {
          currentPhaseStartDate = addDays(currentPhaseStartDate, 1);
        }

        // --- Dev Phase ---
        const devWorkingDays = parseEstimatedTimeToDays(task.devEstimatedTime);
        let devStartDateObj = new Date(currentPhaseStartDate);
        let devEndDateObj = devStartDateObj;
        let devStartDayIndex = -1,
          devEndDayIndex = -1,
          devPhaseValid = false;
        if (devWorkingDays !== null && devWorkingDays >= 0) {
          devEndDateObj = calculateEndDateSkippingNonWorkingDays(
            devStartDateObj,
            devWorkingDays,
            memberHolidays
          );
          devStartDayIndex = differenceInDays(devStartDateObj, sprintStart);
          devEndDayIndex = differenceInDays(devEndDateObj, sprintStart);
          if (devStartDayIndex < 0 && devEndDayIndex >= 0) devStartDayIndex = 0;
          devPhaseValid = devEndDayIndex >= 0;
          currentPhaseStartDate = getNextWorkingDay(
            devEndDateObj,
            memberHolidays
          );
        } else {
          currentPhaseStartDate = getNextWorkingDay(
            devStartDateObj,
            memberHolidays
          );
        }

        // --- Review Phase ---
        let reviewStartDateObj = new Date(currentPhaseStartDate);
        const reviewWorkingDays = parseEstimatedTimeToDays(
          task.reviewEstimatedTime
        );
        let reviewEndDateObj = reviewStartDateObj;
        let reviewStartDayIndex = -1,
          reviewEndDayIndex = -1,
          reviewPhaseValid = false;
        if (reviewWorkingDays !== null && reviewWorkingDays >= 0) {
          reviewEndDateObj = calculateEndDateSkippingNonWorkingDays(
            reviewStartDateObj,
            reviewWorkingDays,
            memberHolidays
          );
          reviewStartDayIndex = differenceInDays(
            reviewStartDateObj,
            sprintStart
          );
          reviewEndDayIndex = differenceInDays(reviewEndDateObj, sprintStart);
          if (reviewStartDayIndex < 0 && reviewEndDayIndex >= 0)
            reviewStartDayIndex = 0;
          reviewPhaseValid = reviewEndDayIndex >= 0;
          currentPhaseStartDate = getNextWorkingDay(
            reviewEndDateObj,
            memberHolidays
          );
        } else {
          currentPhaseStartDate = getNextWorkingDay(
            reviewStartDateObj,
            memberHolidays
          );
        }

        // --- QA Phase ---
        let qaStartDateObj = new Date(currentPhaseStartDate);
        const qaWorkingDays = parseEstimatedTimeToDays(task.qaEstimatedTime);
        let qaEndDateObj = qaStartDateObj;
        let qaStartDayIndex = -1,
          qaEndDayIndex = -1,
          qaPhaseValid = false;
        if (qaWorkingDays !== null && qaWorkingDays >= 0) {
          qaEndDateObj = calculateEndDateSkippingNonWorkingDays(
            qaStartDateObj,
            qaWorkingDays,
            memberHolidays
          );
          qaStartDayIndex = differenceInDays(qaStartDateObj, sprintStart);
          qaEndDayIndex = differenceInDays(qaEndDateObj, sprintStart);
          if (qaStartDayIndex < 0 && qaEndDayIndex >= 0) qaStartDayIndex = 0;
          qaPhaseValid = qaEndDayIndex >= 0;
          currentPhaseStartDate = getNextWorkingDay(
            qaEndDateObj,
            memberHolidays
          );
        } else {
          currentPhaseStartDate = getNextWorkingDay(
            qaStartDateObj,
            memberHolidays
          );
        }

        // --- Buffer Phase ---
        let bufferStartDateObj = new Date(currentPhaseStartDate);
        const bufferWorkingDays = parseEstimatedTimeToDays(task.bufferTime);
        let bufferEndDateObj = bufferStartDateObj;
        let bufferStartDayIndex = -1,
          bufferEndDayIndex = -1,
          bufferPhaseValid = false;
        if (bufferWorkingDays !== null && bufferWorkingDays >= 0) {
          bufferEndDateObj = calculateEndDateSkippingNonWorkingDays(
            bufferStartDateObj,
            bufferWorkingDays,
            memberHolidays
          );
          bufferStartDayIndex = differenceInDays(
            bufferStartDateObj,
            sprintStart
          );
          bufferEndDayIndex = differenceInDays(bufferEndDateObj, sprintStart);
          if (bufferStartDayIndex < 0 && bufferEndDayIndex >= 0)
            bufferStartDayIndex = 0;
          bufferPhaseValid = bufferEndDayIndex >= 0;
        }

        const clampIndex = (idx: number) =>
          Math.max(0, Math.min(sprintLengthDays - 1, idx));

        const clampedDevStart = clampIndex(devStartDayIndex);
        const clampedDevEnd = clampIndex(devEndDayIndex);
        const clampedReviewStart = clampIndex(reviewStartDayIndex);
        const clampedReviewEnd = clampIndex(reviewEndDayIndex);
        const clampedQaStart = clampIndex(qaStartDayIndex);
        const clampedQaEnd = clampIndex(qaEndDayIndex);
        const clampedBufferStart = clampIndex(bufferStartDayIndex);
        const clampedBufferEnd = clampIndex(bufferEndDayIndex);

        const tooltipContent = [
          `Ticket: ${task.ticketNumber || 'N/A'} (${task.status || 'N/A'})`,
          `Dev: ${task.devEstimatedTime || '0d'} [${devPhaseValid ? format(devStartDateObj, 'MM/dd') + '-' + format(devEndDateObj, 'MM/dd') : 'N/A'}]`,
          `Review: ${task.reviewEstimatedTime || '0d'} [${reviewPhaseValid ? format(reviewStartDateObj, 'MM/dd') + '-' + format(reviewEndDateObj, 'MM/dd') : 'N/A'}]`,
          `QA: ${task.qaEstimatedTime || '0d'} [${qaPhaseValid ? format(qaStartDateObj, 'MM/dd') + '-' + format(qaEndDateObj, 'MM/dd') : 'N/A'}]`,
          `Buffer: ${task.bufferTime || '0d'} [${bufferPhaseValid ? format(bufferStartDateObj, 'MM/dd') + '-' + format(bufferEndDateObj, 'MM/dd') : 'N/A'}]`,
          task.assignee ? `Assignee: ${task.assignee}` : '',
          task.reviewer ? `Reviewer: ${task.reviewer}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const result: ChartDataPoint = {
          name: task.ticketNumber || `Task ${task.id}`,
          index: index,
          devRange:
            devPhaseValid && clampedDevEnd >= clampedDevStart
              ? [clampedDevStart, clampedDevEnd + 1]
              : undefined,
          reviewRange:
            reviewPhaseValid && clampedReviewEnd >= clampedReviewStart
              ? [clampedReviewStart, clampedReviewEnd + 1]
              : undefined,
          qaRange:
            qaPhaseValid && clampedQaEnd >= clampedQaStart
              ? [clampedQaStart, clampedQaEnd + 1]
              : undefined,
          bufferRange:
            bufferPhaseValid && clampedBufferEnd >= clampedBufferStart
              ? [clampedBufferStart, clampedBufferEnd + 1]
              : undefined,
          tooltip: tooltipContent,
          assignee: task.assignee,
          assigneeId: assigneeId,
          originalTask: task,
        };
        return result.devRange ||
          result.reviewRange ||
          result.qaRange ||
          result.bufferRange
          ? result
          : null;
      })
      .filter((item) => item !== null) as ChartDataPoint[];

    if (viewMode === 'assignee') {
      const groupedByAssignee: { [key: string]: ChartDataPoint[] } = {};
      processedTasks.forEach((task) => {
        const assigneeKey = task.assignee || 'Unassigned';
        if (!groupedByAssignee[assigneeKey]) {
          groupedByAssignee[assigneeKey] = [];
        }
        groupedByAssignee[assigneeKey].push(task);
      });

      const assigneeChartData: ChartDataPoint[] = [];
      Object.keys(groupedByAssignee)
        .sort()
        .forEach((assigneeName, assigneeIndex) => {
          groupedByAssignee[assigneeName].forEach((task) => {
            if (task.devRange) {
              assigneeChartData.push({
                ...task,
                name: assigneeName,
                index: assigneeIndex,
                tooltip: `Assignee: ${assigneeName} | Ticket: ${task.originalTask?.ticketNumber || 'N/A'} | Dev: ${task.originalTask?.devEstimatedTime || '0d'}`,
                reviewRange: undefined, // Hide review in assignee view
                qaRange: undefined, // Hide QA in assignee view
                bufferRange: undefined, // Hide buffer in assignee view
              });
            }
          });
        });
      return assigneeChartData;
    } else {
      return processedTasks;
    }
  }, [
    tasks,
    sprintStart,
    sprintEnd,
    clientNow,
    memberHolidayMap,
    members,
    viewMode,
  ]);

  const weekendIndices = useMemo(() => {
    if (
      !sprintStart ||
      !sprintEnd ||
      !isValid(sprintStart) ||
      !isValid(sprintEnd)
    )
      return [];
    const indices: number[] = [];
    try {
      eachDayOfInterval({ start: sprintStart, end: sprintEnd }).forEach(
        (date) => {
          const dayOfWeek = getDay(date);
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            indices.push(differenceInDays(date, sprintStart));
          }
        }
      );
    } catch (e) {
      console.error('Error calculating weekend indices:', e);
      return [];
    }
    return indices;
  }, [sprintStart, sprintEnd]);

  const assignedHolidayMap = useMemo(() => {
    const map = new Map<number, Map<string | null, AssigneeHolidayInfo>>();
    const calendarColors = new Map<string, string>();
    let colorIndex = 0;
    if (
      !sprintStart ||
      !sprintEnd ||
      !isValid(sprintStart) ||
      !isValid(sprintEnd)
    )
      return map;
    try {
      const days = eachDayOfInterval({ start: sprintStart, end: sprintEnd });
      days.forEach((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayIndex = differenceInDays(date, sprintStart);
        chartData.forEach((dp) => {
          const assigneeId = dp.assigneeId;
          const memberHolidayData = assigneeId
            ? memberHolidayMap.get(assigneeId)
            : undefined;
          if (memberHolidayData?.holidays.has(dateStr)) {
            const calendarId = memberHolidayData.calendarId;
            if (calendarId) {
              const calendar = holidayCalendars.find(
                (cal) => cal.id === calendarId
              );
              if (calendar) {
                if (!calendarColors.has(calendarId)) {
                  calendarColors.set(
                    calendarId,
                    holidayColorBase[colorIndex % holidayColorBase.length]
                  );
                  colorIndex++;
                }
                const color = calendarColors.get(calendarId)!;
                const holiday = calendar.holidays.find(
                  (hol) => hol.date === dateStr
                );
                const holidayInfo: AssigneeHolidayInfo = {
                  assigneeId: assigneeId,
                  name: holiday?.name ?? 'Public Holiday',
                  color: color,
                  calendarName: calendar.name || 'Unknown Calendar',
                };
                if (!map.has(dayIndex)) map.set(dayIndex, new Map());
                map.get(dayIndex)!.set(assigneeId, holidayInfo);
              }
            }
          }
        });
      });
    } catch (e) {
      console.error('Error calculating assigned holiday map:', e);
      return new Map();
    }
    return map;
  }, [sprintStart, sprintEnd, memberHolidayMap, holidayCalendars, chartData]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      dev: { label: 'Development', color: devTaskBarColor },
      review: { label: 'Review', color: reviewTaskBarColor },
      qa: { label: 'QA', color: qaTaskBarColor },
      buffer: { label: 'Buffer', color: bufferTaskBarColor },
      weekend: { label: 'Weekend', color: weekendColor },
    };
    const usedCalendars = new Set<string>();
    assignedHolidayMap.forEach((dayMap) => {
      dayMap.forEach((holidayInfo) => {
        if (!usedCalendars.has(holidayInfo.calendarName)) {
          const legendKey = `holiday-${holidayInfo.calendarName.replace(/[^a-zA-Z0-9]/g, '-')}`;
          if (!config[legendKey]) {
            config[legendKey] = {
              label: holidayInfo.calendarName,
              color: holidayInfo.color,
            };
            usedCalendars.add(holidayInfo.calendarName);
          }
        }
      });
    });
    return config;
  }, [assignedHolidayMap]);

  const yAxisDataKey = 'index';
  const yAxisTickFormatter = (value: number, index: number): string => {
    if (viewMode === 'assignee') {
      const dataPoint = chartData.find((d) => d.index === value);
      return dataPoint?.name ?? `Assignee ${value + 1}`;
    } else {
      const dataPoint = chartData.find((d) => d.index === value);
      return dataPoint?.originalTask?.ticketNumber ?? `Task ${value + 1}`;
    }
  };

  const yDomainValues = useMemo(() => {
    if (viewMode === 'assignee') {
      return [...new Set(chartData.map((d) => d.name))];
    } else {
      return chartData.map(
        (d) => d.originalTask?.ticketNumber || `Task ${d.index + 1}`
      );
    }
  }, [chartData, viewMode]);

  const rowHeight = 30;
  const chartHeight = Math.max(250, yDomainValues.length * rowHeight + 100);

  if (!clientNow)
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading sprint details...
      </div>
    );
  if (chartData.length === 0)
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No tasks with valid start date and estimates to display.
      </div>
    );
  if (!sprintStart)
    return (
      <div className="flex h-full items-center justify-center text-destructive">
        Error: Invalid sprint start date.
      </div>
    );

  const sprintDayIndices = Array.from({ length: sprintDays }, (_, i) => i);
  const xTicks = sprintDayIndices.map((i) => {
    try {
      const date = addDays(sprintStart!, i);
      if (sprintDays <= 14 || i % 2 === 0 || i === 0 || i === sprintDays - 1) {
        return format(date, 'MM/dd');
      }
    } catch (e) {
      console.error('Error formatting X tick:', e);
    }
    return '';
  });

  const CustomLegend = () => {
    return (
      <div className="mt-4 flex flex-wrap items-center justify-center space-x-4 text-xs">
        {Object.entries(chartConfig).map(([key, value]) => {
          if (
            key.startsWith('holiday-') &&
            !Array.from(assignedHolidayMap.values()).some((map) =>
              Array.from(map.values()).some(
                (h) => h.calendarName === value.label
              )
            )
          )
            return null;
          if (
            viewMode === 'assignee' &&
            (key === 'review' || key === 'qa' || key === 'buffer')
          )
            return null;
          return (
            <div key={key} className="mb-1 flex items-center space-x-1">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: value.color }}
              ></span>
              <span>{value.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ChartContainer
      config={chartConfig}
      className="w-full"
      style={{ height: `${chartHeight}px` }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 20, left: 100, bottom: 20 }}
          barCategoryGap="30%"
          barGap={2}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            scale="linear"
            domain={[0, sprintDays]}
            ticks={sprintDayIndices}
            tickFormatter={(tick) => xTicks[tick] ?? ''}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={true}
            interval={0}
            allowDuplicatedCategory={true}
          />
          <YAxis
            dataKey={yAxisDataKey}
            type="number"
            domain={[-0.5, yDomainValues.length - 0.5]}
            ticks={yDomainValues.map((_, i) => i)}
            tickFormatter={yAxisTickFormatter}
            tick={{ fontSize: 10, width: 90, textAnchor: 'end' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            reversed={true}
            yAxisId={0}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
            content={({ payload }) => {
              if (payload && payload.length > 0 && payload[0].payload) {
                const data = payload[0].payload as ChartDataPoint;
                return (
                  <div className="max-w-md rounded border bg-background px-2 py-1 text-xs shadow-sm">
                    <p className="break-words font-semibold">{data.tooltip}</p>
                  </div>
                );
              }
              return null;
            }}
          />

          {/* Render Task Bars First */}
          <Bar
            dataKey="devRange"
            radius={2}
            barSize={10}
            fill={devTaskBarColor}
            name="Development"
            yAxisId={0}
            shape={<Rectangle radius={0} />}
          />
          {viewMode === 'task' && (
            <>
              <Bar
                dataKey="reviewRange"
                radius={2}
                barSize={10}
                fill={reviewTaskBarColor}
                name="Review"
                yAxisId={0}
                shape={<Rectangle radius={0} />}
              />
              <Bar
                dataKey="qaRange"
                radius={2}
                barSize={10}
                fill={qaTaskBarColor}
                name="QA"
                yAxisId={0}
                shape={<Rectangle radius={0} />}
              />
              <Bar
                dataKey="bufferRange"
                radius={2}
                barSize={10}
                fill={bufferTaskBarColor}
                name="Buffer"
                yAxisId={0}
                shape={<Rectangle radius={0} />}
              />
            </>
          )}

          {/* Render Weekend and Holiday Areas on Top */}
          {sprintDayIndices
            .map((index) => {
              const isWeekend = weekendIndices.includes(index);
              const holidayDayMap = assignedHolidayMap.get(index);
              const areas = [];

              if (isWeekend) {
                areas.push(
                  <ReferenceArea
                    key={`weekend-area-${index}`}
                    x1={index}
                    x2={index + 1}
                    y1={-0.5}
                    y2={yDomainValues.length - 0.5}
                    ifOverflow="visible"
                    fill={weekendColor}
                    fillOpacity={1}
                    yAxisId={0}
                    strokeWidth={0}
                    shape={<Rectangle radius={0} />}
                  />
                );
              }

              if (holidayDayMap) {
                holidayDayMap.forEach((holidayInfo, assigneeId) => {
                  let y1 = -0.5;
                  let y2 = yDomainValues.length - 0.5;
                  let yIndex = -1;

                  const dataPointForHoliday = chartData.find(
                    (dp) =>
                      dp.assigneeId === assigneeId &&
                      index >= (dp.devRange?.[0] ?? Infinity) && // Check if holiday falls within any phase of the task for this assignee
                      index <
                        (dp.bufferRange?.[1] ??
                          dp.qaRange?.[1] ??
                          dp.reviewRange?.[1] ??
                          dp.devRange?.[1] ??
                          -Infinity)
                  );

                  if (dataPointForHoliday) {
                    yIndex = dataPointForHoliday.index;
                    y1 = yIndex - 0.5;
                    y2 = yIndex + 0.5;

                    areas.push(
                      <ReferenceArea
                        key={`holiday-area-${index}-${assigneeId}-${yIndex}`}
                        x1={index}
                        x2={index + 1}
                        y1={y1}
                        y2={y2}
                        ifOverflow="visible"
                        fill={holidayInfo.color}
                        fillOpacity={1}
                        yAxisId={0}
                        strokeWidth={0}
                        shape={<Rectangle radius={0} />}
                      />
                    );
                  }
                });
              }
              return areas;
            })
            .flat()
            .filter(Boolean)}
          <Legend
            content={<CustomLegend />}
            verticalAlign="bottom"
            wrapperStyle={{ bottom: 0 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
