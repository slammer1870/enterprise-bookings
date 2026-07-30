export type EmergencyContactPersonType = 'self' | 'child' | 'other'

export type EmergencyContactEntry = {
  name: string
  phone: string
  relationship: string
  id?: string | null
}

export type EmergencyContactPerson = {
  fullName: string
  personType: EmergencyContactPersonType
  contacts: EmergencyContactEntry[]
  medicalNotes?: string | null
  id?: string | null
}

export type EmergencyContactRecordSummary = {
  id: number
  userId: number
  status: 'incomplete' | 'complete'
  people: EmergencyContactPerson[]
  completedAt?: string | null
}

export type RosterBookerGroup = {
  userId: number
  bookerName: string
  bookerEmail: string
  seatCount: number
  bookingIds: number[]
  emergencyContact: EmergencyContactRecordSummary | null
}
