import { useState, useRef, useCallback } from 'react';
import type { FC, MouseEvent, DragEvent, ChangeEvent } from 'react';
import {
  Upload,
  Copy,
  Check,
  Filter,
  FolderOpen,
  Settings,
  Plus,
  MessageSquare,
  Trash2,
  Menu,
  X,
  Loader2,
} from 'lucide-react';
import type { Context, ProcessedFile } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// --- Type Definitions for File System Access API ---
interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  createReader(): FileSystemDirectoryReader;
  file(callback: (file: File) => void, errorCallback?: (error: Error) => void): void;
}
interface FileSystemDirectoryReader {
  readEntries(callback: (entries: FileSystemEntry[]) => void, errorCallback?: (error: Error) => void): void;
}



// --- Helper Functions for File Processing ---

const textExtensions = new Set([
    'txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'h', 'hpp',
    'html', 'css', 'scss', 'json', 'xml', 'yml', 'yaml', 'sql', 'sh', 'bat',
    'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'pl', 'vue',
    'svelte', 'dart', 'elm', 'clj', 'hs', 'lua', 'nim', 'zig', 'toml', 'ini', 'env'
]);

const isTextFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? textExtensions.has(ext) : false;
};

const matchesFilter = (filename: string, filterString: string): boolean => {
    const cleanedFilter = filterString.trim().toLowerCase();
    if (!cleanedFilter) return true;

    const filterExts = cleanedFilter.split(/[\s,-]+/).filter(Boolean);
    if (filterExts.length === 0) return true;
    
    const fileExt = filename.split('.').pop()?.toLowerCase();
    return fileExt ? filterExts.includes(fileExt) : false;
};

const cleanContent = (content: string): string => {
    return content
      .split('\n')
      .map(line => line.trimEnd())
      .filter(line => line.trim() !== '')
      .join('\n')
      .replace(/\n{2,}/g, '\n\n')
      .trim();
};


// --- Child Components ---

// UPDATED: Reverted Sidebar to a simple component that renders a div.
// It is no longer concerned with its container type (<aside>) or layout classes.
interface SidebarProps {
    contexts: Context[];
    activeContext: Context | null;
    onSelectContext: (context: Context) => void;
    onNewContext: () => void;
    onDeleteContext: (contextId: number, e: MouseEvent<HTMLButtonElement>) => void;
    onClose?: () => void;
}

