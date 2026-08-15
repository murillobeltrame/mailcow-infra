import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, api, type Folder, type MessageSummary } from "@/lib/api";
import { mailKeys } from "@/lib/query-keys";

const PAGE_SIZE = 40;

type MessagesPage = {
  messages: MessageSummary[];
  total: number;
  page: number;
};

type MessagesInfinite = {
  pages: MessagesPage[];
  pageParams: unknown[];
};

function sortNewestFirst(messages: MessageSummary[]) {
  return [...messages].sort((a, b) => {
    const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (byDate !== 0) return byDate;
    return b.uid - a.uid;
  });
}

function flattenMessages(data: MessagesInfinite | undefined) {
  return sortNewestFirst(data?.pages.flatMap((page) => page.messages) ?? []);
}

function listTotal(data: MessagesInfinite | undefined) {
  return data?.pages[0]?.total ?? 0;
}

function removeFromPages(data: MessagesInfinite | undefined, uid: number) {
  if (!data) return { data, removed: undefined as MessageSummary | undefined };
  let removed: MessageSummary | undefined;
  const pages = data.pages.map((page) => ({
    ...page,
    messages: page.messages.filter((message) => {
      if (message.uid !== uid) return true;
      removed = message;
      return false;
    }),
  }));

  if (!removed) return { data, removed: undefined };

  const nextTotal = Math.max(0, listTotal(data) - 1);
  return {
    data: {
      ...data,
      pages: pages.map((page) => ({ ...page, total: nextTotal })),
    },
    removed,
  };
}

function prependToPages(data: MessagesInfinite | undefined, message: MessageSummary): MessagesInfinite {
  if (!data) {
    return {
      pages: [{ messages: [message], total: 1, page: 0 }],
      pageParams: [0],
    };
  }

  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      total: page.total + 1,
      messages:
        index === 0
          ? [message, ...page.messages.filter((item) => item.uid !== message.uid)]
          : page.messages.filter((item) => item.uid !== message.uid),
    })),
  };
}

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
    retry: 1,
  });

  useEffect(() => {
    if (!foldersQuery.error) return;
    const msg =
      foldersQuery.error instanceof ApiError
        ? foldersQuery.error.message
        : "Não foi possível carregar as pastas";
    toast.error(msg);
  }, [foldersQuery.error]);

  const refetchFolders = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: mailKeys.folders });
  }, [queryClient]);

  const unreadQuery = useInfiniteQuery({
    queryKey: mailKeys.messages(activeFolder, searchQuery, "unseen"),
    queryFn: ({ pageParam = 0 }) =>
      api.messages(activeFolder, pageParam, searchQuery || undefined, "unseen").then((r) => ({
        messages: r.messages,
        total: r.total,
        page: pageParam,
      })),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      (last.page + 1) * PAGE_SIZE < last.total ? last.page + 1 : undefined,
    enabled: !!activeFolder,
  });

  const readQuery = useInfiniteQuery({
    queryKey: mailKeys.messages(activeFolder, searchQuery, "seen"),
    queryFn: ({ pageParam = 0 }) =>
      api.messages(activeFolder, pageParam, searchQuery || undefined, "seen").then((r) => ({
        messages: r.messages,
        total: r.total,
        page: pageParam,
      })),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      (last.page + 1) * PAGE_SIZE < last.total ? last.page + 1 : undefined,
    enabled: !!activeFolder,
  });

  const unreadMessages = useMemo(() => flattenMessages(unreadQuery.data), [unreadQuery.data]);
  const readMessages = useMemo(() => flattenMessages(readQuery.data), [readQuery.data]);
  const unreadTotal = listTotal(unreadQuery.data);
  const readTotal = listTotal(readQuery.data);

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

  const selectMessage = useCallback(
    (uid: number) => {
      setSelectedUid(uid);

      const unreadKey = mailKeys.messages(activeFolder, searchQuery, "unseen");
      const readKey = mailKeys.messages(activeFolder, searchQuery, "seen");
      const { data: nextUnread, removed } = removeFromPages(
        queryClient.getQueryData<MessagesInfinite>(unreadKey),
        uid,
      );
      if (!removed) return;

      queryClient.setQueryData<MessagesInfinite>(unreadKey, nextUnread);
      queryClient.setQueryData<MessagesInfinite>(readKey, (old) =>
        prependToPages(old, { ...removed, seen: true }),
      );
      queryClient.setQueryData<Folder[]>(mailKeys.folders, (folders) =>
        folders?.map((folder) =>
          folder.path === activeFolder && (folder.unseen ?? 0) > 0
            ? { ...folder, unseen: Math.max(0, (folder.unseen ?? 1) - 1) }
            : folder,
        ),
      );
    },
    [activeFolder, queryClient, searchQuery],
  );

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
    unreadMessages,
    readMessages,
    unreadTotal,
    readTotal,
    messagesLoading: unreadQuery.isPending || readQuery.isPending,
    unreadFetchingMore: unreadQuery.isFetchingNextPage,
    readFetchingMore: readQuery.isFetchingNextPage,
    hasMoreUnread: unreadQuery.hasNextPage,
    hasMoreRead: readQuery.hasNextPage,
    loadMoreUnread: () => unreadQuery.fetchNextPage(),
    loadMoreRead: () => readQuery.fetchNextPage(),
    message: messageQuery.data ?? null,
    messageLoading: messageQuery.isPending,
    messageError: messageQuery.error,
    activeFolder,
    activeFolderName,
    selectedUid,
    searchInput,
    setSearchInput,
    selectFolder,
    selectMessage,
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
    messagesError: unreadQuery.error ?? readQuery.error,
    refetchFolders,
  };
}
