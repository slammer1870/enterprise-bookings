import React from 'react'

type TimeSlot = {
  time: string
  monday: string
  tuesday: string
  wednesday: string
  thursday: string
  friday: string
  saturday: string
  sunday: string
}

type TimetableProps = {
  title: string
  description: string
  timeSlots: TimeSlot[]
  legend: string
}

export const TimetableBlock: React.FC<TimetableProps> = ({
  title = 'Timetable',
  description = 'Check out our class times.',
  timeSlots = [],
  legend = '<strong>SGPT:</strong> Small Group Personal Training',
}) => {
  return (
    <section>
      <div className="container mx-auto px-5 py-12 text-foreground">
        <div className="mb-4 flex w-full flex-col">
          <h5 className="mb-4 text-3xl font-medium">{title}</h5>
          <p className="text-base leading-relaxed">{description}</p>
        </div>
        <div className="mx-auto w-full overflow-auto">
          <table className="whitespace-no-wrap w-full table-auto text-left">
            <thead>
              <tr>
                <th className="title-font bg-muted px-4 py-3 text-sm font-medium tracking-wider text-muted-foreground">
                  Time
                </th>
                <th className="title-font bg-muted px-4 py-3 text-sm font-medium tracking-wider text-muted-foreground">
                  Monday
                </th>
                <th className="title-font bg-muted px-4 py-3 text-sm font-medium tracking-wider text-muted-foreground">
                  Tuesday
                </th>
                <th className="title-font bg-muted px-4 py-3 text-sm font-medium tracking-wider text-muted-foreground">
                  Wednesday
                </th>
                <th className="title-font bg-muted px-4 py-3 text-sm font-medium tracking-wider text-muted-foreground">
                  Thursday
                </th>
                <th className="title-font bg-muted px-4 py-3 text-sm font-medium tracking-wider text-muted-foreground">
                  Friday
                </th>
                <th className="title-font bg-muted px-4 py-3 text-sm font-medium tracking-wider text-muted-foreground">
                  Saturday
                </th>
                <th className="title-font bg-muted px-4 py-3 text-sm font-medium tracking-wider text-muted-foreground">
                  Sunday
                </th>
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, index) => (
                <tr key={index} className={index > 0 ? 'border-t-2 border-border' : ''}>
                  <td className="px-4 py-3">{slot.time}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-500">{slot.monday}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-500">{slot.tuesday}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-500">{slot.wednesday}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-500">{slot.thursday}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-500">{slot.friday}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-500">{slot.saturday}</td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-500">{slot.sunday}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="py-4 text-sm font-medium">{legend}</p>
        </div>
      </div>
    </section>
  )
}
