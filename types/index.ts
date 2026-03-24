/**
 * Core type definitions for the Executive Assistant application
 */

export interface User {
  id: string
  email: string
  name: string
  brokerage: string
  city: string
  isPremium: boolean
  createdAt: string
}

export interface EmailAccount {
  id: string
  userId: string
  email: string
  label: string
  contextNote: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: string
}

export interface EmailMessage {
  id: string
  accountId: string
  gmailId: string
  from: string
  to: string
  subject: string
  snippet: string
  body: string
  date: string
  isRead: boolean
  threadId: string
}

export interface TriagedEmail extends EmailMessage {
  category: 'urgent' | 'new_lead' | 'transaction_update' | 'follow_up' | 'low_priority'
  summary: string
  suggestedAction: string
  confidence: number
}

export interface Lead {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  leadType: 'buyer' | 'seller'
  stage: 'new' | 'contacted' | 'active' | 'under_contract' | 'closed' | 'dead'
  notes: string
  lastContactDate: string | null
  followUpDate: string | null
  sourceEmailId: string | null
  createdAt: string
}

export interface Transaction {
  id: string
  userId: string
  leadId: string
  propertyAddress: string
  clientName: string
  contractDate: string
  optionPeriodEnd: string
  closingDate: string
  lenderContact: string
  titleCompanyContact: string
  status: 'pending' | 'option_period' | 'pending_financing' | 'clear_to_close' | 'closed'
  createdAt: string
}

export interface ContentItem {
  id: string
  title: string
  category: string
  tags: string[]
  body: string
  createdAt: string
  isNew: boolean
}

export interface FollowUpReminder {
  id: string
  userId: string
  leadId: string
  emailId: string
  scheduledDate: string
  draftBody: string
  status: 'pending' | 'sent' | 'dismissed'
  createdAt: string
}

export interface DailyBriefing {
  summary: string
  urgentEmails: TriagedEmail[]
  todayEvents: Array<{
    title: string
    time: string
    duration: number
  }>
  staleLeads: Lead[]
  upcomingDeadlines: Transaction[]
}

export interface HealthStatus {
  gmail: boolean
  calendar: boolean
  supabase: boolean
  lastChecked: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  status: number
}
