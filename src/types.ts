export interface Context {
  id: number;
  name: string;
  timestamp: Date;
  fileCount: number;
  content: string;
  filters: string;
}

export interface ProcessedFile {
  name: string;
  path: string;
  content: string;
}

export interface FileProcessorOptions {
  isRecursive: boolean;
  filters: string;
} 