import React, { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

export default function CTPlannerCalendar({ schedule = [], viewDate = new Date(), onDateClick, onEventClick, onEventDrop }) {
  const events = useMemo(() => {
    return (schedule || []).filter(s => s.eventType === 'CT' || s.eventType === 'Quiz').map(s => {
      const start = s.date + (s.startTime ? 'T' + s.startTime : 'T00:00:00');
      return {
        id: s.id,
        title: s.title || `${s.eventType} ${s.courseId || ''}`,
        start: start,
        allDay: !s.startTime,
        extendedProps: { raw: s }
      };
    });
  }, [schedule]);

  return (
    <FullCalendar
      plugins={[ dayGridPlugin, timeGridPlugin, interactionPlugin ]}
      initialView="dayGridMonth"
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
      events={events}
      dateClick={(info) => onDateClick && onDateClick(info.dateStr)}
      eventClick={(info) => onEventClick && onEventClick(info.event.extendedProps.raw)}
      editable={true}
      eventDrop={(info) => {
        const id = info.event.id;
        const newDate = info.event.start;
        if (onEventDrop) onEventDrop(id, newDate.toISOString().slice(0,10));
      }}
      height="auto"
    />
  );
}
