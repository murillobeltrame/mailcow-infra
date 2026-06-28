import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { mailKeys } from "@/lib/query-keys";

const PAGE_SIZE = 40;

export function useMailbox() {
  const queryClient = useQueryClient();
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());

  const foldersQuery = useQuery({
    queryKey: mailKeys.folders,
    queryFn: () => api.folders().then((r) => r.folders),
  });

  const messagesQuery = useInfiniteQuery({
    queryKey: mailKeys.messages(activeFolder, searchQuery),
    queryFn: ({ pageParam = 0 }) =>
      api.messages(activeFolder, pageParam, searchQuery || undefined).then((r) => ({
        messages: r.messages,
        total: r.total,
        page: pageParam,
      })),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      (last.page + 1) * PAGE_SIZE < last.total ? last.page + 1 : undefined,
    enabled: !!activeFolder,
  });

  const messages = useMemo(
    () => messagesQuery.data?.pages.flatMap((p) => p.messages) ?? [],
    [messagesQuery.data],
  );

  const messageQuery = useQuery({
    queryKey: mailKeys.message(activeFolder, selectedUid ?? 0),
    queryFn: () => api.message(activeFolder, selectedUid!),
    enabled: selectedUid !== null,
    retry: 1,
  });

  const activeFolderName = useMemo(
    () => foldersQuery.data?.find((f) => f.path === activeFolder)?.name ?? "Caixa de entrada",
    [foldersQuery.data, activeFolder],
  );

  const selectFolder = useCallback((path: string) => {
    setActiveFolder(path);
    setSelectedUid(null);
  }, []);

  const submitSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
    setSelectedUid(null);
  }, [searchInput]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const tasks = [
        queryClient.refetchQueries({ queryKey: mailKeys.folders }),
        queryClient.refetchQueries({ queryKey: mailKeys.messages(activeFolder, searchQuery) }),
      ];
      if (selectedUid !== null) {
        tasks.push(queryClient.refetchQueries({ queryKey: mailKeys.message(activeFolder, selectedUid) }));
      }
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, activeFolder, searchQuery, selectedUid]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: mailKeys.folders }),
        queryClient.refetchQueries({ queryKey: mailKeys.all }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const invalidateMessages = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: mailKeys.messages(activeFolder, searchQuery) });
    queryClient.invalidateQueries({ queryKey: mailKeys.folders });
  }, [queryClient, activeFolder, searchQuery]);

  const deleteMutation = useMutation({
    mutationFn: (uid: number) => api.deleteMessages(activeFolder, [uid]),
    onSuccess: () => {
      toast.success("Mensagem excluída");
      setSelectedUid(null);
      invalidateMessages();
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (uids: number[]) => api.deleteMessages(activeFolder, uids),
    onSuccess: () => {
      toast.success("Mensagens excluídas");
      setSelectedUids(new Set());
      setBulkMode(false);
      setSelectedUid(null);
      invalidateMessages();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao excluir"),
  });

  const toggleBulkMode = useCallback(() => {
    setBulkMode((v) => !v);
    setSelectedUids(new Set());
  }, []);

  const toggleUid = useCallback((uid: number, checked: boolean) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (checked) next.add(uid);
      else next.delete(uid);
      return next;
    });
  }, []);

  const bulkDelete = useCallback(() => {
    const uids = [...selectedUids];
    if (uids.length) bulkDeleteMutation.mutate(uids);
  }, [selectedUids, bulkDeleteMutation]);

  const flagMutation = useMutation({
    mutationFn: ({ uid, flagged }: { uid: number; flagged: boolean }) =>
      api.toggleFlag(activeFolder, uid, flagged),
    onSuccess: () => invalidateMessages(),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao marcar"),
  });

  const unreadMutation = useMutation({
    mutationFn: (uid: number) => api.markUnread(activeFolder, uid),
    onSuccess: () => invalidateMessages(),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro"),
  });

  const moveMutation = useMutation({
    mutationFn: ({ uid, to }: { uid: number; to: string }) =>
      api.moveMessages(activeFolder, to, [uid]),
    onSuccess: () => {
      toast.success("Mensagem movida");
      setSelectedUid(null);
      invalidateMessages();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao mover"),
  });

  return {
    folders: foldersQuery.data ?? [],
    foldersLoading: foldersQuery.isLoading,
    messages,
    messagesLoading: messagesQuery.isLoading,
    messagesFetchingMore: messagesQuery.isFetchingNextPage,
    hasMoreMessages: messagesQuery.hasNextPage,
    loadMoreMessages: () => messagesQuery.fetchNextPage(),
    message: messageQuery.data ?? null,
    messageLoading: messageQuery.isPending,
    messageError: messageQuery.error,
    activeFolder,
    activeFolderName,
    selectedUid,
    searchInput,
    setSearchInput,
    selectFolder,
    setSelectedUid,
    submitSearch,
    refresh,
    refreshAll,
    refreshing,
    deleteMessage: deleteMutation.mutate,
    toggleFlag: flagMutation.mutate,
    markUnread: unreadMutation.mutate,
    moveMessage: moveMutation.mutate,
    isDeleting: deleteMutation.isPending,
    bulkMode,
    selectedUids,
    toggleBulkMode,
    toggleUid,
    bulkDelete,
    bulkDeleting: bulkDeleteMutation.isPending,
    foldersError: foldersQuery.error,
    messagesError: messagesQuery.error,
  };
}
