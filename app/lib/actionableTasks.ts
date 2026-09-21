/** Hide expired reminders without changing bookings, disputes or payments. */
export function actionableTasks<T extends { deadline: string | null }>(tasks: T[], now: number): T[] {
  return tasks.filter(task => task.deadline === null || new Date(task.deadline).getTime() > now);
}
