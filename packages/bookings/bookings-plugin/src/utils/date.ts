export function getDayRange(datetimeInput: Date) {
  // Ensure datetimeInput is a Date object
  const inputDate = new Date(datetimeInput)

  // Set the time to the beginning of the day (00:00:00)
  const startOfDay = new Date(inputDate)
  startOfDay.setHours(0, 0, 0, 0)

  // Set the time to the end of the day (23:59:59.999)
  const endOfDay = new Date(inputDate)
  endOfDay.setHours(23, 59, 59, 999)

  return { startOfDay, endOfDay }
}
