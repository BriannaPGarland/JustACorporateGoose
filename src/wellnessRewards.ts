export type MeetingMovementMode = 'none' | 'walk' | 'stand'

export function movementMeetingPoints(movementMode: MeetingMovementMode) {
  if (movementMode === 'walk') {
    return 200
  }
  if (movementMode === 'stand') {
    return 100
  }
  return 0
}
