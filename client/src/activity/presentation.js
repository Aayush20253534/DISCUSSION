export function streakMessage(streaks) {
  if (streaks.todayCompletedCount) return 'You showed up today. Let that be enough.'
  if (streaks.currentStreak) return 'One completed quest today keeps your story going.'
  if (streaks.totalActiveDays) return 'A fresh start is still a step forward.'
  return 'Your first completed quest starts your streak.'
}
