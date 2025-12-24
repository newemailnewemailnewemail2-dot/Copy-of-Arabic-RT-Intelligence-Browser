
export interface ArticleData {
  id: string;
  url: string;
  originalTitle?: string;
  rewrittenTitle: string;
  rewrittenContent: string;
  category: string;
  threatLevel: string;
  imageUrl: string;
  timestamp: number;
  status: 'monitoring' | 'scheduled' | 'published';
  scheduledTime?: string;
}

export interface NewsSource {
  id: string;
  url: string;
  name: string;
  isActive: boolean;
}

export interface PythonFile {
  name: string;
  description: string;
  content: string;
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  DISCOVERY = 'DISCOVERY',
  INTEL_FEED = 'INTEL_FEED',
  SOURCES = 'SOURCES',
  SCHEDULER = 'SCHEDULER',
  TELEGRAM = 'TELEGRAM',
  CODE = 'CODE'
}
