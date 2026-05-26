import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Folder,
    File,
    ChevronRight,
    ChevronDown,
    FolderOpen,
    Search,
    Download,
    CalendarDays,
    HardDrive,
    Loader2,
    RefreshCw,
    Eye
} from "lucide-react";
import { storageApi, S3Node } from "@/services/storageService";
import api from "@/services/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format as formatDate } from "date-fns";
import { PageHeader } from "@/components/PageHeader";

const formatSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const FileIcon = ({ name }: { name: string }) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <File className="w-4 h-4 text-rose-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <File className="w-4 h-4 text-blue-500" />;
    if (['xls', 'xlsx'].includes(ext || '')) return <File className="w-4 h-4 text-emerald-500" />;
    if (['jpg', 'jpeg', 'png', 'svg'].includes(ext || '')) return <File className="w-4 h-4 text-purple-500" />;
    return <File className="w-4 h-4 text-slate-400" />;
};

const UploadedDate: React.FC<{ value?: string }> = ({ value }) => {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    return (
        <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                {formatDate(parsed, "MMM d, yyyy, h:mm a")}
            </span>
        </div>
    );
};

const TreeNode: React.FC<{ node: S3Node; level: number; searchTerm: string }> = ({ node, level, searchTerm }) => {
    const [isOpen, setIsOpen] = React.useState(!!searchTerm);

    // Automatically open if children match search term
    React.useEffect(() => {
        if (searchTerm) setIsOpen(true);
    }, [searchTerm]);

    const hasChildren = node.children && node.children.length > 0;
    const isDirectory = node.type === 'directory';

    // Simple filtering logic
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase());
    const hasMatchingChild = node.children?.some(child =>
        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (child.children && child.children.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    if (searchTerm && !matchesSearch && !hasMatchingChild) return null;

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center gap-2 py-1.5 px-3 rounded-md hover:bg-slate-100 cursor-pointer transition-colors group",
                    isDirectory ? "text-slate-700 font-medium" : "text-slate-600"
                )}
                onClick={() => isDirectory && setIsOpen(!isOpen)}
            >
                {isDirectory ? (
                    <>
                        <div className="w-4 h-4 flex items-center justify-center">
                            {hasChildren ? (
                                isOpen ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />
                            ) : null}
                        </div>
                        {isOpen ? <FolderOpen className="w-4 h-4 text-amber-500 fill-amber-500/20" /> : <Folder className="w-4 h-4 text-amber-500 fill-amber-500/10" />}
                    </>
                ) : (
                    <>
                        <div className="w-4 h-4" />
                        <FileIcon name={node.name} />
                    </>
                )}

                <div className="flex min-w-0 items-center justify-between flex-1 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="min-w-0 truncate text-sm">{node.name.replace(/_/g, " ")}</span>

                        {!isDirectory && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (node.url) {
                                            try {
                                                const response = await api.get(node.url, { responseType: 'blob' });
                                                const contentType = (response.headers as any)['content-type'] || 'application/pdf';
                                                const blob = new Blob([response.data as BlobPart], { type: contentType });
                                                const blobUrl = window.URL.createObjectURL(blob);
                                                window.open(blobUrl, '_blank');
                                            } catch (err) {
                                                toast.error("Failed to preview document");
                                            }
                                        }
                                    }}
                                    title="Preview File"
                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-primary transition-colors"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (node.url) {
                                            try {
                                                const response = await api.get(node.url, { responseType: 'blob' });
                                                const contentType = (response.headers as any)['content-type'] || 'application/octet-stream';
                                                const blob = new Blob([response.data as BlobPart], { type: contentType });
                                                const blobUrl = window.URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = blobUrl;
                                                link.download = node.name;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                window.URL.revokeObjectURL(blobUrl);
                                            } catch (err) {
                                                toast.error("Failed to download document");
                                            }
                                        }
                                    }}
                                    title="Download File"
                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-primary transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {!isDirectory && <UploadedDate value={node.last_modified} />}
                </div>
            </div>

            {isDirectory && isOpen && node.children && (
                <div className="mt-1 ml-[0.85rem] pl-4 border-l border-slate-200/60 space-y-0.5">
                    {node.children
                        .sort((a, b) => {
                            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                            return a.name.localeCompare(b.name);
                        })
                        .map(child => (
                            <TreeNode key={child.id} node={child} level={level + 1} searchTerm={searchTerm} />
                        ))
                    }
                </div>
            )}
        </div>
    );
};

const DocumentsRepositoryPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = React.useState("");

    const { data, isLoading, isError, refetch, isFetching } = useQuery<{ data: S3Node[]; total_files: number }>({
        queryKey: ["s3-explorer"],
        queryFn: async () => {
            const response = await storageApi.getS3Explorer();
            return response.data as { data: S3Node[]; total_files: number };
        }
    });

    const treeData = React.useMemo(
        () => data?.data || [],
        [data]
    );
    const totalFiles = data?.total_files || 0;

    return (
        <div className="p-4 md:p-6 space-y-6 bg-background min-h-screen w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <PageHeader 
                    title="Documents Repository" 
                    subtitle="Browse all S3 storage documents." 
                    icon={HardDrive} 
                    iconColor="text-blue-500"
                />
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                        <File className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-bold text-blue-700">{totalFiles} Total Files</span>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="h-9 transition-all"
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card className="p-4 shadow-sm border-slate-200">
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search files and folders..."
                            className="pl-10 h-10 border-slate-200 focus:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="min-h-[500px] max-h-[75vh] overflow-y-auto custom-scrollbar pr-2">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                                <p className="animate-pulse font-medium">Scanning storage buckets...</p>
                            </div>
                        ) : isError ? (
                            <div className="flex flex-col items-center justify-center h-[400px] text-rose-500">
                                <p className="font-bold">Failed to load storage repository</p>
                                <Button variant="link" onClick={() => refetch()} className="text-rose-600 font-semibold">Try again</Button>
                            </div>
                        ) : treeData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                                <Folder className="w-12 h-12 mb-4 opacity-20" />
                                <p className="font-medium italic">No documents found in storage</p>
                            </div>
                        ) : (
                            <div className="space-y-1 py-2">
                                {treeData
                                    .sort((a: S3Node, b: S3Node) => {
                                        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                                        return a.name.localeCompare(b.name);
                                    })
                                    .map((rootNode: S3Node) => (
                                        <TreeNode
                                            key={rootNode.id}
                                            node={rootNode}
                                            level={0}
                                            searchTerm={searchTerm}
                                        />
                                    ))
                                }
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default DocumentsRepositoryPage;
