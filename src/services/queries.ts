'use client'

import { useQuery } from '@tanstack/react-query'
import { Announcements, ApiError, Kyc } from './api'

export const queryKeys = {
  kyc: (status: string) => ['kyc', status] as const,
  announcementList: ['announcements', 'list'] as const,
  announcementCount: ['announcements', 'count'] as const,
  kycPhotos: (id: string) => ['kyc', 'photos', id] as const,
}

export function useKycSubmissions(status: string) {
  return useQuery({
    queryKey: queryKeys.kyc(status),
    queryFn: async () => {
      const response = await Kyc.list(status)
      return Array.isArray(response.data) ? response.data : []
    },
  })
}

export function useAnnouncementHistory() {
  return useQuery({
    queryKey: queryKeys.announcementList,
    queryFn: async () => {
      const response = await Announcements.list()
      return Array.isArray(response.data) ? response.data.slice(0, 20) : []
    },
  })
}

export function useAnnouncementCount() {
  return useQuery({
    queryKey: queryKeys.announcementCount,
    queryFn: async () => {
      try {
        const response = await Announcements.list()
        return Array.isArray(response.data) ? response.data.length : 0
      } catch (error) {
        if (error instanceof ApiError && [404, 405].includes(error.status)) return null
        throw error
      }
    },
  })
}
