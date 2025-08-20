export function getDayRange(datetimeInput: Date) {
  // Ensure datetimeInput is a Date object
  const inputDate = new Date(datetimeInput);

  // Set the time to the beginning of the day (00:00:00)
  const startOfDay = new Date(inputDate);
  startOfDay.setHours(0, 0, 0, 0);

  // Set the time to the end of the day (23:59:59.999)
  const endOfDay = new Date(inputDate);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
}
function getFirstHourOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(1, 0, 0, 0);
  return result;
}

function getLastHourOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function getFirstDayOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const daysToSubtract = day === 0 ? 6 : day - 1;

  result.setDate(result.getDate() - daysToSubtract);
  result.setHours(1, 0, 0, 0); // Changed from 0 to 1 for 1:00 AM

  return result;
}

function getLastDayOfWeek(date: Date): Date {
  const result = getFirstDayOfWeek(date);
  result.setDate(result.getDate() + 6); // Add 6 days to get to Sunday
  result.setHours(23, 59, 59, 999);
  return result;
}

function getFirstDayOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(1, 0, 0, 0);
  return result;
}

function getLastDayOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0); // Setting day to 0 of next month gives us last day of current month
  result.setHours(23, 59, 59, 999);
  return result;
}

function getFirstDayOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(0, 1);
  result.setHours(1, 0, 0, 0);
  return result;
}

function getLastDayOfYear(date: Date): Date {
  const result = new Date(date);
  result.setMonth(11, 31); // December 31st
  result.setHours(23, 59, 59, 999);
  return result;
}

export const getIntervalStartAndEndDate = (
  intervalType: "day" | "week" | "month" | "quarter" | "year",
  intervalCount: number,
  lessonDate: Date
): { startDate: Date; endDate: Date } => {
  const currentDate = new Date(lessonDate);
  let startDate: Date;
  let endDate: Date;

  switch (intervalType) {
    case "day":
      endDate = getLastHourOfDay(currentDate);
      startDate = getFirstHourOfDay(new Date(currentDate));
      startDate.setDate(startDate.getDate() - (intervalCount - 1));
      break;
    case "week":
      endDate = getLastDayOfWeek(currentDate);
      startDate = getFirstDayOfWeek(new Date(currentDate));
      startDate.setDate(startDate.getDate() - 7 * (intervalCount - 1));
      break;
    case "month":
      endDate = getLastDayOfMonth(currentDate);
      startDate = getFirstDayOfMonth(new Date(currentDate));
      startDate.setMonth(startDate.getMonth() - (intervalCount - 1));
      break;
    case "quarter":
      endDate = getLastDayOfMonth(currentDate);
      startDate = getFirstDayOfMonth(new Date(currentDate));
      startDate.setMonth(startDate.getMonth() - 3 * (intervalCount - 1));
      break;
    case "year":
      endDate = getLastDayOfYear(currentDate);
      startDate = getFirstDayOfYear(new Date(currentDate));
      startDate.setFullYear(startDate.getFullYear() - (intervalCount - 1));
      break;
  }

  return { startDate, endDate };
};