const Sidebar: FC<SidebarProps> = ({ contexts, activeContext, onSelectContext, onNewContext, onDeleteContext, onClose }) => (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col border-r border-border">
        <div className="flex items-center justify-between p-4">
            <Button variant="outline" className="w-full justify-start bg-transparent text-sidebar-foreground hover:bg-sidebar-accent" onClick={onNewContext}>
                <Plus /> New Context
            </Button>
            {onClose && (
                <Button variant="ghost" size="icon" onClick={onClose} className="ml-2 lg:hidden">
                    <X />
                </Button>
            )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
            <h3 className="px-2 text-sm font-medium text-muted-foreground mb-2">Past Contexts</h3>
            <nav className="flex flex-col gap-1">
                {contexts.map(context => (
                    <div
                        key={context.id}
                        onClick={() => onSelectContext(context)}
                        className={cn(
                            "group flex items-center justify-between rounded-lg p-3 text-sm cursor-pointer transition-colors",
                            activeContext?.id === context.id
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                : 'hover:bg-sidebar-accent'
                        )}
                    >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <MessageSquare className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 truncate">
                                <div className="font-medium truncate">{context.name}</div>
                                <div className="text-xs text-muted-foreground">
                                    {context.fileCount} files
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => onDeleteContext(context.id, e)}
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </nav>
        </div>
    </div>
);


interface WelcomeScreenProps {
    onDrop: (e: DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: DragEvent<HTMLDivElement>) => void;
    onFileInputClick: () => void;
    isRecursive: boolean;
    onRecursiveChange: (checked: boolean) => void;
    filters: string;
    onFiltersChange: (value: string) => void;
    isProcessing: boolean;
}

const WelcomeScreen: FC<WelcomeScreenProps> = ({ onDrop, onDragOver, onFileInputClick, isRecursive, onRecursiveChange, filters, onFiltersChange, isProcessing }) => (
    <div className="mx-auto max-w-4xl">
        <div className="text-center">
            <FolderOpen size={48} className="mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">Process Your Project Files</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
                Drop a folder to recursively scan, clean, and combine text/code files into a single, optimized block for AI prompts.
            </p>
        </div>

        <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={onFileInputClick}
            className="mt-8 border-2 border-dashed border-border hover:border-primary rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-colors bg-card"
        >
            <Upload size={40} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Drop a folder here or click to upload</h3>
            <p className="text-muted-foreground text-sm">Recursive scanning is on by default. Your files are processed in-browser.</p>
        </div>

        <div className="mt-8 bg-card rounded-lg border p-6">
            <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                <Settings size={20} /> Processing Options
            </h3>
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="recursive"
                        checked={isRecursive}
                        onChange={(e) => onRecursiveChange(e.target.checked)}
                        className="h-4 w-4 accent-primary rounded border-gray-300"
                        disabled={isProcessing}
                    />
                    <label htmlFor="recursive" className="text-sm font-medium text-foreground">Enable recursive folder scanning</label>
                </div>
                <div>
                    <label htmlFor="filters" className="block text-sm font-medium text-foreground mb-2">File Extension Filters (optional)</label>
                    <div className="relative">
                        <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="filters"
                            type="text"
                            value={filters}
                            onChange={(e) => onFiltersChange(e.target.value)}
                            placeholder="js-ts-md or leave empty"
                            className="pl-9"
                            disabled={isProcessing}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Separate extensions with a dash, comma, or space.</p>
                </div>
            </div>
        </div>
    </div>
);

interface ResultsViewProps {
    content: string;
    onCopyToClipboard: () => void;
    copied: boolean;
    onStartOver: () => void;
}

const ResultsView: FC<ResultsViewProps> = ({ content, onCopyToClipboard, copied, onStartOver }) => (
    <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-medium text-foreground">Processed Content</h3>
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={onStartOver}>
                    <Upload /> Process Another
                </Button>
                <Button onClick={onCopyToClipboard}>
                    {copied ? <Check /> : <Copy />}
                    {copied ? 'Copied!' : 'Copy'}
                </Button>
            </div>
        </div>
        <div className="flex-grow rounded-lg border bg-card p-1 min-h-0">
             <pre className="h-full overflow-auto p-3 text-sm text-foreground whitespace-pre-wrap font-mono break-words">
                {content || 'No content processed yet.'}
            </pre>
        </div>
    </div>
);


// --- Main Application Component ---

const FolderProcessorApp: FC = () => {
    const [contexts, setContexts] = useState<Context[]>([]);
    const [activeContext, setActiveContext] = useState<Context | null>(null);
    const [filters, setFilters] = useState<string>('');
    const [isRecursive, setIsRecursive] = useState<boolean>(true);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);
    const [processedContent, setProcessedContent] = useState<string>('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getFilesInDirectory = async (entry: FileSystemEntry): Promise<File[]> => {
        const files: File[] = [];
        if (entry.isFile) {
            return new Promise((resolve, reject) => {
                entry.file(file => {
                    Object.defineProperty(file, 'webkitRelativePath', {
                        value: entry.fullPath.substring(1),
                        writable: true,
                    });
                    resolve([file]);
                }, reject);
            });
        }
        if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const readEntries = () => new Promise<FileSystemEntry[]>((resolve) => dirReader.readEntries(resolve));
            let entries = await readEntries();
            while (entries.length > 0) {
                if (isRecursive) {
                    const filePromises = entries.map(getFilesInDirectory);
                    const nestedFiles = await Promise.all(filePromises);
                    files.push(...nestedFiles.flat());
                } else {
                    const filePromises = entries.filter(e => e.isFile).map(getFilesInDirectory);
                    const nestedFiles = await Promise.all(filePromises);
                    files.push(...nestedFiles.flat());
                }
                if (!isRecursive) break;
                entries = await readEntries();
            }
        }
        return files;
    };
    
    const processDroppedItems = async (items: DataTransferItemList): Promise<File[]> => {
        const entries = Array.from(items).map(item => item.webkitGetAsEntry()).filter(Boolean) as unknown as FileSystemEntry[];
        const filePromises = entries.map(getFilesInDirectory);
        const nestedFiles = await Promise.all(filePromises);
        return nestedFiles.flat();
    };

    const processAndSetFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) return;
        setIsProcessing(true);
        setProcessedContent('Processing...');
        try {
            const processedFiles: ProcessedFile[] = [];
            for (const file of files) {
                if (!isTextFile(file.name) || !matchesFilter(file.name, filters)) {
                    continue;
                }
                const content = await file.text();
                const cleanedContent = cleanContent(content);
                if (cleanedContent) {
                    processedFiles.push({
                        name: file.name,
                        path: (file as any).webkitRelativePath || file.name,
                        content: cleanedContent,
                    });
                }
            }
            const output = processedFiles
                .sort((a, b) => a.path.localeCompare(b.path))
                .map(file => `// File: ${file.path}\n\n${file.content}`)
                .join('\n\n---\n\n');
            setProcessedContent(output);
            await navigator.clipboard.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            const folderName = (files[0] as any).webkitRelativePath?.split('/')[0] || `Context ${contexts.length + 1}`;
            const newContext: Context = {
                id: Date.now(),
                name: folderName,
                timestamp: new Date(),
                fileCount: processedFiles.length,
                content: output,
                filters: filters,
            };
            setContexts(prev => [newContext, ...prev]);
            setActiveContext(newContext);
        } catch (error) {
            console.error('Error processing files:', error);
            setProcessedContent(`Error: Could not process files. ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    }, [filters, isRecursive, contexts.length]);

    const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const items = e.dataTransfer.items;
        const files = await processDroppedItems(items);
        await processAndSetFiles(files);
    }, [processAndSetFiles]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            processAndSetFiles(files);
        }
        if (e.target) e.target.value = '';
    };
    
    const handleCopyToClipboard = async () => {
        if (!processedContent || isProcessing) return;
        await navigator.clipboard.writeText(processedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const handleNewContext = () => {
        setActiveContext(null);
        setProcessedContent('');
        setFilters('');
        setIsSidebarOpen(false);
    };

    const handleSelectContext = (context: Context) => {
        setActiveContext(context);
        setProcessedContent(context.content);
        setFilters(context.filters);
        setIsSidebarOpen(false);
    };

    const handleDeleteContext = (contextId: number, e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setContexts(prev => prev.filter(ctx => ctx.id !== contextId));
        if (activeContext?.id === contextId) {
            handleNewContext();
        }
    };

    const sidebarProps = { contexts, activeContext, onSelectContext: handleSelectContext, onNewContext: handleNewContext, onDeleteContext: handleDeleteContext };

    return (
        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
            {/* Mobile Sidebar Modal */}
            {isSidebarOpen && (
                 <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
                    <div className="fixed inset-0 bg-black/60" aria-hidden="true" onClick={() => setIsSidebarOpen(false)}></div>
                    <div className="fixed inset-y-0 left-0 h-full w-full max-w-xs">
                        <Sidebar {...sidebarProps} onClose={() => setIsSidebarOpen(false)} />
                    </div>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden w-72 flex-shrink-0 lg:flex">
                <Sidebar {...sidebarProps} />
            </aside>
            
            <main className="flex flex-1 flex-col overflow-hidden">
                {/* Non-scrolling top bar for mobile menu and loader */}
                    <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
                        <Menu />
                    </Button>
                    {isProcessing && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Processing...</span>
                        </div>
                    )}
               
                {/* Main scrollable content area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {!activeContext ? (
                        <WelcomeScreen
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onFileInputClick={() => fileInputRef.current?.click()}
                            isRecursive={isRecursive}
                            onRecursiveChange={setIsRecursive}
                            filters={filters}
                            onFiltersChange={setFilters}
                            isProcessing={isProcessing}
                        />
                    ) : (
                        <ResultsView
                            content={processedContent}
                            onCopyToClipboard={handleCopyToClipboard}
                            copied={copied}
                            onStartOver={handleNewContext}
                        />
                    )}
                </div>
            </main>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                webkitdirectory="true"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
};

export default FolderProcessorApp;